import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, MouseEvent } from 'react';
import {
  ChevronUp,
  ExternalLink,
  Info,
  MessageSquareQuote,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import {
  NOTICE_MESSAGES,
  adjustRainScaleForFps,
  chunkArray,
  createRainDrop,
  fetchLyricsWithStatusFromLrclib,
  findActiveLyricIndex,
  formatDurationDiffSigned,
  formatDurationMmSs,
  formatLyricCandidateLabel,
  getTargetRainDropCount,
  getYouTubeDefaultThumbnailUrl,
  getYouTubeThumbnailUrl,
  isNonSkippablePlayerError,
  parseCustomYouTubeUrl,
  parseLrcSyncedLyrics,
  parseYouTubeTrackInfo,
  resolveLyricSide,
  resolveLyricStatusNotice,
  resolvePlaybackErrorNotice,
  shouldReplaceNotice,
  shouldWarnLyricDurationDiff,
  sortLyricCandidatesByDurationDiff,
} from '../utils/helpers';
import type {
  LyricCandidateOption,
  LyricFetchStatus,
  LyricLine,
  LyricSideMode,
  MatchedLyricTrackInfo,
  NoticeCategory,
  RainDrop,
} from '../utils/helpers';

export { NOTICE_MESSAGES };

/** Geser waktu sinkronisasi lirik dalam detik (misal: 0.3 untuk maju, -0.3 untuk mundur) */
export const LYRIC_OFFSET = 0;

/** Pola posisi lirik di background: 'alternate' (ganjil kiri, genap kanan) | 'right' | 'left' */
export const LYRIC_SIDE: LyricSideMode = 'alternate';

/** Batas lebar layar (px) antara lirik inline di tengah halaman (< 1024px) dan lirik background (>= 1024px) */
export const LYRIC_INLINE_BREAKPOINT = 1024;

/** Jumlah butir hujan di desktop (>= 768px) dan mobile (< 768px) */
export const RAIN_DENSITY_DESKTOP = 120;
export const RAIN_DENSITY_MOBILE = 60;

/** Opacity layer redup saat Lyrics Mode aktif (rentang 0.35 - 0.5) */
export const DIM_OPACITY = 0.44;

/** Warna glow lembut pada teks lirik di Lyrics Mode */
export const LYRIC_GLOW_COLOR = '#C98E9B';

/** Simpan & muat otomatis link kustom terakhir saat halaman dibuka ulang (default: false agar mulai dari playlist utama Izumi) */
export const REMEMBER_LAST_LINK = false;

/** Batas maksimal auto-skip berturut-turut saat lagu di playlist gagal diputar */
export const MAX_CONSECUTIVE_ERROR_SKIPS = 5;

/** Durasi tampil notice otomatis sebelum hilang sendiri (ms) */
export const NOTICE_AUTO_DISMISS_MS = 6000;

/** Jeda sebelum auto-skip saat lagu error, agar pengguna sempat membaca notice (ms) */
export const ERROR_SKIP_DELAY_MS = 3500;
/** Batas waktu menunggu playlist kustom terbaca (ms) */
export const PLAYLIST_LOAD_TIMEOUT_MS = 10000;
/** Batas waktu menunggu script YouTube IFrame API (ms) */
export const PLAYER_SCRIPT_TIMEOUT_MS = 10000;
/** Umur cache lirik negatif (tidak ditemukan / tidak cocok) sebelum dicoba ulang (ms) */
export const LYRIC_NEGATIVE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface RainSplash {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  maxLife: number;
  life: number;
}

interface YTReadonlyVideoData {
  video_id?: string;
  title?: string;
  author?: string;
}

interface YTPlayerInstance {
  loadPlaylist: (opts: {
    listType: 'playlist';
    list: string;
    index?: number;
    startSeconds?: number;
  }) => void;
  cuePlaylist: (opts: {
    listType: 'playlist';
    list: string;
    index?: number;
    startSeconds?: number;
  }) => void;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  cueVideoById?: (videoId: string, startSeconds?: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  playVideoAt: (index: number) => void;
  setLoop: (loopPlaylists: boolean) => void;
  getPlaylist: () => string[] | null;
  getPlaylistIndex: () => number;
  getVideoData: () => YTReadonlyVideoData;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  destroy: () => void;
}

interface YTPlayerEvent {
  target: YTPlayerInstance;
  data: number;
}

declare global {
  interface Window {
    __izumiPlayer?: YTPlayerInstance | null;
    __izumiTriggerPlayerError?: (code: number) => void;
    __izumiSetDebugMode?: (enabled: boolean) => void;
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: YTPlayerEvent) => void;
            onStateChange?: (event: YTPlayerEvent) => void;
            onError?: (event: YTPlayerEvent) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState?: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface CachedTrackMeta {
  title: string;
  artist: string;
}

interface PlaylistTrackState {
  videoId: string;
  index: number;
  title: string;
  artist: string;
  status: 'loading' | 'loaded' | 'error';
}

interface CachedLyricEntry {
  syncedLyrics: string | null;
  status?: LyricFetchStatus;
  hasDurationCheck?: boolean;
  matchedTrack?: MatchedLyricTrackInfo | null;
  candidates?: LyricCandidateOption[];
  query?: {
    title: string;
    artist: string;
    duration: number;
  };
  savedAt?: number;
}

interface DisplayedLyricState {
  key: string;
  text: string;
  side: 'left' | 'right';
  displayOrder: number;
  index: number;
}

type PlayerSourceMode =
  | { type: 'default' }
  | {
      type: 'custom-playlist';
      playlistId: string;
      initialVideoId?: string;
      initialIndex?: number;
      rawUrl: string;
    }
  | {
      type: 'custom-video';
      videoId: string;
      rawUrl: string;
    };

interface ActiveNoticeState {
  id: number;
  category: NoticeCategory;
  message: string;
  actionLabel?: string;
}

interface InlineLinkFeedback {
  type: 'loading' | 'error';
  text: string;
}

const OEMBED_CACHE_KEY = 'izumi_yt_playlist_meta_v1';
const LRCLIB_CACHE_KEY = 'izumi_lrclib_synced_v5';
const LYRICS_ENABLED_KEY = 'izumi_lyrics_enabled_v1';
const CUSTOM_LINK_STORAGE_KEY = 'izumi_custom_yt_link_v1';
const LYRIC_MANUAL_VERSION_KEY = 'izumi_lyric_manual_version_v1';
const LYRIC_OFFSET_STORAGE_KEY = 'izumi_lyric_offset_v1';
const DEBUG_MODE_STORAGE_KEY = 'izumi_debug';

try {
  window.localStorage.removeItem('izumi_lrclib_synced_v1');
  window.localStorage.removeItem('izumi_lrclib_synced_v2');
  window.localStorage.removeItem('izumi_lrclib_synced_v3');
  window.localStorage.removeItem('izumi_lrclib_synced_v4');
} catch {
  // Ignore storage errors
}

function readManualLyricVersions(): Record<string, LyricCandidateOption> {
  try {
    const raw = window.localStorage.getItem(LYRIC_MANUAL_VERSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeManualLyricVersions(map: Record<string, LyricCandidateOption>): void {
  try {
    const keys = Object.keys(map);
    let trimmed = map;
    if (keys.length > 200) {
      trimmed = {};
      for (const k of keys.slice(keys.length - 200)) {
        trimmed[k] = map[k];
      }
    }
    window.localStorage.setItem(LYRIC_MANUAL_VERSION_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
}

function readLyricOffsets(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(LYRIC_OFFSET_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLyricOffsets(map: Record<string, number>): void {
  try {
    const keys = Object.keys(map);
    let trimmed = map;
    if (keys.length > 500) {
      trimmed = {};
      for (const k of keys.slice(keys.length - 500)) {
        trimmed[k] = map[k];
      }
    }
    window.localStorage.setItem(LYRIC_OFFSET_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
}

function readInitialDebugMode(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const debugParam = params.get('debug') || params.get('lyricDebug');
    if (debugParam === '1' || debugParam === 'true') return true;
    if (window.location.hash === '#debug') return true;
    const stored =
      window.localStorage.getItem(DEBUG_MODE_STORAGE_KEY) ||
      window.localStorage.getItem('izumi_lyrics_debug');
    return stored === '1' || stored === 'true';
  } catch {
    return false;
  }
}

function readTrackCache(): Record<string, CachedTrackMeta> {
  try {
    const raw = window.localStorage.getItem(OEMBED_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTrackCache(cache: Record<string, CachedTrackMeta>): void {
  try {
    const keys = Object.keys(cache);
    let trimmedCache = cache;
    if (keys.length > 500) {
      trimmedCache = {};
      for (const key of keys.slice(keys.length - 500)) {
        trimmedCache[key] = cache[key];
      }
    }
    window.localStorage.setItem(OEMBED_CACHE_KEY, JSON.stringify(trimmedCache));
  } catch {
    // Ignore storage quota errors
  }
}

function readLyricCache(): Record<string, CachedLyricEntry> {
  try {
    const raw = window.localStorage.getItem(LRCLIB_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLyricCache(videoId: string, entry: CachedLyricEntry): void {
  try {
    const current = readLyricCache();
    current[videoId] = { ...entry, savedAt: Date.now() };
    const entries = Object.entries(current);
    if (entries.length > 120) {
      entries.sort((a, b) => (a[1]?.savedAt ?? 0) - (b[1]?.savedAt ?? 0));
      const kept = entries.slice(entries.length - 120);
      const trimmed: Record<string, CachedLyricEntry> = {};
      for (const [k, v] of kept) {
        trimmed[k] = v;
      }
      window.localStorage.setItem(LRCLIB_CACHE_KEY, JSON.stringify(trimmed));
      return;
    }
    window.localStorage.setItem(LRCLIB_CACHE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota errors
  }
}

function readInitialLyricsEnabled(): boolean {
  try {
    const saved = window.localStorage.getItem(LYRICS_ENABLED_KEY);
    if (saved === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

function readSavedCustomLink(): string | null {
  if (!REMEMBER_LAST_LINK) return null;
  try {
    const saved = window.localStorage.getItem(CUSTOM_LINK_STORAGE_KEY);
    return saved && saved.trim() ? saved.trim() : null;
  } catch {
    return null;
  }
}

function writeSavedCustomLink(rawUrl: string | null): void {
  try {
    if (!rawUrl || !REMEMBER_LAST_LINK) {
      window.localStorage.removeItem(CUSTOM_LINK_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CUSTOM_LINK_STORAGE_KEY, rawUrl);
    }
  } catch {
    // Ignore storage errors
  }
}

async function fetchSingleTrackOEmbed(
  videoId: string,
  index: number,
  fallbackArtist = 'YouTube Music'
): Promise<{ title: string; artist: string; ok: boolean }> {
  const cleanId = videoId.trim();
  const primaryUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${cleanId}&format=json`;
  const backupUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${cleanId}`;

  try {
    const res = await fetch(primaryUrl);
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string };
      if (data && data.title && data.title.trim()) {
        const parsed = parseYouTubeTrackInfo(
          data.title,
          data.author_name,
          index + 1,
          fallbackArtist
        );
        return { ...parsed, ok: true };
      }
    }
  } catch {
    // Fallback to noembed below
  }

  try {
    const res = await fetch(backupUrl);
    if (res.ok) {
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
        error?: string;
      };
      if (data && !data.error && data.title && data.title.trim()) {
        const parsed = parseYouTubeTrackInfo(
          data.title,
          data.author_name,
          index + 1,
          fallbackArtist
        );
        return { ...parsed, ok: true };
      }
    }
  } catch {
    // Fallback to placeholder below
  }

  return {
    title: `Lagu ${index + 1}`,
    artist: fallbackArtist,
    ok: false,
  };
}

interface InlineLyricSnapshot {
  isLyricsEnabled: boolean;
  hasSyncedLyrics: boolean;
  isPlaying: boolean;
  displayedLyric: DisplayedLyricState | null;
  exitingLyric: DisplayedLyricState | null;
}

let currentInlineLyricSnapshot: InlineLyricSnapshot = {
  isLyricsEnabled: false,
  hasSyncedLyrics: false,
  isPlaying: false,
  displayedLyric: null,
  exitingLyric: null,
};

const inlineLyricListeners = new Set<() => void>();

function publishInlineLyricSnapshot(next: InlineLyricSnapshot): void {
  currentInlineLyricSnapshot = next;
  inlineLyricListeners.forEach((listener) => listener());
}

function checkIsInlineLyricViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < LYRIC_INLINE_BREAKPOINT;
}

function useIsInlineLyricViewport(): boolean {
  const [isInline, setIsInline] = useState<boolean>(checkIsInlineLyricViewport);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(`(max-width: ${LYRIC_INLINE_BREAKPOINT - 0.02}px)`)
        : null;

    const update = () => {
      setIsInline(window.innerWidth < LYRIC_INLINE_BREAKPOINT);
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    if (mql) {
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', update);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(update);
      }
    }

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (mql) {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', update);
        } else if (typeof mql.removeListener === 'function') {
          mql.removeListener(update);
        }
      }
    };
  }, []);

  return isInline;
}

export function InlineLyricsSlot() {
  const isInlineViewport = useIsInlineLyricViewport();
  const [snapshot, setSnapshot] = useState<InlineLyricSnapshot>(() => currentInlineLyricSnapshot);

  useEffect(() => {
    const handleUpdate = () => {
      setSnapshot(currentInlineLyricSnapshot);
    };
    inlineLyricListeners.add(handleUpdate);
    handleUpdate();
    return () => {
      inlineLyricListeners.delete(handleUpdate);
    };
  }, []);

  if (!isInlineViewport) {
    return null;
  }

  const isExpanded = snapshot.isLyricsEnabled && snapshot.hasSyncedLyrics;

  return (
    <div
      className={`inline-lyrics-slot${isExpanded ? ' is-expanded' : ''}${
        snapshot.isLyricsEnabled ? ' is-lyrics-mode' : ''
      }${snapshot.isPlaying ? ' is-playing' : ' is-paused'}`}
      id="inline-lyrics-slot"
      aria-hidden="true"
      data-lyrics-enabled={snapshot.isLyricsEnabled ? 'true' : 'false'}
      data-lyrics-loaded={snapshot.hasSyncedLyrics ? 'true' : 'false'}
      data-is-playing={snapshot.isPlaying ? 'true' : 'false'}
      data-glow-color={LYRIC_GLOW_COLOR}
    >
      {isExpanded && snapshot.exitingLyric && (
        <div
          key={`inline-exit-${snapshot.exitingLyric.key}`}
          className="inline-lyric-line is-exiting"
        >
          {snapshot.exitingLyric.text}
        </div>
      )}
      {isExpanded && snapshot.displayedLyric && (
        <div
          key={`inline-active-${snapshot.displayedLyric.key}`}
          className={`inline-lyric-line is-active${
            snapshot.isPlaying ? ' is-playing' : ' is-paused'
          }`}
          data-lyric-order={snapshot.displayedLyric.displayOrder}
        >
          {snapshot.displayedLyric.text}
        </div>
      )}
    </div>
  );
}

export function MusicPlayer() {
  const { playlistId, playlistUrl, albumArtSrc, title: defaultTitle, artist: defaultArtist } =
    siteConfig.widgets.musicPlayer;
  const isInlineLyricViewport = useIsInlineLyricViewport();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isVideoPanelOpen, setIsVideoPanelOpen] = useState(false);
  const [trackTitle, setTrackTitle] = useState(defaultTitle);
  const [trackArtist, setTrackArtist] = useState(defaultArtist);
  const [videoId, setVideoId] = useState<string>('');
  const [trackDuration, setTrackDuration] = useState<number>(0);
  const [imgError, setImgError] = useState(false);

  const [playlistVideoIds, setPlaylistVideoIds] = useState<string[]>([]);
  const [trackMetaMap, setTrackMetaMap] = useState<Record<string, PlaylistTrackState>>({});
  const [failedThumbIds, setFailedThumbIds] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const [sourceMode, setSourceMode] = useState<PlayerSourceMode>(() => {
    const saved = readSavedCustomLink();
    if (saved) {
      const parsed = parseCustomYouTubeUrl(saved);
      if (parsed.ok) {
        if (parsed.sourceType === 'playlist') {
          return {
            type: 'custom-playlist',
            playlistId: parsed.playlistId,
            initialVideoId: parsed.videoId,
            initialIndex: parsed.index,
            rawUrl: parsed.normalizedUrl,
          };
        }
        return {
          type: 'custom-video',
          videoId: parsed.videoId,
          rawUrl: parsed.normalizedUrl,
        };
      }
    }
    return { type: 'default' };
  });
  const [customLinkInput, setCustomLinkInput] = useState<string>(() => readSavedCustomLink() || '');
  const [customLinkFeedback, setCustomLinkFeedback] = useState<InlineLinkFeedback | null>(null);

  const [activeNotice, setActiveNotice] = useState<ActiveNoticeState | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);

  const [isLyricsEnabled, setIsLyricsEnabled] = useState<boolean>(readInitialLyricsEnabled);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [displayedLyric, setDisplayedLyric] = useState<DisplayedLyricState | null>(null);
  const [exitingLyric, setExitingLyric] = useState<DisplayedLyricState | null>(null);
  const [lyricIssueStatus, setLyricIssueStatus] = useState<Exclude<
    LyricFetchStatus,
    'synced'
  > | null>(null);
  const [lyricCandidates, setLyricCandidates] = useState<LyricCandidateOption[]>([]);
  const [autoSelectedCandidate, setAutoSelectedCandidate] =
    useState<LyricCandidateOption | null>(null);
  const [autoLyricStatus, setAutoLyricStatus] = useState<LyricFetchStatus | null>(null);
  const [manualLyricMap, setManualLyricMap] = useState<Record<string, LyricCandidateOption>>(
    readManualLyricVersions
  );
  const [lyricOffsetMap, setLyricOffsetMap] = useState<Record<string, number>>(readLyricOffsets);
  const [isVersionListOpen, setIsVersionListOpen] = useState<boolean>(false);
  const [isDebugMode, setIsDebugMode] = useState<boolean>(readInitialDebugMode);

  const playerRef = useRef<YTPlayerInstance | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const miniPlayerRef = useRef<HTMLDivElement | null>(null);
  const playlistPanelRef = useRef<HTMLDivElement | null>(null);
  const playlistListRef = useRef<HTMLDivElement | null>(null);
  const playlistTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);

  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const sourceModeRef = useRef<PlayerSourceMode>(sourceMode);
  sourceModeRef.current = sourceMode;

  const playlistVideoIdsRef = useRef<string[]>(playlistVideoIds);
  playlistVideoIdsRef.current = playlistVideoIds;

  const userInitiatedPlayRef = useRef(false);
  const isReadyRef = useRef(false);
  const playerLoadFailedRef = useRef(false);
  const activeNoticeRef = useRef<ActiveNoticeState | null>(null);
  const displayedLyricRef = useRef<DisplayedLyricState | null>(null);
  const endedTimerRef = useRef<number | null>(null);
  const metadataTimerRef = useRef<number | null>(null);
  const playlistPollRef = useRef<number | null>(null);
  const playlistLoadTimeoutRef = useRef<number | null>(null);
  const errorSkipTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const exitLyricTimerRef = useRef<number | null>(null);
  const fetchedIdsRef = useRef<Set<string>>(new Set());
  const consecutiveErrorsRef = useRef<number>(0);
  const noticeCounterRef = useRef<number>(0);
  const notifiedLyricTracksRef = useRef<Set<string>>(new Set());
  const notifiedDurationWarnRef = useRef<Set<string>>(new Set());

  const reactId = useId();
  const playerDomId = `yt-player-${reactId.replace(/:/g, '')}`;

  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    activeNoticeRef.current = null;
    setActiveNotice(null);
  }, []);

  const dismissNoticeByCategory = useCallback((category: NoticeCategory) => {
    if (activeNoticeRef.current?.category !== category) return;
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    activeNoticeRef.current = null;
    setActiveNotice(null);
  }, []);

  const showNotice = useCallback(
    (category: NoticeCategory, message: string, actionLabel?: string) => {
      if (!shouldReplaceNotice(activeNoticeRef.current?.category ?? null, category)) return;
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      noticeCounterRef.current += 1;
      const next: ActiveNoticeState = {
        id: noticeCounterRef.current,
        category,
        message,
        ...(actionLabel ? { actionLabel } : {}),
      };
      activeNoticeRef.current = next;
      setActiveNotice(next);
      noticeTimerRef.current = window.setTimeout(() => {
        if (activeNoticeRef.current?.id === next.id) {
          activeNoticeRef.current = null;
          setActiveNotice(null);
        }
        noticeTimerRef.current = null;
      }, NOTICE_AUTO_DISMISS_MS);
    },
    []
  );

  const ensurePlayerAvailable = useCallback((): boolean => {
    if (!playerLoadFailedRef.current) return true;
    setIsPlaying(false);
    showNotice('playback', NOTICE_MESSAGES.PLAYER_LOAD_FAILED);
    return false;
  }, [showNotice]);

  const updateDisplayedLyricWithTransition = useCallback(
    (next: DisplayedLyricState | null) => {
      const prev = displayedLyricRef.current;
      if ((prev?.key ?? null) === (next?.key ?? null)) return;
      displayedLyricRef.current = next;
      if (prev) {
        setExitingLyric(prev);
        if (exitLyricTimerRef.current !== null) {
          window.clearTimeout(exitLyricTimerRef.current);
        }
        exitLyricTimerRef.current = window.setTimeout(() => {
          setExitingLyric(null);
          exitLyricTimerRef.current = null;
        }, 420);
      }
      setDisplayedLyric(next);
    },
    []
  );

  const syncPlaylistIdsFromPlayer = useCallback((player: YTPlayerInstance | null) => {
    if (!player || typeof player.getPlaylist !== 'function') return false;
    if (sourceModeRef.current.type === 'custom-video') {
      return true;
    }
    try {
      const list = player.getPlaylist();
      if (Array.isArray(list) && list.length > 0) {
        setPlaylistVideoIds((prev) => {
          if (prev.length === list.length && prev.every((id, i) => id === list[i])) {
            return prev;
          }
          return [...list];
        });
        return true;
      }
    } catch {
      // Ignore transient YT API error
    }
    return false;
  }, []);

  const syncMetadataFromPlayer = useCallback(
    (player: YTPlayerInstance | null) => {
      if (!player) return;
      if (sourceModeRef.current.type !== 'custom-video') {
        syncPlaylistIdsFromPlayer(player);
      }

      try {
        if (typeof player.getDuration === 'function') {
          const dur = player.getDuration();
          if (typeof dur === 'number' && Number.isFinite(dur) && dur > 0) {
            setTrackDuration(Math.round(dur));
          }
        }
      } catch {
        // Ignore
      }

      // Before user initiates playback on default playlist, keep active track locked to index 0
      if (!userInitiatedPlayRef.current && sourceModeRef.current.type === 'default') {
        setActiveIndex(0);
        return;
      }

      let currentIdx = -1;
      if (sourceModeRef.current.type === 'custom-video') {
        currentIdx = 0;
        setActiveIndex(0);
      } else {
        try {
          if (typeof player.getPlaylistIndex === 'function') {
            const idx = player.getPlaylistIndex();
            if (typeof idx === 'number' && idx >= 0) {
              currentIdx = idx;
              setActiveIndex(idx);
            }
          }
        } catch {
          // Ignore
        }
      }

      if (typeof player.getVideoData !== 'function') return;
      try {
        const data = player.getVideoData();
        if (data) {
          const currentVid = data.video_id?.trim() || '';
          if (currentVid) {
            setVideoId((prev) => {
              if (prev !== currentVid) {
                setImgError(false);
              }
              return currentVid;
            });

            if (sourceModeRef.current.type === 'custom-video') {
              setPlaylistVideoIds((prev) =>
                prev.length === 1 && prev[0] === currentVid ? prev : [currentVid]
              );
            } else if (currentIdx < 0 && typeof player.getPlaylist === 'function') {
              const list = player.getPlaylist();
              if (Array.isArray(list)) {
                const foundIdx = list.indexOf(currentVid);
                if (foundIdx >= 0) {
                  currentIdx = foundIdx;
                  setActiveIndex(foundIdx);
                }
              }
            }
          }

          const hasAuthor = Boolean(data.author && data.author.trim());
          if (data.title && data.title.trim()) {
            const parsed = parseYouTubeTrackInfo(
              data.title,
              data.author,
              currentIdx >= 0 ? currentIdx + 1 : 1,
              'YouTube Music'
            );
            setTrackTitle(parsed.title);
            if (hasAuthor || parsed.artist !== 'YouTube Music') {
              setTrackArtist(parsed.artist);
            }

            if (currentVid && hasAuthor) {
              setTrackMetaMap((prev) => {
                const existing = prev[currentVid];
                if (
                  existing &&
                  existing.status === 'loaded' &&
                  existing.title === parsed.title &&
                  existing.artist === parsed.artist
                ) {
                  return prev;
                }
                return {
                  ...prev,
                  [currentVid]: {
                    videoId: currentVid,
                    index: currentIdx >= 0 ? currentIdx : existing?.index ?? 0,
                    title: parsed.title,
                    artist: parsed.artist,
                    status: 'loaded',
                  },
                };
              });
            }
          }
        }
      } catch {
        // Ignore transient YT API errors before iframe is ready
      }
    },
    [syncPlaylistIdsFromPlayer]
  );

  const scheduleMetadataSync = useCallback(
    (player: YTPlayerInstance, delayMs: number) => {
      if (metadataTimerRef.current !== null) {
        window.clearTimeout(metadataTimerRef.current);
      }
      metadataTimerRef.current = window.setTimeout(() => {
        metadataTimerRef.current = null;
        syncMetadataFromPlayer(player);
      }, delayMs);
    },
    [syncMetadataFromPlayer]
  );

  useEffect(() => {
    if (!userInitiatedPlayRef.current && playlistVideoIds[0]) {
      setVideoId(playlistVideoIds[0]);
    }
  }, [playlistVideoIds]);

  // Batch fetch oEmbed metadata when playlistVideoIds are discovered and panel is opened
  useEffect(() => {
    if (!isPlaylistOpen || playlistVideoIds.length === 0) return;
    let isCancelled = false;

    const cache = readTrackCache();
    const toFetch: { videoId: string; index: number }[] = [];

    playlistVideoIds.forEach((vid, idx) => {
      const cached = cache[vid];
      if (cached && cached.title) {
        fetchedIdsRef.current.add(vid);
      } else if (!fetchedIdsRef.current.has(vid)) {
        toFetch.push({ videoId: vid, index: idx });
      }
    });

    setTrackMetaMap((prev) => {
      const next = { ...prev };
      playlistVideoIds.forEach((vid, idx) => {
        const cached = cache[vid];
        if (cached && cached.title) {
          next[vid] = {
            videoId: vid,
            index: idx,
            title: cached.title,
            artist: cached.artist || 'YouTube Music',
            status: 'loaded',
          };
        } else if (!next[vid]) {
          next[vid] = {
            videoId: vid,
            index: idx,
            title: `Lagu ${idx + 1}`,
            artist: 'YouTube Music',
            status: 'loading',
          };
        }
      });
      return next;
    });

    if (toFetch.length === 0) return;

    const runBatches = async () => {
      const batches = chunkArray(toFetch, 5);
      const updatedCache = { ...readTrackCache() };

      for (const batch of batches) {
        if (isCancelled) return;

        const results = await Promise.all(
          batch.map(async (item) => {
            const res = await fetchSingleTrackOEmbed(item.videoId, item.index, 'YouTube Music');
            return { ...item, ...res };
          })
        );

        if (isCancelled) return;

        batch.forEach((item) => fetchedIdsRef.current.add(item.videoId));

        for (const item of results) {
          if (item.ok) {
            updatedCache[item.videoId] = {
              title: item.title,
              artist: item.artist,
            };
          }
        }
        writeTrackCache(updatedCache);

        setTrackMetaMap((prev) => {
          const next = { ...prev };
          for (const item of results) {
            next[item.videoId] = {
              videoId: item.videoId,
              index: item.index,
              title: item.title,
              artist: item.artist,
              status: item.ok ? 'loaded' : 'error',
            };
          }
          return next;
        });
      }
    };

    void runBatches();

    return () => {
      isCancelled = true;
    };
  }, [isPlaylistOpen, playlistVideoIds]);

  // Keep mini player title/artist synced with loaded oEmbed metadata if active video matches
  useEffect(() => {
    const activeVid = playlistVideoIds[activeIndex] || videoId;
    if (!activeVid) return;
    const meta = trackMetaMap[activeVid];
    if (meta && meta.status === 'loaded') {
      setTrackTitle(meta.title);
      setTrackArtist(meta.artist);
      setCustomLinkFeedback((prev) => (prev?.type === 'loading' ? null : prev));
    }
  }, [activeIndex, playlistVideoIds, videoId, trackMetaMap]);

  // Clear active lyrics and dismiss song-specific notices when track changes
  const activeVideoKey = playlistVideoIds[activeIndex] || videoId;
  const fallbackElapsedRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number | null>(null);
  const prevActiveVideoKeyRef = useRef<string>(activeVideoKey);

  useEffect(() => {
    setLyricLines([]);
    setLyricIssueStatus(null);
    setLyricCandidates([]);
    setAutoSelectedCandidate(null);
    setAutoLyricStatus(null);
    setTrackDuration(0);
    fallbackElapsedRef.current = 0;
    lastTickTimeRef.current = null;
    updateDisplayedLyricWithTransition(null);

    if (prevActiveVideoKeyRef.current && prevActiveVideoKeyRef.current !== activeVideoKey) {
      dismissNoticeByCategory('lyrics');
    }
    prevActiveVideoKeyRef.current = activeVideoKey;
  }, [activeVideoKey, dismissNoticeByCategory, updateDisplayedLyricWithTransition]);

  const lyricVideoId = (playlistVideoIds[activeIndex] || videoId || '').trim();
  const lyricMeta = lyricVideoId ? trackMetaMap[lyricVideoId] : undefined;
  // Hanya percaya metadata yang sudah benar-benar 'loaded' (dari oEmbed atau player.getVideoData).
  const lyricTitle = lyricMeta?.status === 'loaded' ? lyricMeta.title : '';
  const lyricArtistRaw = lyricMeta?.status === 'loaded' ? lyricMeta.artist : '';
  const lyricArtist = lyricArtistRaw === 'YouTube Music' ? '' : lyricArtistRaw;
  const lyricTitleUsable = lyricTitle.length > 0 && !/^Lagu\s+\d+$/i.test(lyricTitle);

  const manualCandidate = lyricVideoId ? manualLyricMap[lyricVideoId] ?? null : null;
  const isManualOverride = Boolean(manualCandidate);
  const activeCandidate: LyricCandidateOption | null = manualCandidate ?? autoSelectedCandidate;
  const currentSongOffset = lyricVideoId ? lyricOffsetMap[lyricVideoId] ?? 0 : 0;
  const effectiveLyricOffset = Number((LYRIC_OFFSET + currentSongOffset).toFixed(2));

  const sortedCandidates = sortLyricCandidatesByDurationDiff(
    [
      ...lyricCandidates,
      ...(autoSelectedCandidate ? [autoSelectedCandidate] : []),
      ...(manualCandidate ? [manualCandidate] : []),
    ],
    trackDuration
  );

  // Sync active lyric lines and issue status whenever activeCandidate (manual or auto) changes
  useEffect(() => {
    if (activeCandidate && typeof activeCandidate.syncedLyrics === 'string' && activeCandidate.syncedLyrics.trim()) {
      setLyricLines(parseLrcSyncedLyrics(activeCandidate.syncedLyrics));
      setLyricIssueStatus(null);
      return;
    }
    setLyricLines([]);
    if (autoLyricStatus && autoLyricStatus !== 'synced') {
      setLyricIssueStatus(autoLyricStatus);
    } else {
      setLyricIssueStatus(null);
    }
  }, [activeCandidate, autoLyricStatus]);

  // Publish active lyric snapshot for InlineLyricsSlot (< 1024px) without duplicating sync logic
  useEffect(() => {
    publishInlineLyricSnapshot({
      isLyricsEnabled,
      hasSyncedLyrics: lyricLines.length > 0,
      isPlaying,
      displayedLyric,
      exitingLyric,
    });
  }, [isLyricsEnabled, lyricLines.length, isPlaying, displayedLyric, exitingLyric]);

  // Show lyrics notice at most once per song when Lyrics Mode is active and lyrics have an issue
  useEffect(() => {
    if (!isLyricsEnabled || !lyricIssueStatus || activeCandidate) return;
    const currentVid = (playlistVideoIds[activeIndex] || videoId || '').trim();
    if (!currentVid) return;

    // Only notify when user has initiated play or interacted with lyrics mode on an active track
    if (!userInitiatedPlayRef.current) return;

    if (notifiedLyricTracksRef.current.has(currentVid)) {
      return;
    }

    const msg = resolveLyricStatusNotice(lyricIssueStatus);
    if (msg) {
      notifiedLyricTracksRef.current.add(currentVid);
      showNotice('lyrics', msg);
    }
  }, [
    isLyricsEnabled,
    lyricIssueStatus,
    activeCandidate,
    activeIndex,
    playlistVideoIds,
    videoId,
    showNotice,
  ]);

  // Show warning notice with direct action button if selected candidate duration differs by > 3 seconds
  useEffect(() => {
    if (!isLyricsEnabled || !lyricVideoId || !activeCandidate || trackDuration <= 0) return;

    const warnNeeded = shouldWarnLyricDurationDiff(activeCandidate.duration, trackDuration);
    if (!warnNeeded) {
      if (activeNoticeRef.current?.message === NOTICE_MESSAGES.LYRICS_DURATION_WARN) {
        dismissNotice();
      }
      return;
    }

    const warnKey = `${lyricVideoId}:${activeCandidate.id}:${trackDuration}`;
    if (notifiedDurationWarnRef.current.has(warnKey)) {
      return;
    }
    notifiedDurationWarnRef.current.add(warnKey);
    if (activeNoticeRef.current && activeNoticeRef.current.category !== 'lyrics') {
      dismissNotice();
    }
    showNotice('lyrics', NOTICE_MESSAGES.LYRICS_DURATION_WARN, 'Versi lirik');
  }, [
    isLyricsEnabled,
    lyricVideoId,
    activeCandidate,
    trackDuration,
    showNotice,
    dismissNotice,
  ]);

  // Fetch synced lyrics from LRCLIB with localStorage caching and AbortController
  useEffect(() => {
    if ((!isLyricsEnabled && !isVersionListOpen) || !lyricVideoId || !lyricTitleUsable) return;

    const cache = readLyricCache();
    const entry = cache[lyricVideoId];
    if (entry) {
      const cachedCandidates = Array.isArray(entry.candidates) ? entry.candidates : [];
      if (typeof entry.syncedLyrics === 'string' && entry.syncedLyrics.trim()) {
        const autoCand: LyricCandidateOption =
          cachedCandidates.find(
            (c) =>
              (entry.matchedTrack?.id !== undefined &&
                String(c.id) === String(entry.matchedTrack.id)) ||
              c.syncedLyrics === entry.syncedLyrics
          ) ?? {
            id: entry.matchedTrack?.id ?? `auto-${lyricVideoId}`,
            trackName: entry.matchedTrack?.trackName || lyricTitle,
            artistName: entry.matchedTrack?.artistName || lyricArtist || defaultArtist,
            duration: entry.matchedTrack?.duration || trackDuration,
            syncedLyrics: entry.syncedLyrics,
          };
        if (import.meta.env.DEV) {
          console.log('[LRCLIB Lyrics Cache]', {
            videoId: lyricVideoId,
            query: entry.query ?? {
              title: lyricTitle,
              artist: lyricArtist,
              duration: trackDuration,
            },
            selected: entry.matchedTrack ?? null,
            candidateCount: Math.max(1, cachedCandidates.length),
            status: 'synced',
          });
        }
        setLyricCandidates(cachedCandidates.length > 0 ? cachedCandidates : [autoCand]);
        setAutoSelectedCandidate(autoCand);
        setAutoLyricStatus('synced');
        return;
      }
      const isFresh =
        typeof entry.savedAt === 'number' &&
        Date.now() - entry.savedAt < LYRIC_NEGATIVE_CACHE_TTL_MS;
      if (entry.syncedLyrics === null && entry.hasDurationCheck && isFresh) {
        const fallbackStatus: LyricFetchStatus =
          entry.status && entry.status !== 'synced' ? entry.status : 'not_found';
        if (import.meta.env.DEV) {
          console.log('[LRCLIB Lyrics Cache]', {
            videoId: lyricVideoId,
            query: entry.query ?? {
              title: lyricTitle,
              artist: lyricArtist,
              duration: trackDuration,
            },
            selected: null,
            candidateCount: cachedCandidates.length,
            status: fallbackStatus,
          });
        }
        setLyricCandidates(cachedCandidates);
        setAutoSelectedCandidate(null);
        setAutoLyricStatus(fallbackStatus);
        return;
      }
    }

    // Jangan fetch tanpa durasi: validasi durasi adalah syarat kecocokan lirik.
    if (trackDuration <= 0) return;

    const controller = new AbortController();
    const run = async () => {
      try {
        const result = await fetchLyricsWithStatusFromLrclib(
          lyricTitle,
          lyricArtist,
          trackDuration,
          controller.signal
        );
        if (controller.signal.aborted) return;

        const discoveredCandidates = Array.isArray(result.candidates) ? result.candidates : [];

        if (result.status === 'synced' && result.syncedLyrics) {
          const autoCand: LyricCandidateOption =
            discoveredCandidates.find(
              (c) =>
                (result.matchedTrack?.id !== undefined &&
                  String(c.id) === String(result.matchedTrack.id)) ||
                c.syncedLyrics === result.syncedLyrics
            ) ?? {
              id: result.matchedTrack?.id ?? `auto-${lyricVideoId}`,
              trackName: result.matchedTrack?.trackName || lyricTitle,
              artistName: result.matchedTrack?.artistName || lyricArtist || defaultArtist,
              duration: result.matchedTrack?.duration || trackDuration,
              syncedLyrics: result.syncedLyrics,
            };
          const fullCandidates =
            discoveredCandidates.length > 0 ? discoveredCandidates : [autoCand];

          writeLyricCache(lyricVideoId, {
            syncedLyrics: result.syncedLyrics,
            status: 'synced',
            hasDurationCheck: true,
            matchedTrack: result.matchedTrack ?? null,
            candidates: fullCandidates,
            query: {
              title: lyricTitle,
              artist: lyricArtist,
              duration: trackDuration,
            },
          });
          setLyricCandidates(fullCandidates);
          setAutoSelectedCandidate(autoCand);
          setAutoLyricStatus('synced');
        } else {
          const missStatus: LyricFetchStatus =
            result.status && result.status !== 'synced' ? result.status : 'not_found';
          writeLyricCache(lyricVideoId, {
            syncedLyrics: null,
            status: missStatus,
            hasDurationCheck: true,
            matchedTrack: null,
            candidates: discoveredCandidates,
            query: {
              title: lyricTitle,
              artist: lyricArtist,
              duration: trackDuration,
            },
          });
          setLyricCandidates(discoveredCandidates);
          setAutoSelectedCandidate(null);
          setAutoLyricStatus(missStatus);
        }
      } catch {
        // AbortError diabaikan
      }
    };
    void run();
    return () => controller.abort();
  }, [
    isLyricsEnabled,
    isVersionListOpen,
    lyricVideoId,
    lyricTitle,
    lyricArtist,
    lyricTitleUsable,
    trackDuration,
    defaultArtist,
  ]);

  // Synchronize active lyric line every 100ms while playing
  useEffect(() => {
    if (!isLyricsEnabled) {
      updateDisplayedLyricWithTransition(null);
      return;
    }

    const syncCurrentTime = (advanceFallback = true) => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      const now = performance.now();
      const dt =
        advanceFallback && lastTickTimeRef.current !== null
          ? Math.max(0, (now - lastTickTimeRef.current) / 1000)
          : 0;
      if (advanceFallback) {
        lastTickTimeRef.current = now;
      }

      let currentTime = 0;
      try {
        const ytTime = player.getCurrentTime() || 0;
        if (ytTime > 0) {
          currentTime = ytTime;
          fallbackElapsedRef.current = ytTime;
        } else {
          fallbackElapsedRef.current += dt;
          currentTime = fallbackElapsedRef.current;
        }

        if (trackDuration <= 0 && typeof player.getDuration === 'function') {
          const dur = player.getDuration();
          if (dur > 0) {
            setTrackDuration(Math.round(dur));
          }
        }
      } catch {
        return;
      }

      if (lyricLines.length === 0) {
        updateDisplayedLyricWithTransition(null);
        return;
      }

      const activeVid = playlistVideoIds[activeIndex] || videoId || 'track';
      const versionKey = activeCandidate?.id ?? 'auto';
      const idx = findActiveLyricIndex(lyricLines, currentTime, effectiveLyricOffset);

      // Before first line starts (intro) -> show nothing
      if (idx < 0) {
        updateDisplayedLyricWithTransition(null);
        return;
      }

      const line = lyricLines[idx];
      // Empty LRC line (instrumental / pause break) -> fade out until next line
      if (!line || !line.text) {
        updateDisplayedLyricWithTransition(null);
        return;
      }

      const side = resolveLyricSide(line.displayOrder, LYRIC_SIDE);
      updateDisplayedLyricWithTransition({
        key: `${activeVid}-${versionKey}-${idx}`,
        text: line.text,
        side,
        displayOrder: line.displayOrder,
        index: idx,
      });
    };

    if (import.meta.env.DEV) {
      (window as Window & { __izumiSeekTo?: (sec: number) => void }).__izumiSeekTo = (
        sec: number
      ) => {
        fallbackElapsedRef.current = sec;
        lastTickTimeRef.current = performance.now();
        try {
          const ytTime = playerRef.current?.getCurrentTime?.() || 0;
          if (ytTime > 0) {
            playerRef.current?.seekTo?.(sec, true);
          }
        } catch {
          // Ignore
        }
        syncCurrentTime(false);
      };
    }

    if (!isPlaying) {
      lastTickTimeRef.current = null;
      if (fallbackElapsedRef.current > 0 || (playerRef.current?.getCurrentTime?.() || 0) > 0) {
        syncCurrentTime(false);
      }
      return;
    }

    lastTickTimeRef.current = performance.now();
    syncCurrentTime(true);
    const timer = window.setInterval(() => syncCurrentTime(true), 100);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    isPlaying,
    isLyricsEnabled,
    lyricLines,
    activeCandidate,
    effectiveLyricOffset,
    activeIndex,
    playlistVideoIds,
    videoId,
    trackDuration,
    updateDisplayedLyricWithTransition,
  ]);

  // Lyrics Mode Rain Canvas Animation (requestAnimationFrame + visibilitychange + resize + reduced-motion)
  useEffect(() => {
    const canvas = rainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let rafId: number | null = null;
    let width = Math.max(1, window.innerWidth || 1280);
    let height = Math.max(1, window.innerHeight || 720);
    let rainScale = 1;
    let drops: RainDrop[] = [];
    let splashes: RainSplash[] = [];
    let lastFrameTime = performance.now();
    let fpsSampleFrames = 0;
    let fpsSampleStart = performance.now();

    const syncDropPool = (initialSpread: boolean) => {
      const reducedMotion = Boolean(motionQuery?.matches);
      if (reducedMotion) {
        drops = [];
        splashes = [];
        canvas.dataset.dropCount = '0';
        return;
      }

      const targetCount = getTargetRainDropCount(
        width,
        RAIN_DENSITY_DESKTOP,
        RAIN_DENSITY_MOBILE,
        rainScale
      );

      if (drops.length < targetCount) {
        const needed = targetCount - drops.length;
        for (let i = 0; i < needed; i += 1) {
          drops.push(createRainDrop(width, height, !initialSpread));
        }
      } else if (drops.length > targetCount) {
        drops.length = targetCount;
      }

      canvas.dataset.dropCount = String(drops.length);
    };

    const resizeCanvas = (initialSpread = false) => {
      width = Math.max(1, window.innerWidth || 1280);
      height = Math.max(1, window.innerHeight || 720);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      syncDropPool(initialSpread);
    };

    const stopLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      canvas.dataset.rainRunning = 'false';
    };

    const renderFrame = (now: number) => {
      if (!isLyricsEnabled || document.hidden || Boolean(motionQuery?.matches)) {
        stopLoop();
        return;
      }

      const rawDtMs = now - lastFrameTime;
      lastFrameTime = now;
      const frameFactor = Math.min(2.5, Math.max(0.25, rawDtMs / 16.667));

      // FPS monitoring every 90 frames to auto-scale rain density
      fpsSampleFrames += 1;
      if (fpsSampleFrames >= 90) {
        const avgFrameDeltaMs = (now - fpsSampleStart) / fpsSampleFrames;
        const nextScale = adjustRainScaleForFps(avgFrameDeltaMs, rainScale);
        if (nextScale !== rainScale) {
          rainScale = nextScale;
          syncDropPool(true);
        }
        fpsSampleFrames = 0;
        fpsSampleStart = now;
      }

      ctx.clearRect(0, 0, width, height);

      // Gentle slower fall when music is paused
      const speedMultiplier = (isPlayingRef.current ? 1 : 0.72) * frameFactor;

      ctx.lineCap = 'round';
      for (let i = 0; i < drops.length; i += 1) {
        const drop = drops[i];
        drop.x += drop.speedX * speedMultiplier;
        drop.y += drop.speedY * speedMultiplier;

        const slantX = (drop.speedX / drop.speedY) * drop.length;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(198, 216, 245, ${drop.opacity.toFixed(3)})`;
        ctx.lineWidth = drop.thickness;
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - slantX, drop.y - drop.length);
        ctx.stroke();

        if (drop.y >= height - 2) {
          // Subtle splash particles at the bottom of the viewport
          if (drop.z > 0.35 && splashes.length < 36 && Math.random() < 0.42) {
            splashes.push({
              x: drop.x,
              y: height - 2,
              vx: (Math.random() - 0.5) * 1.4,
              vy: -(0.8 + Math.random() * 1.2),
              radius: 0.75 + drop.z * 0.85,
              alpha: Math.min(0.28, drop.opacity * 0.9),
              maxLife: 18 + Math.random() * 10,
              life: 0,
            });
          }
          Object.assign(drop, createRainDrop(width, height, true));
        } else if (drop.x < -40) {
          drop.x = width + 20;
        }
      }

      // Draw and update subtle bottom splashes
      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        const sp = splashes[i];
        sp.life += frameFactor;
        if (sp.life >= sp.maxLife) {
          splashes.splice(i, 1);
          continue;
        }
        sp.x += sp.vx * frameFactor;
        sp.y += sp.vy * frameFactor;
        sp.vy += 0.08 * frameFactor;
        const fade = 1 - sp.life / sp.maxLife;
        ctx.beginPath();
        ctx.fillStyle = `rgba(205, 222, 248, ${(sp.alpha * fade).toFixed(3)})`;
        ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(renderFrame);
    };

    const startLoopIfEligible = () => {
      const reducedMotion = Boolean(motionQuery?.matches);
      if (!isLyricsEnabled || document.hidden || reducedMotion) {
        stopLoop();
        if (reducedMotion) {
          ctx.clearRect(0, 0, width, height);
          canvas.dataset.dropCount = '0';
        }
        return;
      }

      if (drops.length === 0) {
        syncDropPool(true);
      }

      if (rafId === null) {
        lastFrameTime = performance.now();
        fpsSampleFrames = 0;
        fpsSampleStart = lastFrameTime;
        canvas.dataset.rainRunning = 'true';
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    resizeCanvas(true);
    startLoopIfEligible();

    let resizeDebounceTimer: number | null = null;
    const handleResize = () => {
      if (resizeDebounceTimer !== null) {
        window.clearTimeout(resizeDebounceTimer);
      }
      resizeDebounceTimer = window.setTimeout(() => {
        resizeDebounceTimer = null;
        resizeCanvas(true);
        startLoopIfEligible();
      }, 120);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoopIfEligible();
      }
    };

    const handleMotionChange = () => {
      syncDropPool(true);
      startLoopIfEligible();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    motionQuery?.addEventListener?.('change', handleMotionChange);

    return () => {
      stopLoop();
      if (resizeDebounceTimer !== null) {
        window.clearTimeout(resizeDebounceTimer);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      motionQuery?.removeEventListener?.('change', handleMotionChange);
    };
  }, [isLyricsEnabled]);

  // Auto-scroll active track into view when playlist opens or activeIndex changes
  useEffect(() => {
    if (!isPlaylistOpen || !playlistListRef.current) return;
    const activeEl = playlistListRef.current.querySelector<HTMLElement>(
      `[data-track-index="${activeIndex}"]`
    );
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex, isPlaylistOpen, playlistVideoIds.length]);

  // Close playlist panel on click outside or Escape key
  useEffect(() => {
    if (!isPlaylistOpen) return;

    const handlePointerDown = (e: globalThis.MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (playlistPanelRef.current?.contains(target)) return;
      if (miniPlayerRef.current?.contains(target)) return;
      if (noticeRef.current?.contains(target)) return;
      setIsPlaylistOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsPlaylistOpen(false);
        playlistTriggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaylistOpen]);

  const clearPlaylistLoadingTimers = useCallback(() => {
    if (playlistPollRef.current !== null) {
      window.clearInterval(playlistPollRef.current);
      playlistPollRef.current = null;
    }
    if (playlistLoadTimeoutRef.current !== null) {
      window.clearTimeout(playlistLoadTimeoutRef.current);
      playlistLoadTimeoutRef.current = null;
    }
    if (errorSkipTimerRef.current !== null) {
      window.clearTimeout(errorSkipTimerRef.current);
      errorSkipTimerRef.current = null;
    }
  }, []);

  const startPlaylistDiscoveryPoll = useCallback(
    (
      player: YTPlayerInstance,
      options?: {
        targetVideoId?: string;
        hasExplicitIndex?: boolean;
        enforceSixSecondTimeout?: boolean;
      }
    ) => {
      clearPlaylistLoadingTimers();

      let matchedInitialVideo = false;
      const checkPlaylist = (): boolean => {
        if (!player || typeof player.getPlaylist !== 'function') return false;
        try {
          const list = player.getPlaylist();
          if (Array.isArray(list) && list.length > 0) {
            setPlaylistVideoIds((prev) => {
              if (prev.length === list.length && prev.every((id, i) => id === list[i])) {
                return prev;
              }
              return [...list];
            });
            setCustomLinkFeedback((prev) => (prev?.type === 'loading' ? null : prev));

            if (
              !matchedInitialVideo &&
              options?.targetVideoId &&
              !options?.hasExplicitIndex
            ) {
              matchedInitialVideo = true;
              const targetIdx = list.indexOf(options.targetVideoId);
              if (targetIdx > 0) {
                setActiveIndex(targetIdx);
                try {
                  player.playVideoAt(targetIdx);
                } catch {
                  // Ignore
                }
              }
            }
            return true;
          }
        } catch {
          // Ignore transient YT API error
        }
        return false;
      };

      const initialOk = checkPlaylist();
      if (initialOk && playlistLoadTimeoutRef.current !== null) {
        window.clearTimeout(playlistLoadTimeoutRef.current);
        playlistLoadTimeoutRef.current = null;
      }

      let attempts = 0;
      playlistPollRef.current = window.setInterval(() => {
        attempts += 1;
        const hasPlaylist = checkPlaylist();
        if (hasPlaylist) {
          if (playlistLoadTimeoutRef.current !== null) {
            window.clearTimeout(playlistLoadTimeoutRef.current);
            playlistLoadTimeoutRef.current = null;
          }
        }
        if (!userInitiatedPlayRef.current && sourceModeRef.current.type === 'default') {
          try {
            player.pauseVideo();
          } catch {
            // Ignore
          }
        }
        if ((hasPlaylist && attempts >= 2) || attempts >= 25) {
          if (playlistPollRef.current !== null) {
            window.clearInterval(playlistPollRef.current);
            playlistPollRef.current = null;
          }
        }
      }, 400);

      if (options?.enforceSixSecondTimeout) {
        playlistLoadTimeoutRef.current = window.setTimeout(() => {
          playlistLoadTimeoutRef.current = null;
          let currentList: string[] | null = null;
          try {
            currentList = player.getPlaylist?.() ?? null;
          } catch {
            currentList = null;
          }
          if (!Array.isArray(currentList) || currentList.length === 0) {
            setIsPlaying(false);
            setCustomLinkFeedback({
              type: 'error',
              text: NOTICE_MESSAGES.PLAYLIST_LOAD_TIMEOUT,
            });
            showNotice('playlist', NOTICE_MESSAGES.PLAYLIST_LOAD_TIMEOUT);
          }
        }, PLAYLIST_LOAD_TIMEOUT_MS);
      }
    },
    [clearPlaylistLoadingTimers, showNotice]
  );

  const handlePlayerErrorCode = useCallback(
    (errorCode: number) => {
      const errorMsg = resolvePlaybackErrorNotice(errorCode);
      const currentSource = sourceModeRef.current;

      if (isNonSkippablePlayerError(errorCode)) {
        setIsPlaying(false);
        setCustomLinkFeedback({ type: 'error', text: errorMsg });
        showNotice('playback', errorMsg);
        return;
      }

      if (currentSource.type === 'custom-video') {
        setIsPlaying(false);
        setCustomLinkFeedback({
          type: 'error',
          text: errorMsg,
        });
        showNotice('playback', errorMsg);
        return;
      }

      consecutiveErrorsRef.current += 1;
      const totalTracks = playlistVideoIdsRef.current.length;
      const maxSkips =
        totalTracks > 0
          ? Math.min(MAX_CONSECUTIVE_ERROR_SKIPS, totalTracks)
          : MAX_CONSECUTIVE_ERROR_SKIPS;

      if (consecutiveErrorsRef.current >= maxSkips) {
        setIsPlaying(false);
        if (errorSkipTimerRef.current !== null) {
          window.clearTimeout(errorSkipTimerRef.current);
          errorSkipTimerRef.current = null;
        }
        try {
          playerRef.current?.pauseVideo();
        } catch {
          // Ignore
        }
        setCustomLinkFeedback({
          type: 'error',
          text: NOTICE_MESSAGES.PLAYLIST_ALL_UNPLAYABLE,
        });
        showNotice('playlist', NOTICE_MESSAGES.PLAYLIST_ALL_UNPLAYABLE);
        return;
      }

      showNotice('playback', errorMsg);

      if (errorSkipTimerRef.current !== null) {
        window.clearTimeout(errorSkipTimerRef.current);
      }
      errorSkipTimerRef.current = window.setTimeout(() => {
        errorSkipTimerRef.current = null;
        const player = playerRef.current;
        if (!player || !userInitiatedPlayRef.current) return;
        try {
          player.nextVideo();
          scheduleMetadataSync(player, 250);
        } catch {
          // Ignore
        }
      }, ERROR_SKIP_DELAY_MS);
    },
    [scheduleMetadataSync, showNotice]
  );

  useEffect(() => {
    let isMounted = true;
    let scriptTimeout: number | null = null;

    const handleScriptFailure = () => {
      if (!isMounted) return;
      playerLoadFailedRef.current = true;
      setIsPlaying(false);
      showNotice('playback', NOTICE_MESSAGES.PLAYER_LOAD_FAILED);
    };

    if (import.meta.env.DEV) {
      window.__izumiTriggerPlayerError = (code: number) => {
        userInitiatedPlayRef.current = true;
        handlePlayerErrorCode(Number(code));
      };
    }

    const initPlayer = () => {
      if (!isMounted || !window.YT || !window.YT.Player || !playerContainerRef.current) {
        return;
      }
      if (playerRef.current) {
        return;
      }

      playerLoadFailedRef.current = false;
      if (scriptTimeout !== null) {
        window.clearTimeout(scriptTimeout);
        scriptTimeout = null;
      }

      const initialSource = sourceModeRef.current;
      const initialListId =
        initialSource.type === 'custom-playlist' ? initialSource.playlistId : playlistId;

      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        width: '320',
        height: '200',
        playerVars: {
          enablejsapi: 1,
          listType: 'playlist',
          list: initialListId,
          loop: 1,
          playsinline: 1,
          rel: 0,
          ...(window.location.protocol.startsWith('http')
            ? { origin: window.location.origin }
            : {}),
        },
        events: {
          onReady: (event) => {
            if (!isMounted) return;
            isReadyRef.current = true;
            if (import.meta.env.DEV) {
              window.__izumiPlayer = event.target;
            }
            const activeSource = sourceModeRef.current;

            try {
              if (activeSource.type === 'custom-video') {
                event.target.setLoop(false);
                if (typeof event.target.cueVideoById === 'function') {
                  event.target.cueVideoById(activeSource.videoId);
                } else {
                  event.target.loadVideoById(activeSource.videoId);
                  if (!userInitiatedPlayRef.current) {
                    event.target.pauseVideo();
                  }
                }
                setPlaylistVideoIds([activeSource.videoId]);
                setVideoId(activeSource.videoId);
                setActiveIndex(0);
              } else if (activeSource.type === 'custom-playlist') {
                event.target.loadPlaylist({
                  listType: 'playlist',
                  list: activeSource.playlistId,
                  ...(activeSource.initialIndex !== undefined
                    ? { index: activeSource.initialIndex }
                    : {}),
                });
                event.target.setLoop(true);
                if (!userInitiatedPlayRef.current) {
                  event.target.pauseVideo();
                }
                startPlaylistDiscoveryPoll(event.target, {
                  targetVideoId: activeSource.initialVideoId,
                  hasExplicitIndex: activeSource.initialIndex !== undefined,
                  enforceSixSecondTimeout: true,
                });
              } else {
                event.target.loadPlaylist({
                  listType: 'playlist',
                  list: playlistId,
                });
                event.target.setLoop(true);
                if (!userInitiatedPlayRef.current) {
                  event.target.pauseVideo();
                }
                startPlaylistDiscoveryPoll(event.target, {
                  enforceSixSecondTimeout: false,
                });
              }
            } catch {
              // Ignore if loadPlaylist fails
            }
          },
          onStateChange: (event) => {
            if (!isMounted) return;
            const state = event.data;
            const activeSource = sourceModeRef.current;

            try {
              event.target.setLoop(activeSource.type !== 'custom-video');
            } catch {
              // Ignore
            }

            if (!userInitiatedPlayRef.current && activeSource.type === 'default') {
              syncPlaylistIdsFromPlayer(event.target);
              if (state === 1 || state === 3) {
                try {
                  event.target.pauseVideo();
                } catch {
                  // Ignore
                }
              }
              setIsPlaying(false);
              return;
            }

            syncMetadataFromPlayer(event.target);

            // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3, CUED = 5
            if (state === 1) {
              consecutiveErrorsRef.current = 0;
              setIsPlaying(true);
              dismissNoticeByCategory('playback');
              setCustomLinkFeedback((prev) => (prev?.type === 'loading' ? null : prev));
            } else if (state === 2) {
              setIsPlaying(false);
            } else if (state === 0) {
              // Fade out lyrics when song finishes
              updateDisplayedLyricWithTransition(null);
              if (activeSource.type === 'custom-video') {
                // Single custom video stops when finished (does not loop)
                setIsPlaying(false);
              } else {
                const target = event.target;
                let endedIdx = -1;
                try {
                  endedIdx = target.getPlaylistIndex();
                } catch {
                  /* ignore */
                }
                if (endedTimerRef.current !== null) window.clearTimeout(endedTimerRef.current);
                endedTimerRef.current = window.setTimeout(() => {
                  endedTimerRef.current = null;
                  if (sourceModeRef.current.type === 'custom-video') return;
                  try {
                    // Hanya maju manual jika player benar-benar macet di lagu yang sama.
                    if (target.getPlayerState() === 0 && target.getPlaylistIndex() === endedIdx) {
                      target.nextVideo();
                    }
                  } catch {
                    /* ignore */
                  }
                }, 800);
              }
            }
          },
          onError: (event) => {
            if (!isMounted) return;
            if (!userInitiatedPlayRef.current && sourceModeRef.current.type === 'default') {
              return;
            }
            const errorCode = Number(event?.data);
            handlePlayerErrorCode(errorCode);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') {
          prevCallback();
        }
        initPlayer();
      };

      scriptTimeout = window.setTimeout(() => {
        if (!window.YT?.Player) handleScriptFailure();
      }, PLAYER_SCRIPT_TIMEOUT_MS);

      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        tag.onerror = handleScriptFailure;
        document.head.appendChild(tag);
      }
    }

    return () => {
      isMounted = false;
      if (import.meta.env.DEV) {
        delete window.__izumiTriggerPlayerError;
      }
      if (scriptTimeout !== null) {
        clearTimeout(scriptTimeout);
      }
      if (endedTimerRef.current !== null) {
        clearTimeout(endedTimerRef.current);
      }
      if (metadataTimerRef.current !== null) {
        clearTimeout(metadataTimerRef.current);
      }
      clearPlaylistLoadingTimers();
      if (noticeTimerRef.current !== null) {
        clearTimeout(noticeTimerRef.current);
      }
      if (exitLyricTimerRef.current !== null) {
        clearTimeout(exitLyricTimerRef.current);
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore
        }
        playerRef.current = null;
      }
    };
  }, [
    clearPlaylistLoadingTimers,
    dismissNoticeByCategory,
    handlePlayerErrorCode,
    playlistId,
    showNotice,
    startPlaylistDiscoveryPoll,
    syncMetadataFromPlayer,
    syncPlaylistIdsFromPlayer,
    updateDisplayedLyricWithTransition,
  ]);

  const handleCustomLinkSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const parsed = parseCustomYouTubeUrl(customLinkInput);
    if (!parsed.ok) {
      setCustomLinkFeedback({
        type: 'error',
        text: parsed.errorMessage,
      });
      showNotice('playlist', parsed.errorMessage);
      return;
    }

    if (!ensurePlayerAvailable()) return;

    clearPlaylistLoadingTimers();
    consecutiveErrorsRef.current = 0;
    userInitiatedPlayRef.current = true;
    notifiedLyricTracksRef.current.clear();

    setLyricLines([]);
    setLyricIssueStatus(null);
    setTrackDuration(0);
    updateDisplayedLyricWithTransition(null);
    dismissNotice();

    setCustomLinkFeedback({
      type: 'loading',
      text: 'Memuat...',
    });

    writeSavedCustomLink(parsed.normalizedUrl);

    const player = playerRef.current;

    if (parsed.sourceType === 'video') {
      const nextMode: PlayerSourceMode = {
        type: 'custom-video',
        videoId: parsed.videoId,
        rawUrl: parsed.normalizedUrl,
      };
      sourceModeRef.current = nextMode;
      setSourceMode(nextMode);
      setPlaylistVideoIds([parsed.videoId]);
      setActiveIndex(0);
      setVideoId(parsed.videoId);
      setImgError(false);
      setIsPlaying(true);

      const cachedMeta = trackMetaMap[parsed.videoId];
      if (cachedMeta && cachedMeta.status === 'loaded') {
        setTrackTitle(cachedMeta.title);
        setTrackArtist(cachedMeta.artist);
        setCustomLinkFeedback(null);
      } else {
        setTrackTitle('Memuat lagu...');
        setTrackArtist('YouTube Music');
      }

      if (player && isReadyRef.current) {
        try {
          player.setLoop(false);
          player.loadVideoById(parsed.videoId, parsed.startSeconds);
          window.setTimeout(() => {
            syncMetadataFromPlayer(player);
            setCustomLinkFeedback((prev) => (prev?.type === 'loading' ? null : prev));
          }, 500);
        } catch {
          // Ignore
        }
      } else {
        window.setTimeout(() => {
          setCustomLinkFeedback((prev) => (prev?.type === 'loading' ? null : prev));
        }, 600);
      }
      return;
    }

    const nextMode: PlayerSourceMode = {
      type: 'custom-playlist',
      playlistId: parsed.playlistId,
      initialVideoId: parsed.videoId,
      initialIndex: parsed.index,
      rawUrl: parsed.normalizedUrl,
    };
    sourceModeRef.current = nextMode;
    setSourceMode(nextMode);
    setPlaylistVideoIds([]);
    setActiveIndex(parsed.index ?? 0);
    if (parsed.videoId) {
      setVideoId(parsed.videoId);
      setImgError(false);
    }
    setIsPlaying(true);

    if (player && isReadyRef.current) {
      try {
        player.loadPlaylist({
          listType: 'playlist',
          list: parsed.playlistId,
          ...(parsed.index !== undefined ? { index: parsed.index } : {}),
          ...(parsed.startSeconds !== undefined ? { startSeconds: parsed.startSeconds } : {}),
        });
        player.setLoop(true);
        startPlaylistDiscoveryPoll(player, {
          targetVideoId: parsed.videoId,
          hasExplicitIndex: parsed.index !== undefined,
          enforceSixSecondTimeout: true,
        });
      } catch {
        setCustomLinkFeedback({
          type: 'error',
          text: NOTICE_MESSAGES.PLAYLIST_LOAD_TIMEOUT,
        });
        showNotice('playlist', NOTICE_MESSAGES.PLAYLIST_LOAD_TIMEOUT);
      }
    } else {
      // If YT IFrame API is still initializing or blocked, enforce timeout check
      playlistLoadTimeoutRef.current = window.setTimeout(() => {
        playlistLoadTimeoutRef.current = null;
        if (playlistVideoIdsRef.current.length === 0) {
          setIsPlaying(false);
          setCustomLinkFeedback({
            type: 'error',
            text: NOTICE_MESSAGES.PLAYLIST_LOAD_TIMEOUT,
          });
          showNotice('playlist', NOTICE_MESSAGES.PLAYLIST_LOAD_TIMEOUT);
        }
      }, PLAYLIST_LOAD_TIMEOUT_MS);
    }
  };

  const handleReturnToDefaultPlaylist = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    clearPlaylistLoadingTimers();
    consecutiveErrorsRef.current = 0;
    notifiedLyricTracksRef.current.clear();

    writeSavedCustomLink(null);
    setCustomLinkInput('');
    setCustomLinkFeedback(null);
    dismissNotice();

    setLyricLines([]);
    setLyricIssueStatus(null);
    setTrackDuration(0);
    updateDisplayedLyricWithTransition(null);

    const nextMode: PlayerSourceMode = { type: 'default' };
    sourceModeRef.current = nextMode;
    setSourceMode(nextMode);
    setPlaylistVideoIds([]);
    setActiveIndex(0);
    setTrackTitle(defaultTitle);
    setTrackArtist(defaultArtist);

    const player = playerRef.current;
    if (player && isReadyRef.current) {
      try {
        player.loadPlaylist({
          listType: 'playlist',
          list: playlistId,
        });
        player.setLoop(true);
        if (!userInitiatedPlayRef.current) {
          player.pauseVideo();
          setIsPlaying(false);
        } else {
          setIsPlaying(true);
        }
        startPlaylistDiscoveryPoll(player, {
          enforceSixSecondTimeout: false,
        });
      } catch {
        // Ignore
      }
    }
  };

  const handleTogglePlaylist = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsPlaylistOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsVideoPanelOpen(false);
        if (playerRef.current) {
          syncPlaylistIdsFromPlayer(playerRef.current);
        }
      }
      return next;
    });
  };

  const handleToggleLyrics = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsLyricsEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(LYRICS_ENABLED_KEY, String(next));
      } catch {
        // Ignore storage error
      }
      if (!next) {
        updateDisplayedLyricWithTransition(null);
      }
      return next;
    });
  };

  const handleToggleVersionList = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsVersionListOpen((prev) => !prev);
  };

  const handleOpenVersionListFromNotice = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsVideoPanelOpen(false);
    setIsPlaylistOpen(true);
    setIsVersionListOpen(true);
    dismissNotice();
  };

  const handleSelectLyricCandidate = (candidate: LyricCandidateOption) => {
    if (!lyricVideoId) return;
    setManualLyricMap((prev) => {
      const next = {
        ...prev,
        [lyricVideoId]: candidate,
      };
      writeManualLyricVersions(next);
      return next;
    });
    if (!isLyricsEnabled) {
      setIsLyricsEnabled(true);
      try {
        window.localStorage.setItem(LYRICS_ENABLED_KEY, 'true');
      } catch {
        // Ignore
      }
    }
  };

  const handleResetManualLyricVersion = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!lyricVideoId) return;
    setManualLyricMap((prev) => {
      if (!(lyricVideoId in prev)) return prev;
      const next = { ...prev };
      delete next[lyricVideoId];
      writeManualLyricVersions(next);
      return next;
    });
  };

  const handleAdjustLyricOffset = (deltaSec: number) => {
    if (!lyricVideoId) return;
    setLyricOffsetMap((prev) => {
      const current = prev[lyricVideoId] ?? 0;
      const updated = Math.max(-60, Math.min(60, Math.round((current + deltaSec) * 10) / 10));
      const next = { ...prev };
      if (Math.abs(updated) < 0.05) {
        delete next[lyricVideoId];
      } else {
        next[lyricVideoId] = updated;
      }
      writeLyricOffsets(next);
      return next;
    });
  };

  const handleResetLyricOffset = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!lyricVideoId) return;
    setLyricOffsetMap((prev) => {
      if (!(lyricVideoId in prev)) return prev;
      const next = { ...prev };
      delete next[lyricVideoId];
      writeLyricOffsets(next);
      return next;
    });
  };

  const handleSelectTrack = (index: number) => {
    if (!ensurePlayerAvailable()) return;
    userInitiatedPlayRef.current = true;
    consecutiveErrorsRef.current = 0;
    updateDisplayedLyricWithTransition(null);
    setActiveIndex(index);
    setIsPlaying(true);

    const selectedVid = playlistVideoIds[index];
    if (selectedVid) {
      setVideoId(selectedVid);
      setImgError(false);
      const meta = trackMetaMap[selectedVid];
      if (meta) {
        setTrackTitle(meta.title);
        setTrackArtist(meta.artist);
      }
    }

    const player = playerRef.current;
    if (player && isReadyRef.current) {
      try {
        if (sourceModeRef.current.type === 'custom-video' && selectedVid) {
          player.loadVideoById(selectedVid);
        } else {
          player.playVideoAt(index);
        }
        scheduleMetadataSync(player, 250);
      } catch {
        // Ignore
      }
    }
  };

  const handleTogglePlay = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const player = playerRef.current;

    if (isPlaying) {
      setIsPlaying(false);
      if (player && isReadyRef.current) {
        try {
          player.pauseVideo();
        } catch {
          // Ignore
        }
      }
    } else {
      if (!ensurePlayerAvailable()) return;
      userInitiatedPlayRef.current = true;
      setIsPlaying(true);
      if (player && isReadyRef.current) {
        try {
          player.playVideo();
          syncMetadataFromPlayer(player);
        } catch {
          // Ignore
        }
      }
    }
  };

  const handlePrevious = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!ensurePlayerAvailable()) return;
    userInitiatedPlayRef.current = true;
    consecutiveErrorsRef.current = 0;
    updateDisplayedLyricWithTransition(null);
    setIsPlaying(true);
    if (playlistVideoIds.length > 0) {
      setActiveIndex((prev) => (prev - 1 + playlistVideoIds.length) % playlistVideoIds.length);
    }
    const player = playerRef.current;
    if (player && isReadyRef.current) {
      try {
        if (sourceModeRef.current.type === 'custom-video') {
          player.seekTo(0, true);
          player.playVideo();
        } else {
          player.previousVideo();
        }
        scheduleMetadataSync(player, 250);
      } catch {
        // Ignore
      }
    }
  };

  const handleNext = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!ensurePlayerAvailable()) return;
    userInitiatedPlayRef.current = true;
    consecutiveErrorsRef.current = 0;
    updateDisplayedLyricWithTransition(null);
    setIsPlaying(true);
    if (playlistVideoIds.length > 0) {
      setActiveIndex((prev) => (prev + 1) % playlistVideoIds.length);
    }
    const player = playerRef.current;
    if (player && isReadyRef.current) {
      try {
        if (sourceModeRef.current.type === 'custom-video') {
          player.seekTo(0, true);
          player.playVideo();
        } else {
          player.nextVideo();
        }
        scheduleMetadataSync(player, 250);
      } catch {
        // Ignore
      }
    }
  };

  const handleToggleVideoPanel = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsVideoPanelOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsPlaylistOpen(false);
      }
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--lyrics-mode-dim-opacity',
      String(DIM_OPACITY)
    );
    document.documentElement.style.setProperty('--lyric-glow-color', LYRIC_GLOW_COLOR);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.lyricsMode = isLyricsEnabled ? 'on' : 'off';
  }, [isLyricsEnabled]);

  useEffect(() => {
    window.__izumiSetDebugMode = (enabled: boolean) => {
      const next = Boolean(enabled);
      setIsDebugMode(next);
      try {
        if (next) {
          window.localStorage.setItem(DEBUG_MODE_STORAGE_KEY, '1');
        } else {
          window.localStorage.removeItem(DEBUG_MODE_STORAGE_KEY);
        }
      } catch {
        // Ignore
      }
    };
    const handleLocationChange = () => {
      setIsDebugMode(readInitialDebugMode());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      delete window.__izumiSetDebugMode;
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    const el = playlistPanelRef.current;
    if (!isPlaylistOpen || !el) return;
    const update = () => setPanelHeight(el.offsetHeight);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPlaylistOpen, isVersionListOpen, sortedCandidates.length, isDebugMode]);

  const coverUrl = getYouTubeThumbnailUrl(videoId, albumArtSrc);
  const playlistHeadingText =
    sourceMode.type === 'custom-playlist'
      ? 'Playlist kamu'
      : sourceMode.type === 'custom-video'
        ? 'Lagu pilihanmu'
        : 'Izumi After Midnight';
  const externalUrl = sourceMode.type === 'default' ? playlistUrl : sourceMode.rawUrl;
  const externalLabel =
    sourceMode.type === 'default' ? 'Playlist YouTube Music' : 'Buka di YouTube';
  const hasLyricIssueBadge = lyricIssueStatus !== null;
  const lyricIssueTooltip = lyricIssueStatus ? resolveLyricStatusNotice(lyricIssueStatus) : null;
  const formattedSongOffset =
    currentSongOffset === 0
      ? '0s'
      : `${currentSongOffset > 0 ? '+' : ''}${currentSongOffset.toFixed(1).replace(/\.0$/, '')}s`;

  return (
    <>
      <div
        className={`lyrics-mode-dim${isLyricsEnabled ? ' is-active' : ''}`}
        id="lyrics-mode-dim"
        aria-hidden="true"
        data-lyrics-mode={isLyricsEnabled ? 'active' : 'inactive'}
        data-dim-opacity={DIM_OPACITY}
      />

      <canvas
        ref={rainCanvasRef}
        className={`lyrics-mode-rain${isLyricsEnabled ? ' is-active' : ''}`}
        id="lyrics-mode-rain"
        aria-hidden="true"
      />

      {!isInlineLyricViewport && (
        <div
          className={`bg-lyrics-layer${isLyricsEnabled ? ' is-lyrics-mode' : ''}${
            isPlaying ? ' is-playing' : ' is-paused'
          }`}
          id="bg-lyrics-layer"
          aria-hidden="true"
          data-lyrics-enabled={isLyricsEnabled ? 'true' : 'false'}
          data-lyrics-loaded={lyricLines.length > 0 ? 'true' : 'false'}
          data-is-playing={isPlaying ? 'true' : 'false'}
          data-glow-color={LYRIC_GLOW_COLOR}
        >
          {exitingLyric && (
            <div
              key={`exit-${exitingLyric.key}`}
              className={`bg-lyric-line is-${exitingLyric.side} is-exiting`}
              data-lyric-side={exitingLyric.side}
            >
              {exitingLyric.text}
            </div>
          )}
          {isLyricsEnabled && displayedLyric && (
            <div
              key={`active-${displayedLyric.key}`}
              className={`bg-lyric-line is-${displayedLyric.side} is-active${
                isPlaying ? ' is-playing' : ' is-paused'
              }`}
              data-lyric-side={displayedLyric.side}
              data-lyric-order={displayedLyric.displayOrder}
            >
              {displayedLyric.text}
            </div>
          )}
        </div>
      )}

      {activeNotice && (
        <div
          ref={noticeRef}
          key={activeNotice.id}
          className={`mp-notice is-${activeNotice.category}${
            isPlaylistOpen ? ' is-above-panel' : ''
          }`}
          id="mp-notice"
          role="status"
          aria-live="polite"
          data-notice-category={activeNotice.category}
          style={isPlaylistOpen ? ({ '--mp-panel-h': `${panelHeight}px` } as CSSProperties) : undefined}
        >
          <Info className="mp-notice-icon" aria-hidden="true" />
          <div className="mp-notice-body">
            <span className="mp-notice-text">{activeNotice.message}</span>
            {activeNotice.actionLabel && (
              <button
                type="button"
                id="mp-notice-action-btn"
                className="mp-notice-action-btn"
                onClick={handleOpenVersionListFromNotice}
              >
                {activeNotice.actionLabel}
              </button>
            )}
          </div>
          <button
            type="button"
            className="mp-notice-close"
            id="mp-notice-close"
            onClick={dismissNotice}
            aria-label="Tutup pemberitahuan"
          >
            <X className="mp-notice-close-icon" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Panel kecil YouTube IFrame Player (tidak pernah display:none atau visibility:hidden) */}
      <div
        className={`mp-yt-panel${isVideoPanelOpen ? ' is-open' : ''}`}
        id="mp-yt-panel"
        role="region"
        aria-label="YouTube Music Playlist Player"
      >
        <div className="mp-yt-panel-header">
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mp-yt-panel-link"
            aria-label={
              sourceMode.type === 'default' ? 'Open Playlist on YouTube Music' : 'Buka di YouTube'
            }
          >
            <span>{externalLabel}</span>
            <ExternalLink className="mp-yt-panel-ext" aria-hidden="true" />
          </a>
          <button
            type="button"
            className="mp-yt-panel-close"
            onClick={() => setIsVideoPanelOpen(false)}
            aria-label="Tutup Panel Player"
          >
            <X className="mp-yt-panel-close-icon" aria-hidden="true" />
          </button>
        </div>
        <div className="mp-yt-iframe-wrap">
          <div id={playerDomId} ref={playerContainerRef} />
        </div>
      </div>

      <div
        ref={playlistPanelRef}
        className={`mp-playlist-panel${isPlaylistOpen ? ' is-open' : ''}`}
        id="mp-playlist-panel"
        role="region"
        aria-label={`Daftar Lagu ${playlistHeadingText}`}
        aria-hidden={!isPlaylistOpen}
      >
        <div className="mp-playlist-header">
          <div className="mp-playlist-header-info">
            <span className="mp-playlist-heading" id="mp-playlist-heading">
              {playlistHeadingText}
            </span>
            <span className="mp-playlist-count" id="mp-playlist-count">
              {playlistVideoIds.length} lagu
            </span>
          </div>
          <div className="mp-playlist-header-actions">
            <button
              type="button"
              className={`mp-playlist-lyrics-btn${isLyricsEnabled ? ' is-active' : ''}${
                hasLyricIssueBadge ? ' has-lyric-issue' : ''
              }`}
              onClick={handleToggleLyrics}
              aria-label={isLyricsEnabled ? 'Matikan Lyrics Mode' : 'Nyalakan Lyrics Mode'}
              aria-pressed={isLyricsEnabled}
              title={
                lyricIssueTooltip
                  ? `Lyrics Mode (${lyricIssueTooltip})`
                  : isLyricsEnabled
                    ? 'Lyrics Mode: Aktif'
                    : 'Lyrics Mode: Nonaktif'
              }
              tabIndex={isPlaylistOpen ? 0 : -1}
            >
              <MessageSquareQuote className="mp-playlist-lyrics-icon" aria-hidden="true" />
              <span>Lyrics Mode</span>
              {hasLyricIssueBadge && (
                <span
                  className="mp-lyrics-issue-badge"
                  data-testid="lyrics-issue-badge-panel"
                  aria-hidden="true"
                >
                  !
                </span>
              )}
            </button>
            <button
              type="button"
              className="mp-playlist-close"
              onClick={() => setIsPlaylistOpen(false)}
              aria-label="Tutup daftar lagu"
              tabIndex={isPlaylistOpen ? 0 : -1}
            >
              <X className="mp-playlist-close-icon" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className="mp-lyric-controls-panel"
          id="mp-lyric-controls-panel"
          role="group"
          aria-label="Panel Kontrol Lirik"
        >
          <div className="mp-lyric-controls-bar">
            <div className="mp-lyric-version-actions">
              <button
                type="button"
                id="mp-lyric-version-btn"
                className={`mp-lyric-version-btn${isVersionListOpen ? ' is-open' : ''}${
                  isManualOverride ? ' is-manual' : ''
                }`}
                onClick={handleToggleVersionList}
                aria-expanded={isVersionListOpen}
                aria-controls="mp-lyric-version-list"
                tabIndex={isPlaylistOpen ? 0 : -1}
              >
                <span>Versi lirik</span>
                {sortedCandidates.length > 0 && (
                  <span className="mp-lyric-version-count" aria-hidden="true">
                    {sortedCandidates.length}
                  </span>
                )}
              </button>
              {isManualOverride && (
                <button
                  type="button"
                  id="mp-lyric-auto-btn"
                  className="mp-lyric-auto-btn"
                  onClick={handleResetManualLyricVersion}
                  tabIndex={isPlaylistOpen ? 0 : -1}
                  title="Hapus pilihan manual dan kembali ke pemilihan lirik otomatis"
                >
                  Kembali otomatis
                </button>
              )}
            </div>

            <div className="mp-lyric-offset-group" role="group" aria-label="Penyesuaian waktu lirik">
              <button
                type="button"
                id="mp-lyric-offset-m2"
                className="mp-lyric-offset-btn"
                onClick={() => handleAdjustLyricOffset(-2)}
                aria-label="Offset lirik -2 detik"
                tabIndex={isPlaylistOpen ? 0 : -1}
              >
                -2s
              </button>
              <button
                type="button"
                id="mp-lyric-offset-m05"
                className="mp-lyric-offset-btn"
                onClick={() => handleAdjustLyricOffset(-0.5)}
                aria-label="Offset lirik -0.5 detik"
                tabIndex={isPlaylistOpen ? 0 : -1}
              >
                -0.5s
              </button>
              <button
                type="button"
                id="mp-lyric-offset-reset"
                className={`mp-lyric-offset-val${currentSongOffset !== 0 ? ' is-adjusted' : ''}`}
                onClick={handleResetLyricOffset}
                aria-label={`Offset lirik saat ini ${formattedSongOffset}, klik untuk reset`}
                title="Klik untuk mereset offset lirik ke 0s"
                tabIndex={isPlaylistOpen ? 0 : -1}
              >
                {formattedSongOffset}
              </button>
              <button
                type="button"
                id="mp-lyric-offset-p05"
                className="mp-lyric-offset-btn"
                onClick={() => handleAdjustLyricOffset(0.5)}
                aria-label="Offset lirik +0.5 detik"
                tabIndex={isPlaylistOpen ? 0 : -1}
              >
                +0.5s
              </button>
              <button
                type="button"
                id="mp-lyric-offset-p2"
                className="mp-lyric-offset-btn"
                onClick={() => handleAdjustLyricOffset(2)}
                aria-label="Offset lirik +2 detik"
                tabIndex={isPlaylistOpen ? 0 : -1}
              >
                +2s
              </button>
            </div>
          </div>

          {isVersionListOpen && (
            <div
              className="mp-lyric-version-list-wrap"
              id="mp-lyric-version-list"
              role="region"
              aria-label="Daftar kandidat versi lirik"
            >
              <div className="mp-lyric-version-list-header">
                <span className="mp-lyric-version-list-title">
                  {isManualOverride ? 'Versi dipilih manual' : 'Pemilihan otomatis aktif'}
                </span>
                {isManualOverride && (
                  <button
                    type="button"
                    id="mp-lyric-list-auto-btn"
                    className="mp-lyric-auto-btn"
                    onClick={handleResetManualLyricVersion}
                    tabIndex={isPlaylistOpen ? 0 : -1}
                  >
                    Kembali otomatis
                  </button>
                )}
              </div>
              {sortedCandidates.length === 0 ? (
                <div className="mp-lyric-version-empty">
                  Belum ada kandidat lirik sinkron untuk lagu ini.
                </div>
              ) : (
                <div className="mp-lyric-version-items">
                  {sortedCandidates.map((cand) => {
                    const isSelected =
                      activeCandidate !== null && String(activeCandidate.id) === String(cand.id);
                    const labelText = formatLyricCandidateLabel(cand);
                    const diffText =
                      trackDuration > 0
                        ? formatDurationDiffSigned(cand.duration, trackDuration)
                        : formatDurationMmSs(cand.duration);
                    return (
                      <button
                        key={String(cand.id)}
                        type="button"
                        className={`mp-lyric-candidate-btn${isSelected ? ' is-selected' : ''}`}
                        onClick={() => handleSelectLyricCandidate(cand)}
                        aria-current={isSelected ? 'true' : undefined}
                        tabIndex={isPlaylistOpen ? 0 : -1}
                      >
                        <span className="mp-lyric-candidate-label" title={labelText}>
                          {labelText}
                        </span>
                        <span className="mp-lyric-candidate-meta">
                          <span className="mp-lyric-candidate-diff">{diffText}</span>
                          {isSelected && (
                            <span className="mp-lyric-candidate-active-tag">Dipakai</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isDebugMode && (
            <div
              className="mp-lyric-debug"
              id="mp-lyric-debug"
              data-testid="lyric-debug-info"
            >
              <span>
                Durasi video: {trackDuration > 0 ? `${formatDurationMmSs(trackDuration)} (${trackDuration}s)` : '0:00 (0s)'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Durasi lirik terpilih:{' '}
                {activeCandidate
                  ? `${formatDurationMmSs(activeCandidate.duration)} (${activeCandidate.duration}s)`
                  : '-'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Jumlah kandidat: {sortedCandidates.length}</span>
            </div>
          )}
        </div>

        <div className="mp-custom-link-section">
          <form className="mp-custom-link-form" onSubmit={handleCustomLinkSubmit} noValidate>
            <input
              type="text"
              id="mp-custom-link-input"
              className="mp-custom-link-input"
              placeholder="Tempel link lagu atau playlist YouTube / YouTube Music"
              aria-label="Tempel link lagu atau playlist YouTube / YouTube Music"
              value={customLinkInput}
              onChange={(e) => {
                setCustomLinkInput(e.target.value);
                if (customLinkFeedback?.type === 'error') {
                  setCustomLinkFeedback(null);
                }
              }}
              tabIndex={isPlaylistOpen ? 0 : -1}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              id="mp-custom-link-submit"
              className="mp-custom-link-btn"
              tabIndex={isPlaylistOpen ? 0 : -1}
            >
              Putar
            </button>
          </form>

          <div
            className="mp-custom-link-meta"
            id="mp-custom-link-status"
            aria-live="polite"
          >
            {customLinkFeedback && (
              <span
                className={`mp-custom-link-status is-${customLinkFeedback.type}`}
                data-status-type={customLinkFeedback.type}
              >
                {customLinkFeedback.text}
              </span>
            )}
            {sourceMode.type !== 'default' && (
              <button
                type="button"
                id="mp-reset-playlist-btn"
                className="mp-reset-playlist-btn"
                onClick={handleReturnToDefaultPlaylist}
                tabIndex={isPlaylistOpen ? 0 : -1}
              >
                <RotateCcw className="mp-reset-playlist-icon" aria-hidden="true" />
                <span>Kembali ke playlist Izumi</span>
              </button>
            )}
          </div>
        </div>

        <div className="mp-playlist-list" id="mp-playlist-list" ref={playlistListRef}>
          {playlistVideoIds.length === 0 ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={`skeleton-${idx}`} className="mp-playlist-row-skeleton" aria-hidden="true">
                <span className="mp-skel-num" />
                <span className="mp-skel-thumb" />
                <span className="mp-skel-text">
                  <span className="mp-skel-title" />
                  <span className="mp-skel-artist" />
                </span>
              </div>
            ))
          ) : (
            playlistVideoIds.map((vid, idx) => {
              const meta = trackMetaMap[vid];
              const isLoading = !meta || meta.status === 'loading';
              const isActive = idx === activeIndex;
              const displayTitle = meta?.title || `Lagu ${idx + 1}`;
              const displayArtist = meta?.artist || defaultArtist;
              const thumbUrl = getYouTubeDefaultThumbnailUrl(vid, albumArtSrc);
              const thumbFailed = Boolean(failedThumbIds[vid]);

              return (
                <button
                  key={`${vid}-${idx}`}
                  type="button"
                  data-track-index={idx}
                  className={`mp-playlist-item${isActive ? ' is-active' : ''}${
                    isActive && isPlaying ? ' is-playing' : ''
                  }`}
                  onClick={() => handleSelectTrack(idx)}
                  aria-label={`Putar lagu ${idx + 1}: ${displayTitle} - ${displayArtist}`}
                  aria-current={isActive ? 'true' : undefined}
                  tabIndex={isPlaylistOpen ? 0 : -1}
                >
                  <span className="mp-playlist-index" aria-hidden="true">
                    {isActive ? (
                      <span
                        className={`mp-item-eq${isPlaying ? ' is-animating' : ''}`}
                        data-testid="active-track-eq"
                      >
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      <span className="mp-item-num">{idx + 1}</span>
                    )}
                  </span>

                  <span className="mp-playlist-thumb-wrap" aria-hidden="true">
                    {!thumbFailed ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        className="mp-playlist-thumb"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedThumbIds((prev) => ({ ...prev, [vid]: true }))
                        }
                      />
                    ) : (
                      <span className="mp-playlist-thumb mp-playlist-thumb-fallback" />
                    )}
                  </span>

                  {isLoading ? (
                    <span className="mp-skel-text" aria-hidden="true">
                      <span className="mp-skel-title" />
                      <span className="mp-skel-artist" />
                    </span>
                  ) : (
                    <span className="mp-playlist-meta">
                      <span className="mp-playlist-item-title" title={displayTitle}>
                        {displayTitle}
                      </span>
                      <span className="mp-playlist-item-artist" title={displayArtist}>
                        {displayArtist}
                      </span>
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div
        ref={miniPlayerRef}
        className={`music-player${isPlaying ? ' is-playing' : ''}${
          isPlaylistOpen ? ' is-playlist-open' : ''
        }`}
        id="music-player"
        aria-label="Music Player"
      >
        <button
          ref={playlistTriggerRef}
          type="button"
          className="mp-playlist-trigger"
          id="mp-playlist-trigger"
          aria-label={
            isPlaylistOpen
              ? `Tutup playlist ${playlistHeadingText}`
              : `Buka playlist ${playlistHeadingText}`
          }
          aria-expanded={isPlaylistOpen}
          aria-controls="mp-playlist-panel"
          onClick={handleTogglePlaylist}
        >
          <span className="mp-btn" id="mp-btn" aria-hidden="true">
            {!imgError ? (
              <img
                src={coverUrl}
                alt=""
                className="mp-album-art"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="mp-album-art mp-album-art-fallback" />
            )}
            <svg
              id="icon-play"
              viewBox="0 0 24 24"
              style={{ display: isPlaying ? 'none' : 'block' }}
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg
              id="icon-pause"
              viewBox="0 0 24 24"
              style={{ display: isPlaying ? 'block' : 'none' }}
            >
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </span>

          <span className="mp-info">
            <span className="mp-title-row">
              <span className="mp-title" title={trackTitle}>
                {trackTitle}
              </span>
              <ChevronUp
                className={`mp-trigger-chevron${isPlaylistOpen ? ' is-open' : ''}`}
                aria-hidden="true"
              />
            </span>
            <span className="mp-artist" title={trackArtist}>
              {trackArtist}
            </span>
          </span>
        </button>

        <div className="mp-controls" role="group" aria-label="Kontrol Pemutar Musik">
          <button
            type="button"
            className="mp-ctrl-btn"
            id="mp-prev"
            aria-label="Lagu Sebelumnya"
            disabled={sourceMode.type === 'custom-video'}
            title={sourceMode.type === 'custom-video' ? 'Hanya satu lagu' : undefined}
            onClick={handlePrevious}
          >
            <SkipBack aria-hidden="true" />
          </button>
          <button
            type="button"
            className="mp-ctrl-btn mp-ctrl-play"
            id="mp-play-pause"
            aria-label={isPlaying ? 'Jeda Lagu' : 'Putar Lagu'}
            onClick={handleTogglePlay}
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="mp-ctrl-btn"
            id="mp-next"
            aria-label="Lagu Berikutnya"
            disabled={sourceMode.type === 'custom-video'}
            title={sourceMode.type === 'custom-video' ? 'Hanya satu lagu' : undefined}
            onClick={handleNext}
          >
            <SkipForward aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`mp-ctrl-btn mp-lyrics-btn${isLyricsEnabled ? ' is-active' : ''}${
              hasLyricIssueBadge ? ' has-lyric-issue' : ''
            }`}
            id="mp-lyrics-toggle"
            aria-label={isLyricsEnabled ? 'Matikan Lyrics Mode' : 'Nyalakan Lyrics Mode'}
            aria-pressed={isLyricsEnabled}
            title={
              lyricIssueTooltip
                ? `Lyrics Mode (${lyricIssueTooltip})`
                : isLyricsEnabled
                  ? 'Lyrics Mode: Aktif'
                  : 'Lyrics Mode: Nonaktif'
            }
            onClick={handleToggleLyrics}
          >
            <MessageSquareQuote aria-hidden="true" />
            {hasLyricIssueBadge && (
              <span
                className="mp-lyrics-issue-badge"
                data-testid="lyrics-issue-badge"
                aria-hidden="true"
              >
                !
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          className={`mp-more-btn${isVideoPanelOpen ? ' is-active' : ''}`}
          id="mp-more-btn"
          aria-label={isVideoPanelOpen ? 'Tutup Panel Video' : 'Buka Panel Video'}
          aria-expanded={isVideoPanelOpen}
          onClick={handleToggleVideoPanel}
        >
          <span className="mp-visualizer" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>
    </>
  );
}
