export function formatTimeDot(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}.${m}.${s}`;
}

export function parseTimezoneCity(timeZone?: string): string {
  try {
    const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || !tz.includes('/')) {
      return tz ? tz.replace(/_/g, ' ') : 'Local Time';
    }
    const city = tz.split('/').pop()?.replace(/_/g, ' ');
    return city && city.trim().length > 0 ? city : 'Local Time';
  } catch {
    return 'Local Time';
  }
}

export interface ReverseGeocodeResponse {
  city?: string;
  locality?: string;
  countryName?: string;
}

export function formatReverseGeocodeLocation(data: ReverseGeocodeResponse): string | null {
  const city = data.city?.trim() || data.locality?.trim() || '';
  if (!city) {
    return null;
  }
  const country = data.countryName?.trim() || '';
  return country ? `${city}, ${country}` : city;
}

export function calculateCardTilt(
  x: number,
  y: number,
  width: number,
  height: number,
  maxTiltDeg = 8
): { rotateX: number; rotateY: number } {
  if (width <= 0 || height <= 0) {
    return { rotateX: 0, rotateY: 0 };
  }
  const centerX = width / 2;
  const centerY = height / 2;
  const rotateX = ((y - centerY) / centerY) * -maxTiltDeg || 0;
  const rotateY = ((x - centerX) / centerX) * maxTiltDeg || 0;
  return { rotateX, rotateY };
}

export function calculateMagneticOffset(
  x: number,
  y: number,
  width: number,
  height: number,
  strength = 0.3
): { translateX: number; translateY: number } {
  const offsetX = x - width / 2;
  const offsetY = y - height / 2;
  return {
    translateX: offsetX * strength || 0,
    translateY: offsetY * strength || 0,
  };
}

export function lerp(current: number, target: number, factor = 0.08): number {
  return current + (target - current) * factor;
}

export function cleanYouTubeArtist(author?: string, fallback = 'YouTube Music'): string {
  if (!author || !author.trim()) {
    return fallback;
  }
  return author.replace(/\s*[-–—－]\s*(?:Topic|Release)$/i, '').trim() || fallback;
}

export function getYouTubeThumbnailUrl(
  videoId?: string,
  fallback = 'assets/song.jpg'
): string {
  if (!videoId || !videoId.trim()) {
    return fallback;
  }
  return `https://i.ytimg.com/vi/${videoId.trim()}/hqdefault.jpg`;
}

export function getYouTubeDefaultThumbnailUrl(
  videoId?: string,
  fallback = 'assets/song.jpg'
): string {
  if (!videoId || !videoId.trim()) {
    return fallback;
  }
  return `https://i.ytimg.com/vi/${videoId.trim()}/default.jpg`;
}

export interface ParsedTrackInfo {
  title: string;
  artist: string;
}

const VERSION_SUFFIX_REGEX =
  /^(?:live|acoustic|instrumental|mono|stereo|radio\s+edit|extended(?:\s+(?:mix|version))?|remaster(?:ed)?(?:\s+\d{4})?|\d{4}\s+remaster(?:ed)?|.*\bversion\b.*|.*\bver\.?)$/i;

export function parseYouTubeTrackInfo(
  rawTitle?: string,
  rawAuthor?: string,
  fallbackIndex = 1,
  fallbackArtist = 'YouTube Music'
): ParsedTrackInfo {
  const cleanedAuthor = cleanYouTubeArtist(rawAuthor, '');
  const trimmedTitle = rawTitle
    ? rawTitle.replace(/\s*[-–—－]\s*(?:Topic|Release)$/i, '').trim()
    : '';

  if (!trimmedTitle) {
    return {
      title: `Lagu ${fallbackIndex}`,
      artist: cleanedAuthor || fallbackArtist,
    };
  }

  const splitMatch = trimmedTitle.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (splitMatch) {
    const artistFromTitle = cleanYouTubeArtist(splitMatch[1], '');
    const songTitle = splitMatch[2].trim();
    if (songTitle && !VERSION_SUFFIX_REGEX.test(songTitle)) {
      return {
        title: songTitle,
        artist: artistFromTitle || cleanedAuthor || fallbackArtist,
      };
    }
  }

  return {
    title: trimmedTitle,
    artist: cleanedAuthor || fallbackArtist,
  };
}

export function chunkArray<T>(items: readonly T[], batchSize = 5): T[][] {
  const size = Math.max(1, Math.floor(batchSize));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export type LyricSideMode = 'alternate' | 'right' | 'left';

export interface LyricLine {
  time: number;
  text: string;
  /** 1-based sequence number among non-empty lines (1 = odd/left, 2 = even/right, ...). 0 for empty instrumental lines. */
  displayOrder: number;
}

export interface LrclibSearchCandidate {
  id?: number;
  trackName?: string;
  artistName?: string;
  duration?: number;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

export const NOTICE_MESSAGES = {
  PLAYBACK_EMBED_BLOCKED:
    'Lagu ini tidak bisa diputar di sini karena pemilik video (biasanya label musik) memblokir pemutaran di website lain.',
  PLAYBACK_NOT_FOUND:
    'Lagu atau playlist tidak ditemukan. Kemungkinan sudah dihapus, bersifat private, atau linknya salah.',
  PLAYBACK_INVALID_ID: 'Link atau ID tidak valid. Coba cek lagi linknya.',
  PLAYBACK_GENERIC_ERROR: 'Terjadi kesalahan saat memutar lagu. Coba lagi sebentar lagi.',
  PLAYLIST_LOAD_TIMEOUT:
    'Playlist tidak bisa dimuat. Kemungkinan playlist bersifat private atau kosong. Pastikan playlist berstatus public atau unlisted.',
  PLAYLIST_ALL_UNPLAYABLE: 'Tidak ada lagu di playlist ini yang bisa diputar di sini.',
  LYRICS_NOT_AVAILABLE: 'Lirik untuk lagu ini belum tersedia.',
  LYRICS_PLAIN_ONLY: 'Lirik sinkron untuk lagu ini belum tersedia.',
  LYRICS_DURATION_MISMATCH:
    'Lirik ditemukan tetapi tidak cocok dengan versi lagu ini (mungkin versi live, sped up, atau video klip), jadi tidak ditampilkan.',
  LYRICS_NETWORK_ERROR: 'Lirik tidak dapat dimuat saat ini. Coba lagi nanti.',
  PLAYBACK_EMBED_CONFIG_ERROR:
    'Pemutar YouTube menolak memutar video di website ini (masalah konfigurasi embed). Coba muat ulang halaman.',
  PLAYER_LOAD_FAILED:
    'Pemutar YouTube gagal dimuat. Matikan adblock atau cek koneksi internet, lalu muat ulang halaman.',
  PLAYLIST_RADIO_UNSUPPORTED:
    'Playlist Mix/Radio YouTube tidak didukung. Tempel link lagu atau playlist biasa.',
  LYRICS_DURATION_WARN:
    'Lirik mungkin tidak pas dengan versi lagu ini. Coba ganti versi lirik.',
} as const;

export type NoticeCategory = 'playback' | 'playlist' | 'lyrics';

export function shouldReplaceNotice(
  activeCategory: NoticeCategory | null,
  incomingCategory: NoticeCategory
): boolean {
  if (!activeCategory) return true;
  if (
    incomingCategory === 'lyrics' &&
    (activeCategory === 'playback' || activeCategory === 'playlist')
  ) {
    return false;
  }
  return true;
}

export function resolvePlaybackErrorNotice(errorCode: number): string {
  if (errorCode === 101 || errorCode === 150) {
    return NOTICE_MESSAGES.PLAYBACK_EMBED_BLOCKED;
  }
  if (errorCode === 100) {
    return NOTICE_MESSAGES.PLAYBACK_NOT_FOUND;
  }
  if (errorCode === 2) {
    return NOTICE_MESSAGES.PLAYBACK_INVALID_ID;
  }
  if (errorCode === 153) {
    return NOTICE_MESSAGES.PLAYBACK_EMBED_CONFIG_ERROR;
  }
  return NOTICE_MESSAGES.PLAYBACK_GENERIC_ERROR;
}

/** Error yang tidak akan teratasi dengan melompat ke lagu berikutnya (masalah konfigurasi embed, bukan lagunya). */
export function isNonSkippablePlayerError(errorCode: number): boolean {
  return errorCode === 153;
}

const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PLAYLIST_ID_REGEX = /^[A-Za-z0-9_-]{2,128}$/;

export function parseYouTubeStartSeconds(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    const n = parseInt(value, 10);
    return n > 0 && n <= 86400 ? n : undefined;
  }
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  const total =
    (m[1] ? parseInt(m[1], 10) * 3600 : 0) +
    (m[2] ? parseInt(m[2], 10) * 60 : 0) +
    (m[3] ? parseInt(m[3], 10) : 0);
  return total > 0 && total <= 86400 ? total : undefined;
}

export type ParsedCustomYouTubeLink =
  | {
      ok: true;
      sourceType: 'playlist';
      playlistId: string;
      videoId?: string;
      index?: number;
      startSeconds?: number;
      normalizedUrl: string;
    }
  | {
      ok: true;
      sourceType: 'video';
      videoId: string;
      startSeconds?: number;
      normalizedUrl: string;
    }
  | {
      ok: false;
      errorMessage: string;
    };

export function parseCustomYouTubeUrl(rawInput: string): ParsedCustomYouTubeLink {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      errorMessage: NOTICE_MESSAGES.PLAYBACK_INVALID_ID,
    };
  }

  let candidateUrl = trimmed;
  if (!/^https?:\/\//i.test(candidateUrl)) {
    candidateUrl = `https://${candidateUrl}`;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidateUrl);
  } catch {
    return {
      ok: false,
      errorMessage: NOTICE_MESSAGES.PLAYBACK_INVALID_ID,
    };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return {
      ok: false,
      errorMessage: NOTICE_MESSAGES.PLAYBACK_INVALID_ID,
    };
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (!ALLOWED_YOUTUBE_HOSTS.has(host)) {
    return {
      ok: false,
      errorMessage:
        'Hanya link dari YouTube atau YouTube Music yang didukung (youtube.com, music.youtube.com, youtu.be).',
    };
  }

  const listParam = parsedUrl.searchParams.get('list')?.trim() || '';
  let videoParam = parsedUrl.searchParams.get('v')?.trim() || '';

  if (host === 'youtu.be') {
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    if (!videoParam && pathSegments[0]) {
      videoParam = pathSegments[0].trim();
    }
  } else if (!videoParam) {
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    if (
      pathSegments.length >= 2 &&
      (pathSegments[0] === 'shorts' || pathSegments[0] === 'embed' || pathSegments[0] === 'live')
    ) {
      videoParam = pathSegments[1].trim();
    }
  }

  const startSeconds = parseYouTubeStartSeconds(
    parsedUrl.searchParams.get('t') ?? parsedUrl.searchParams.get('start')
  );

  if (listParam && /^RD/i.test(listParam)) {
    if (videoParam && YOUTUBE_VIDEO_ID_REGEX.test(videoParam)) {
      return {
        ok: true,
        sourceType: 'video',
        videoId: videoParam,
        ...(startSeconds !== undefined ? { startSeconds } : {}),
        normalizedUrl: `https://www.youtube.com/watch?v=${videoParam}`,
      };
    }
    return {
      ok: false,
      errorMessage: NOTICE_MESSAGES.PLAYLIST_RADIO_UNSUPPORTED,
    };
  }

  if (listParam) {
    if (!YOUTUBE_PLAYLIST_ID_REGEX.test(listParam)) {
      return {
        ok: false,
        errorMessage: NOTICE_MESSAGES.PLAYBACK_INVALID_ID,
      };
    }

    const validVideoId =
      videoParam && YOUTUBE_VIDEO_ID_REGEX.test(videoParam) ? videoParam : undefined;

    const rawIndex = parsedUrl.searchParams.get('index');
    let parsedIndex: number | undefined;
    if (rawIndex !== null && /^\d+$/.test(rawIndex.trim())) {
      const idxNum = parseInt(rawIndex.trim(), 10);
      // YouTube URL index parameter is 1-based; convert to 0-based for IFrame API if >= 1
      if (idxNum >= 1) {
        parsedIndex = idxNum - 1;
      }
    }

    return {
      ok: true,
      sourceType: 'playlist',
      playlistId: listParam,
      ...(validVideoId ? { videoId: validVideoId } : {}),
      ...(parsedIndex !== undefined ? { index: parsedIndex } : {}),
      ...(startSeconds !== undefined ? { startSeconds } : {}),
      normalizedUrl: parsedUrl.toString(),
    };
  }

  if (videoParam) {
    if (!YOUTUBE_VIDEO_ID_REGEX.test(videoParam)) {
      return {
        ok: false,
        errorMessage: NOTICE_MESSAGES.PLAYBACK_INVALID_ID,
      };
    }

    return {
      ok: true,
      sourceType: 'video',
      videoId: videoParam,
      ...(startSeconds !== undefined ? { startSeconds } : {}),
      normalizedUrl: `https://www.youtube.com/watch?v=${videoParam}`,
    };
  }

  return {
    ok: false,
    errorMessage: NOTICE_MESSAGES.PLAYBACK_INVALID_ID,
  };
}

export type LyricFetchStatus =
  | 'synced'
  | 'not_found'
  | 'plain_only'
  | 'duration_mismatch'
  | 'network_error';

export interface MatchedLyricTrackInfo {
  id?: number;
  trackName?: string;
  artistName?: string;
  duration?: number;
  durationDiff: number;
  score: number;
  titleSimilarity: number;
  artistSimilarity: number;
}

export interface ScoredLrclibCandidate {
  candidate: LrclibSearchCandidate;
  score: number;
  titleSimilarity: number;
  artistSimilarity: number;
  durationDiff: number;
  titleScore: number;
  durationScore: number;
  artistScore: number;
}

export interface LyricCandidateOption {
  id: number | string;
  trackName: string;
  artistName: string;
  duration: number;
  syncedLyrics: string;
}

export interface LyricLookupResult {
  status: LyricFetchStatus;
  syncedLyrics: string | null;
  matchedTrack?: MatchedLyricTrackInfo | null;
  candidates: LyricCandidateOption[];
}

/** Toleransi selisih durasi maksimal untuk pencocokan lirik otomatis (detik) */
export const LYRIC_MAX_DURATION_DIFF_SEC = 8;

/** Ambang batas peringatan selisih durasi kandidat terpilih dari durasi video (detik) */
export const LYRIC_DURATION_WARNING_THRESHOLD_SEC = 3;

/** Batas maksimal request HTTP pencarian lirik per lagu */
export const MAX_LYRIC_REQUESTS_PER_TRACK = 4;

/** Format durasi detik menjadi "m:ss" (contoh: 244 -> "4:04") */
export function formatDurationMmSs(seconds?: number): string {
  const safeSec =
    typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
      ? Math.round(seconds)
      : 0;
  const mins = Math.floor(safeSec / 60);
  const secs = String(safeSec % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

/** Format selisih durasi kandidat terhadap video dengan tanda +/- (contoh: "+0:03", "-0:02", "+0:00") */
export function formatDurationDiffSigned(
  candidateDuration?: number,
  videoDuration?: number
): string {
  const candSec =
    typeof candidateDuration === 'number' && Number.isFinite(candidateDuration)
      ? Math.round(candidateDuration)
      : 0;
  const vidSec =
    typeof videoDuration === 'number' && Number.isFinite(videoDuration)
      ? Math.round(videoDuration)
      : 0;
  const diff = candSec - vidSec;
  const sign = diff >= 0 ? '+' : '-';
  return `${sign}${formatDurationMmSs(Math.abs(diff))}`;
}

/** Format label kandidat lirik: "Judul - Artis (m:ss)" */
export function formatLyricCandidateLabel(candidate: {
  trackName?: string;
  artistName?: string;
  duration?: number;
}): string {
  const title = (candidate.trackName || 'Tanpa Judul').trim();
  const artist = (candidate.artistName || 'Artis Tidak Diketahui').trim();
  return `${title} - ${artist} (${formatDurationMmSs(candidate.duration)})`;
}

/** Cek apakah selisih durasi kandidat terpilih terhadap durasi video lebih dari 3 detik */
export function shouldWarnLyricDurationDiff(
  lyricDuration?: number,
  videoDuration?: number,
  thresholdSec = LYRIC_DURATION_WARNING_THRESHOLD_SEC
): boolean {
  if (
    typeof lyricDuration !== 'number' ||
    !Number.isFinite(lyricDuration) ||
    lyricDuration <= 0 ||
    typeof videoDuration !== 'number' ||
    !Number.isFinite(videoDuration) ||
    videoDuration <= 0
  ) {
    return false;
  }
  return Math.abs(Math.round(lyricDuration) - Math.round(videoDuration)) > thresholdSec;
}

/** Deduplikasi dan urutkan daftar kandidat lirik dari selisih durasi paling kecil terhadap video */
export function sortLyricCandidatesByDurationDiff(
  candidates: readonly LyricCandidateOption[],
  videoDuration: number
): LyricCandidateOption[] {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const targetSec =
    typeof videoDuration === 'number' && Number.isFinite(videoDuration) && videoDuration > 0
      ? Math.round(videoDuration)
      : 0;

  const seen = new Set<string>();
  const unique: LyricCandidateOption[] = [];
  for (const item of candidates) {
    if (!item || typeof item.syncedLyrics !== 'string' || !item.syncedLyrics.trim()) continue;
    const key = String(
      item.id ?? `${item.trackName}|${item.artistName}|${Math.round(item.duration || 0)}`
    );
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      id: item.id ?? key,
      trackName: (item.trackName || 'Tanpa Judul').trim(),
      artistName: (item.artistName || 'Artis Tidak Diketahui').trim(),
      duration:
        typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration > 0
          ? Math.round(item.duration)
          : 0,
      syncedLyrics: item.syncedLyrics.trim(),
    });
  }

  return unique.sort((a, b) => {
    const diffA = targetSec > 0 && a.duration > 0 ? Math.abs(a.duration - targetSec) : Number.MAX_SAFE_INTEGER;
    const diffB = targetSec > 0 && b.duration > 0 ? Math.abs(b.duration - targetSec) : Number.MAX_SAFE_INTEGER;
    if (diffA !== diffB) {
      return diffA - diffB;
    }
    return a.duration - b.duration;
  });
}

/** Bobot penilaian kandidat LRCLIB */
export const LYRIC_SCORE_WEIGHTS = {
  TITLE: 100, // Bobot utama: kemiripan judul
  DURATION: 60, // Bobot besar: kedekatan durasi dengan player.getDuration()
  ARTIST: 15, // Bobot kecil (hanya bonus, bukan syarat): kemiripan artis
} as const;

/** Ambang minimal kemiripan judul (0..1) agar kandidat dianggap lagu yang sama */
export const LYRIC_MIN_TITLE_SIMILARITY = 0.6;

/**
 * Normalisasi teks sebelum membandingkan nama dan judul:
 * NFKC (ubah karakter lebar penuh seperti ～ menjadi ~), huruf kecil,
 * hapus spasi, tanda hubung, tilde, dan tanda baca.
 * Dengan ini "Nakanoke", "Nakano-ke", dan "Nakano ke" dianggap sama.
 */
export function normalizeForMatch(s?: string): string {
  return (s || '')
    .normalize('NFKC')
    .replace(/[〜∼˜]/g, '~')
    .toLowerCase()
    .replace(/[\s\-‐‑‒–—―－~～〜∼˜\p{P}\p{S}]+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function computeBigramDiceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg) ?? 0;
    if (count > 0) {
      intersection += 1;
      bigramsA.set(bg, count - 1);
    }
  }

  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

function compareNormalizedStrings(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return Number((0.78 + 0.2 * ratio).toFixed(4));
  }
  const dice = computeBigramDiceSimilarity(a, b);
  return dice >= 0.65 ? Number((dice * 0.85).toFixed(4)) : 0;
}

const JAPANESE_SCRIPT_REGEX = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const LATIN_SCRIPT_REGEX = /[A-Za-z]{2,}/;

function hasJapaneseScript(s: string): boolean {
  return JAPANESE_SCRIPT_REGEX.test(s);
}

function hasLatinScript(s: string): boolean {
  return LATIN_SCRIPT_REGEX.test(s);
}

function isBilingualPair(a: string, b: string): boolean {
  const aJp = hasJapaneseScript(a);
  const bJp = hasJapaneseScript(b);
  if (aJp === bJp) return false;
  return aJp ? hasLatinScript(b) : hasLatinScript(a);
}

const BRACKET_NOISE_CONTENT_REGEX =
  /(?:\b(?:official|officiel|lyric|lyrics|audio|video|visualizer|music\s+video|mv|pv|p\.v\.|full|short|tv\s*size|anime|op|ed|ost|hd|hq|4k|8k|60fps|remaster(?:ed)?|radio\s+edit|unreleased|color\s+coded|live|version|ver\.?|mashup|cover|karaoke|instrumental|inst\.?|off\s*vocal|acoustic|sub(?:s|titled)?|romaji|kanji|eng(?:lish)?|indo(?:nesia)?|terjemahan|lirik|ft\.?|feat\.?|featuring|with|prod\.?|produced\s+by|cv\.?)\b|公式|歌詞|字幕|フル|オリジナル|歌ってみた|弾いてみた|アニメ|主題歌|オープニング|エンディング|新曲|高音質|高画質)/i;

const BRACKET_NOISE_BLOCK_REGEX =
  /[(\[（【「『][^)\]）】」』]*?(?:\b(?:official|officiel|lyric|lyrics|audio|video|visualizer|music\s+video|mv|pv|p\.v\.|full|short|tv\s*size|anime|op|ed|ost|hd|hq|4k|8k|60fps|remaster(?:ed)?|radio\s+edit|unreleased|color\s+coded|live|version|ver\.?|mashup|cover|karaoke|instrumental|inst\.?|off\s*vocal|acoustic|sub(?:s|titled)?|romaji|kanji|eng(?:lish)?|indo(?:nesia)?|terjemahan|lirik|ft\.?|feat\.?|featuring|with|prod\.?|produced\s+by|cv\.?)\b|公式|歌詞|字幕|フル|オリジナル|歌ってみた|弾いてみた|アニメ|主題歌|オープニング|エンディング|新曲|高音質|高画質)[^)\]）】」』]*?[)\]）】」』]/gi;

function stripBaseNoise(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[〜∼˜]/g, '~')
    .replace(/\s*[-–—－]\s*(?:Topic|Release)$/i, '')
    .replace(BRACKET_NOISE_BLOCK_REGEX, ' ')
    .replace(/[(\[（【「『]\s*(?:ft\.?|feat\.?|featuring|with)\s+[^)\]）】」』]+[)\]）】」』]/gi, ' ')
    .replace(/\s+\b(?:ft\.?|feat\.?|featuring)\s+.+$/i, ' ')
    .replace(
      /\s*[|\-–—－/／]?\s*\b(?:official\s+)?(?:music\s+video|lyric\s+video|lyrics?\s+video|audio\s+video|visualizer|official\s+video|official\s+audio|official\s+mv|official\s+pv|full\s+mv|full\s+video|full\s+audio|full\s+ver\.?|full\s+version)\b.*$/i,
      ' '
    )
    .replace(
      /\s*[|\-–—－]\s*(?:official\s+)?(?:lyric|lyrics|music\s+video|audio|video|mv|pv|hd|hq|4k|full)\b.*$/i,
      ' '
    )
    .replace(/\s+\b(?:lyrics|mv|pv|4k|hd|hq)\b$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hitung skor kemiripan artis (0..1).
 * Hanya digunakan sebagai bonus kecil dan bukan syarat wajib,
 * sehingga perbedaan penulisan (Romaji vs Kanji) tetap diterima bila judul & durasi cocok.
 */
export function calculateArtistSimilarity(
  candidateArtist?: string,
  wantedArtist?: string
): number {
  const cleanedCand = cleanYouTubeArtist(candidateArtist, '');
  const cleanedWanted = cleanYouTubeArtist(wantedArtist, '');
  const a = normalizeForMatch(cleanedCand);
  const b = normalizeForMatch(cleanedWanted);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  // Cek token artis bila ada kolaborasi (dipisah /, &, feat, koma, dsb.)
  const splitTokens = (str: string) =>
    str
      .split(/(?:[/／,&×・()]|\b(?:feat\.?|ft\.?|with|cv\.?|x)\b)+/i)
      .map((t) => normalizeForMatch(t))
      .filter((t) => t.length >= 2);

  const tokensA = splitTokens(cleanedCand);
  const tokensB = splitTokens(cleanedWanted);
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      if (ta === tb || ta.includes(tb) || tb.includes(ta)) {
        return 0.85;
      }
    }
  }

  const dice = computeBigramDiceSimilarity(a, b);
  return dice >= 0.65 ? Number((dice * 0.75).toFixed(4)) : 0;
}

/**
 * Hitung skor kemiripan judul lagu (0..1) setelah normalisasi NFKC & pembersihan noise.
 */
export function calculateTitleSimilarity(
  candidateTitle?: string,
  wantedTitle?: string
): number {
  const normCand = normalizeForMatch(candidateTitle);
  const normWanted = normalizeForMatch(wantedTitle);
  if (!normCand || !normWanted) return 0;
  if (normCand === normWanted) return 1;

  let best = compareNormalizedStrings(normCand, normWanted);

  const candClean = normalizeForMatch(cleanTrackQueryForLyrics(candidateTitle).title);
  const wantedClean = normalizeForMatch(cleanTrackQueryForLyrics(wantedTitle).title);
  if (candClean && wantedClean) {
    if (candClean === wantedClean) {
      best = Math.max(best, 0.96);
    } else {
      best = Math.max(best, compareNormalizedStrings(candClean, wantedClean) * 0.96);
    }
  }

  const wantedParts = extractBilingualTitleParts(wantedTitle);
  const candParts = extractBilingualTitleParts(candidateTitle);

  for (const part of wantedParts) {
    const normPart = normalizeForMatch(part);
    if (!normPart) continue;
    if (normCand === normPart || candClean === normPart) {
      best = Math.max(best, 0.95);
    } else {
      best = Math.max(best, compareNormalizedStrings(normCand, normPart) * 0.95);
      if (candClean) {
        best = Math.max(best, compareNormalizedStrings(candClean, normPart) * 0.95);
      }
    }
  }

  for (const part of candParts) {
    const normPart = normalizeForMatch(part);
    if (!normPart) continue;
    if (normWanted === normPart || wantedClean === normPart) {
      best = Math.max(best, 0.95);
    } else {
      best = Math.max(best, compareNormalizedStrings(normWanted, normPart) * 0.95);
    }
  }

  return Number(Math.min(1, best).toFixed(4));
}

export function isLyricArtistMatch(candidateArtist?: string, wantedArtist?: string): boolean {
  return calculateArtistSimilarity(candidateArtist, wantedArtist) >= 0.65;
}

export function isLyricTitleMatch(candidateTitle?: string, wantedTitle?: string): boolean {
  return calculateTitleSimilarity(candidateTitle, wantedTitle) >= LYRIC_MIN_TITLE_SIMILARITY;
}

/**
 * Beri skor satu kandidat LRCLIB berdasarkan:
 * - Kemiripan judul (bobot utama: 100)
 * - Kedekatan durasi dengan player.getDuration() (bobot besar: 60, maks selisih 8 detik)
 * - Kemiripan artis (bobot kecil/bonus: 15, bukan syarat)
 * Mengembalikan null bila tidak punya syncedLyrics, selisih durasi > maxDurationDiffSec, atau judul tidak mirip.
 */
export function scoreLrclibCandidate(
  item: LrclibSearchCandidate,
  targetDurationSec: number,
  maxDurationDiffSec = LYRIC_MAX_DURATION_DIFF_SEC,
  wantedTitle?: string,
  wantedArtist?: string
): ScoredLrclibCandidate | null {
  if (!item) return null;
  const hasSynced = typeof item.syncedLyrics === 'string' && item.syncedLyrics.trim().length > 0;
  if (!hasSynced) return null;

  let titleSimilarity = 1;
  if (wantedTitle && normalizeForMatch(wantedTitle)) {
    titleSimilarity = calculateTitleSimilarity(item.trackName, wantedTitle);
    if (titleSimilarity < LYRIC_MIN_TITLE_SIMILARITY) {
      return null;
    }
  }

  let durationDiff = 0;
  let durationScore = 0;
  if (targetDurationSec > 0 && typeof item.duration === 'number' && item.duration > 0) {
    durationDiff = Math.abs(item.duration - targetDurationSec);
    if (durationDiff > maxDurationDiffSec) {
      return null;
    }
    durationScore =
      maxDurationDiffSec > 0
        ? ((maxDurationDiffSec - durationDiff) / maxDurationDiffSec) * LYRIC_SCORE_WEIGHTS.DURATION
        : LYRIC_SCORE_WEIGHTS.DURATION;
  } else if (targetDurationSec > 0) {
    durationDiff = Number.MAX_SAFE_INTEGER;
    durationScore = 0;
  }

  const artistSimilarity = wantedArtist
    ? calculateArtistSimilarity(item.artistName, wantedArtist)
    : 0;

  const titleScore = titleSimilarity * LYRIC_SCORE_WEIGHTS.TITLE;
  const artistScore = artistSimilarity * LYRIC_SCORE_WEIGHTS.ARTIST;
  const score = Number((titleScore + durationScore + artistScore).toFixed(4));

  return {
    candidate: item,
    score,
    titleSimilarity,
    artistSimilarity,
    durationDiff,
    titleScore: Number(titleScore.toFixed(4)),
    durationScore: Number(durationScore.toFixed(4)),
    artistScore: Number(artistScore.toFixed(4)),
  };
}

export function classifyLrclibSearchCandidates(
  candidates: readonly LrclibSearchCandidate[],
  targetDurationSec: number,
  maxDurationDiffSec = LYRIC_MAX_DURATION_DIFF_SEC,
  wantedTitle?: string,
  wantedArtist?: string
): LyricLookupResult {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { status: 'not_found', syncedLyrics: null, matchedTrack: null, candidates: [] };
  }

  let sawDurationMismatch = false;
  let sawPlainLyrics = false;
  const scoredCandidates: ScoredLrclibCandidate[] = [];
  const rawSyncedOptions: LyricCandidateOption[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const item = candidates[i];
    if (!item) continue;
    if (wantedTitle && !isLyricTitleMatch(item.trackName, wantedTitle)) {
      continue;
    }
    const hasSynced = typeof item.syncedLyrics === 'string' && item.syncedLyrics.trim().length > 0;
    const hasPlain = typeof item.plainLyrics === 'string' && item.plainLyrics.trim().length > 0;

    if (hasSynced) {
      const fallbackId = `${item.trackName || wantedTitle || 'track'}-${item.artistName || wantedArtist || 'artist'}-${Math.round(item.duration || 0)}-${i}`;
      rawSyncedOptions.push({
        id: item.id ?? fallbackId,
        trackName: (item.trackName || wantedTitle || 'Tanpa Judul').trim(),
        artistName: (item.artistName || wantedArtist || 'Artis Tidak Diketahui').trim(),
        duration:
          typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration > 0
            ? Math.round(item.duration)
            : 0,
        syncedLyrics: item.syncedLyrics!.trim(),
      });

      const scored = scoreLrclibCandidate(
        item,
        targetDurationSec,
        maxDurationDiffSec,
        wantedTitle,
        wantedArtist
      );
      if (scored) {
        scoredCandidates.push(scored);
      } else {
        sawDurationMismatch = true;
      }
    } else if (hasPlain) {
      sawPlainLyrics = true;
    }
  }

  const sortedOptions = sortLyricCandidatesByDurationDiff(rawSyncedOptions, targetDurationSec);

  if (scoredCandidates.length > 0) {
    // Pilih skor tertinggi; bila seri, pilih durasi paling dekat
    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.durationDiff !== b.durationDiff) {
        return a.durationDiff - b.durationDiff;
      }
      return b.artistSimilarity - a.artistSimilarity;
    });
    const best = scoredCandidates[0];
    const bestId =
      best.candidate.id ??
      sortedOptions.find((opt) => opt.syncedLyrics === best.candidate.syncedLyrics!.trim())?.id;
    return {
      status: 'synced',
      syncedLyrics: best.candidate.syncedLyrics!.trim(),
      matchedTrack: {
        id: typeof bestId === 'number' ? bestId : best.candidate.id,
        trackName: best.candidate.trackName,
        artistName: best.candidate.artistName,
        duration: best.candidate.duration,
        durationDiff: best.durationDiff,
        score: best.score,
        titleSimilarity: best.titleSimilarity,
        artistSimilarity: best.artistSimilarity,
      },
      candidates: sortedOptions,
    };
  }

  if (sawDurationMismatch) {
    return {
      status: 'duration_mismatch',
      syncedLyrics: null,
      matchedTrack: null,
      candidates: sortedOptions,
    };
  }
  if (sawPlainLyrics) {
    return { status: 'plain_only', syncedLyrics: null, matchedTrack: null, candidates: [] };
  }
  return { status: 'not_found', syncedLyrics: null, matchedTrack: null, candidates: [] };
}

export function resolveLyricStatusNotice(status: LyricFetchStatus): string | null {
  switch (status) {
    case 'not_found':
      return NOTICE_MESSAGES.LYRICS_NOT_AVAILABLE;
    case 'plain_only':
      return NOTICE_MESSAGES.LYRICS_PLAIN_ONLY;
    case 'duration_mismatch':
      return NOTICE_MESSAGES.LYRICS_DURATION_MISMATCH;
    case 'network_error':
      return NOTICE_MESSAGES.LYRICS_NETWORK_ERROR;
    default:
      return null;
  }
}

export function cleanTrackQueryForLyrics(
  rawTitle?: string,
  rawArtist?: string
): { title: string; artist: string } {
  let cleanedArtist = stripBaseNoise(rawArtist || '').replace(
    /[(\[（【「『][^)\]）】」』]*[)\]）】」』]/g,
    ' '
  );
  cleanedArtist = cleanYouTubeArtist(cleanedArtist.replace(/\s+/g, ' ').trim(), '');

  let cleanedTitle = stripBaseNoise(rawTitle || '');

  // Handle Japanese quotation pattern: Artis「Judul」 or Artis『Judul』
  const jpQuoteMatch = cleanedTitle.match(/^([^「『」』]+?)\s*[「『]([^「『」』]+)[」』]\s*$/);
  if (jpQuoteMatch) {
    const outerPart = cleanYouTubeArtist(jpQuoteMatch[1].trim(), '');
    const innerPart = jpQuoteMatch[2].trim();
    if (
      cleanedArtist &&
      !isLyricArtistMatch(outerPart, cleanedArtist) &&
      isBilingualPair(outerPart, innerPart)
    ) {
      cleanedTitle = outerPart;
    } else if (innerPart) {
      cleanedTitle = innerPart;
      if (!cleanedArtist || !isLyricArtistMatch(outerPart, cleanedArtist)) {
        cleanedArtist = outerPart || cleanedArtist;
      }
    }
  } else {
    const wrappedQuoteMatch = cleanedTitle.match(/^[「『]([^「『」』]+)[」』]$/);
    if (wrappedQuoteMatch) {
      cleanedTitle = wrappedQuoteMatch[1].trim();
    }
  }

  // Strip remaining bracketed metadata in 【】, 「」, 『』, [], () or ~...~ if non-empty title remains outside
  const withoutExtraBrackets = cleanedTitle
    .replace(/[(\[（【「『][^)\]）】」』]*[)\]）】」』]/g, ' ')
    .replace(/~[^~]+~/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (withoutExtraBrackets) {
    cleanedTitle = withoutExtraBrackets;
  }

  const dashMatch = cleanedTitle.match(/^(.+?)\s+[-–—－]\s+(.+)$/);
  if (dashMatch) {
    const left = dashMatch[1].trim();
    const right = dashMatch[2].trim();
    if (right && !VERSION_SUFFIX_REGEX.test(right)) {
      if (
        cleanedArtist &&
        isLyricArtistMatch(right, cleanedArtist) &&
        !isLyricArtistMatch(left, cleanedArtist)
      ) {
        cleanedTitle = left;
      } else if (
        cleanedArtist &&
        !isLyricArtistMatch(left, cleanedArtist) &&
        isBilingualPair(left, right)
      ) {
        cleanedTitle = left;
      } else {
        cleanedTitle = right;
        cleanedArtist =
          cleanedArtist && isLyricArtistMatch(left, cleanedArtist)
            ? cleanedArtist
            : cleanYouTubeArtist(left, cleanedArtist);
      }
    }
  }

  const slashMatch = cleanedTitle.match(/^(.+?)\s*[/／]\s*(.+)$/);
  if (slashMatch) {
    const left = slashMatch[1].trim();
    const right = slashMatch[2].trim();
    if (left && right) {
      if (
        cleanedArtist &&
        isLyricArtistMatch(left, cleanedArtist) &&
        !isLyricArtistMatch(right, cleanedArtist)
      ) {
        cleanedTitle = right;
      } else if (
        cleanedArtist &&
        !isLyricArtistMatch(right, cleanedArtist) &&
        isBilingualPair(left, right)
      ) {
        cleanedTitle = left;
      } else {
        cleanedTitle = left;
        cleanedArtist =
          cleanedArtist && isLyricArtistMatch(right, cleanedArtist)
            ? cleanedArtist
            : cleanYouTubeArtist(right, cleanedArtist);
      }
    }
  }

  return {
    title: cleanedTitle.replace(/\s+/g, ' ').trim(),
    artist: cleanedArtist.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Ekstrak bagian judul dua bahasa (misal Jepang dan Romaji/Inggris) secara terpisah
 * untuk fallback pencarian lirik.
 */
export function extractBilingualTitleParts(rawTitle?: string, rawArtist?: string): string[] {
  if (!rawTitle || !rawTitle.trim()) return [];
  const { artist: resolvedArtist } = cleanTrackQueryForLyrics(rawTitle, rawArtist);
  const base = stripBaseNoise(rawTitle);
  if (!base) return [];

  const candidates: string[] = [];
  const pushCandidate = (val?: string) => {
    const trimmed = (val || '')
      .replace(/^[(\[（【「『~]+|[)\]）】」』~]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!trimmed) return;
    if (BRACKET_NOISE_CONTENT_REGEX.test(trimmed)) return;
    if (VERSION_SUFFIX_REGEX.test(trimmed)) return;
    if (resolvedArtist && normalizeForMatch(trimmed) === normalizeForMatch(resolvedArtist)) {
      return;
    }
    if (!candidates.some((c) => normalizeForMatch(c) === normalizeForMatch(trimmed))) {
      candidates.push(trimmed);
    }
  };

  const bracketMatches = Array.from(
    base.matchAll(/(?:[(\[（【「『]([^)\]）】」』]+)[)\]）】」』]|~([^~]+)~)/g)
  );
  const outsideBrackets = base
    .replace(/[(\[（【「『][^)\]）】」』]*[)\]）】」』]/g, ' ')
    .replace(/~[^~]+~/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (outsideBrackets && bracketMatches.length > 0) {
    const cleanOutside = cleanTrackQueryForLyrics(outsideBrackets, resolvedArtist).title;
    for (const m of bracketMatches) {
      const inner = (m[1] || m[2] || '').trim();
      if (cleanOutside && inner && isBilingualPair(cleanOutside, inner)) {
        pushCandidate(cleanOutside);
        pushCandidate(inner);
      }
    }
  }

  const splitParts = outsideBrackets.split(/\s*(?:[/／|~]|[-–—－])\s*/).filter(Boolean);
  if (splitParts.length >= 2) {
    const nonArtistParts = splitParts.filter(
      (p) => !resolvedArtist || normalizeForMatch(p) !== normalizeForMatch(resolvedArtist)
    );
    if (nonArtistParts.length >= 2 && isBilingualPair(nonArtistParts[0], nonArtistParts[1])) {
      pushCandidate(nonArtistParts[0]);
      pushCandidate(nonArtistParts[1]);
    }
  }

  const { title: cleanedSingleTitle } = cleanTrackQueryForLyrics(rawTitle, rawArtist);
  const jpFirstMatch = cleanedSingleTitle.match(
    /^([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\s・ー]+?)\s+([A-Za-z][A-Za-z0-9\s'’.,!?-]{1,})$/u
  );
  if (jpFirstMatch && isBilingualPair(jpFirstMatch[1], jpFirstMatch[2])) {
    pushCandidate(jpFirstMatch[1]);
    pushCandidate(jpFirstMatch[2]);
  } else {
    const latinFirstMatch = cleanedSingleTitle.match(
      /^([A-Za-z][A-Za-z0-9\s'’.,!?-]{1,})\s+([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\s・ー]+?)$/u
    );
    if (latinFirstMatch && isBilingualPair(latinFirstMatch[1], latinFirstMatch[2])) {
      pushCandidate(latinFirstMatch[1]);
      pushCandidate(latinFirstMatch[2]);
    }
  }

  return candidates.length >= 2 ? candidates.slice(0, 2) : [];
}

/**
 * Pencarian lirik ke LRCLIB dengan sistem skor kandidat (maksimal 4 request per lagu):
 * 1. Cari dulu dengan judul yang sudah dinormalisasi: /api/search?q={judul}
 *    (tidak mewajibkan nama artis cocok persis, sehingga variasi artis / Romaji vs Kanji langsung terjaring).
 * 2. Bila belum ketemu, coba /api/search?q={artis} {judul}.
 * 3. Bila judul memuat dua bahasa, coba tiap bagian secara terpisah (/api/search?q={bagian}),
 *    atau fallback ke /api/search?track_name={judul}&artist_name={artis} dan /api/get.
 * Setiap hasil diberi skor (kemiripan judul + kedekatan durasi <= 8s + bonus kemiripan artis)
 * dan dicatat ke console pada mode development.
 */
export async function fetchLyricsWithStatusFromLrclib(
  rawTitle: string,
  rawArtist: string,
  durationSec: number,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch
): Promise<LyricLookupResult> {
  const { title: cleanTitle, artist: cleanArtist } = cleanTrackQueryForLyrics(rawTitle, rawArtist);
  const bilingualParts = extractBilingualTitleParts(rawTitle, rawArtist);
  const roundedDuration = durationSec > 0 ? Math.round(durationSec) : 0;
  const collectedCandidates: LyricCandidateOption[] = [];

  const logLookupResult = (result: LyricLookupResult): LyricLookupResult => {
    const mergedCandidates = sortLyricCandidatesByDurationDiff(
      [...collectedCandidates, ...(result.candidates || [])],
      roundedDuration
    );
    const finalResult: LyricLookupResult = {
      ...result,
      candidates: mergedCandidates,
    };
    if (import.meta.env?.DEV) {
      console.log('[LRCLIB Lyrics]', {
        query: {
          title: cleanTitle || rawTitle,
          artist: cleanArtist || rawArtist,
          duration: roundedDuration,
        },
        selected: finalResult.matchedTrack
          ? {
              id: finalResult.matchedTrack.id,
              trackName: finalResult.matchedTrack.trackName,
              artistName: finalResult.matchedTrack.artistName,
              duration: finalResult.matchedTrack.duration,
              durationDiff: finalResult.matchedTrack.durationDiff,
              score: finalResult.matchedTrack.score,
            }
          : null,
        candidateCount: mergedCandidates.length,
        status: finalResult.status,
      });
    }
    return finalResult;
  };

  if (!cleanTitle && bilingualParts.length === 0) {
    return logLookupResult({
      status: 'not_found',
      syncedLyrics: null,
      matchedTrack: null,
      candidates: [],
    });
  }

  const enc = encodeURIComponent;
  let requestCount = 0;

  const checkAbort = () => {
    if (signal.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
  };

  const runSearchRequest = async (
    url: string,
    matchTitle: string
  ): Promise<LyricLookupResult | null> => {
    checkAbort();
    if (requestCount >= MAX_LYRIC_REQUESTS_PER_TRACK) {
      return null;
    }
    requestCount += 1;
    try {
      const res = await fetchImpl(url, { signal });
      checkAbort();
      if (!res.ok) return null;
      const candidates = (await res.json()) as LrclibSearchCandidate[];
      if (!Array.isArray(candidates) || candidates.length === 0) return null;
      const classified = classifyLrclibSearchCandidates(
        candidates,
        roundedDuration,
        LYRIC_MAX_DURATION_DIFF_SEC,
        matchTitle,
        cleanArtist
      );
      if (classified.candidates.length > 0) {
        collectedCandidates.push(...classified.candidates);
      }
      if (classified.status === 'synced' && classified.syncedLyrics) {
        return classified;
      }
      return null;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || signal.aborted) {
        throw err;
      }
      return null;
    }
  };

  let searchedCleanTitle = false;
  if (cleanTitle && requestCount < MAX_LYRIC_REQUESTS_PER_TRACK) {
    searchedCleanTitle = true;
    const step1Url = `https://lrclib.net/api/search?q=${enc(cleanTitle)}`;
    const matched = await runSearchRequest(step1Url, rawTitle || cleanTitle);
    if (matched) return logLookupResult(matched);
  }

  if (cleanArtist && cleanTitle && requestCount < MAX_LYRIC_REQUESTS_PER_TRACK) {
    const step2Url = `https://lrclib.net/api/search?q=${enc(`${cleanArtist} ${cleanTitle}`.trim())}`;
    const matched = await runSearchRequest(step2Url, rawTitle || cleanTitle);
    if (matched) return logLookupResult(matched);
  }

  const distinctBilingualParts = bilingualParts.filter(
    (part) => normalizeForMatch(part) !== normalizeForMatch(cleanTitle)
  );
  const orderedBilingualParts = [
    ...distinctBilingualParts,
    ...bilingualParts.filter((part) => normalizeForMatch(part) === normalizeForMatch(cleanTitle)),
  ];
  for (const part of orderedBilingualParts) {
    if (requestCount >= MAX_LYRIC_REQUESTS_PER_TRACK) break;
    if (normalizeForMatch(part) === normalizeForMatch(cleanTitle) && searchedCleanTitle) {
      continue;
    }
    const bilingualUrl = `https://lrclib.net/api/search?q=${enc(part)}`;
    const matched = await runSearchRequest(bilingualUrl, part);
    if (matched) return logLookupResult(matched);
  }

  if (cleanArtist && cleanTitle && requestCount < MAX_LYRIC_REQUESTS_PER_TRACK) {
    const trackArtistUrl = `https://lrclib.net/api/search?track_name=${enc(
      cleanTitle
    )}&artist_name=${enc(cleanArtist)}`;
    const matched = await runSearchRequest(trackArtistUrl, rawTitle || cleanTitle);
    if (matched) return logLookupResult(matched);
  }

  if (
    cleanArtist &&
    cleanTitle &&
    roundedDuration > 0 &&
    requestCount < MAX_LYRIC_REQUESTS_PER_TRACK
  ) {
    checkAbort();
    requestCount += 1;
    try {
      const getUrl = `https://lrclib.net/api/get?artist_name=${enc(cleanArtist)}&track_name=${enc(
        cleanTitle
      )}&duration=${roundedDuration}`;
      const res = await fetchImpl(getUrl, { signal });
      checkAbort();
      if (res.ok) {
        const data = (await res.json()) as LrclibSearchCandidate;
        if (data && typeof data.syncedLyrics === 'string' && data.syncedLyrics.trim()) {
          const classified = classifyLrclibSearchCandidates(
            [
              {
                ...data,
                trackName: data.trackName || cleanTitle,
                artistName: data.artistName || cleanArtist,
              },
            ],
            roundedDuration,
            LYRIC_MAX_DURATION_DIFF_SEC,
            rawTitle || cleanTitle,
            cleanArtist
          );
          if (classified.candidates.length > 0) {
            collectedCandidates.push(...classified.candidates);
          }
          if (classified.status === 'synced' && classified.syncedLyrics) {
            return logLookupResult(classified);
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || signal.aborted) {
        throw err;
      }
    }
  }

  checkAbort();
  return logLookupResult({
    status: collectedCandidates.length > 0 ? 'duration_mismatch' : 'not_found',
    syncedLyrics: null,
    matchedTrack: null,
    candidates: collectedCandidates,
  });
}


export function parseLrcSyncedLyrics(lrc?: string | null): LyricLine[] {
  if (!lrc || typeof lrc !== 'string') {
    return [];
  }

  const rawEntries: { time: number; text: string }[] = [];
  const lines = lrc.split(/\r?\n/);
  const timeTagRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    const matches = Array.from(rawLine.matchAll(timeTagRegex));
    if (matches.length === 0) {
      continue;
    }

    const text = rawLine.replace(timeTagRegex, '').trim();

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fractionRaw = match[3] || '0';
      const fraction =
        fractionRaw.length === 3
          ? parseInt(fractionRaw, 10) / 1000
          : fractionRaw.length === 2
            ? parseInt(fractionRaw, 10) / 100
            : parseInt(fractionRaw, 10) / 10;

      const totalSeconds = minutes * 60 + seconds + fraction;
      if (Number.isFinite(totalSeconds) && totalSeconds >= 0) {
        rawEntries.push({
          time: Math.round(totalSeconds * 1000) / 1000,
          text,
        });
      }
    }
  }

  rawEntries.sort((a, b) => a.time - b.time);

  let visibleOrder = 0;
  return rawEntries.map((entry) => {
    if (entry.text.length > 0) {
      visibleOrder += 1;
      return {
        time: entry.time,
        text: entry.text,
        displayOrder: visibleOrder,
      };
    }
    return {
      time: entry.time,
      text: '',
      displayOrder: 0,
    };
  });
}

export function findActiveLyricIndex(
  lines: readonly LyricLine[],
  currentTimeSec: number,
  offsetSec = 0
): number {
  if (!lines || lines.length === 0) {
    return -1;
  }

  const adjustedTime = currentTimeSec + offsetSec;
  if (adjustedTime < lines[0].time) {
    return -1;
  }

  let low = 0;
  let high = lines.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (lines[mid].time <= adjustedTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

export function resolveLyricSide(
  displayOrder: number,
  mode: LyricSideMode = 'alternate'
): 'left' | 'right' {
  if (mode === 'left') return 'left';
  if (mode === 'right') return 'right';
  // Odd displayOrder (1st, 3rd, 5th...) -> 'left'; Even displayOrder (2nd, 4th, 6th...) -> 'right'
  return displayOrder % 2 === 1 ? 'left' : 'right';
}

export interface RainDrop {
  x: number;
  y: number;
  z: number;
  length: number;
  speedY: number;
  speedX: number;
  opacity: number;
  thickness: number;
}

export function getTargetRainDropCount(
  viewportWidth: number,
  desktopDensity = 120,
  mobileDensity = 60,
  fpsScale = 1
): number {
  const base = viewportWidth < 768 ? mobileDensity : desktopDensity;
  const clampedScale = Math.max(0.35, Math.min(1, fpsScale));
  return Math.max(10, Math.round(base * clampedScale));
}

export function createRainDrop(
  width: number,
  height: number,
  randomUnderTop = false,
  rand: () => number = Math.random
): RainDrop {
  // z depth: 0 (far/slow/short/faint) to 1 (near/fast/long/brighter)
  const z = rand();
  const length = 12 + z * 22;
  const speedY = 5.5 + z * 9.5;
  const speedX = -0.8 - z * 0.9;
  const opacity = Number((0.08 + z * 0.17).toFixed(3));
  const thickness = 0.75 + z * 0.65;

  return {
    x: rand() * (width + 120) - 40,
    y: randomUnderTop ? -rand() * 160 - length : rand() * height,
    z,
    length,
    speedY,
    speedX,
    opacity,
    thickness,
  };
}

export function adjustRainScaleForFps(avgFrameDeltaMs: number, currentScale: number): number {
  if (!Number.isFinite(avgFrameDeltaMs) || avgFrameDeltaMs <= 0) {
    return currentScale;
  }
  if (avgFrameDeltaMs > 24) {
    return Math.max(0.4, Number((currentScale - 0.15).toFixed(2)));
  }
  if (avgFrameDeltaMs < 18 && currentScale < 1) {
    return Math.min(1, Number((currentScale + 0.1).toFixed(2)));
  }
  return currentScale;
}
