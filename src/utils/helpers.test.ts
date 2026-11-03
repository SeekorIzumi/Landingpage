import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimeDot,
  parseTimezoneCity,
  formatReverseGeocodeLocation,
  calculateCardTilt,
  calculateMagneticOffset,
  lerp,
  cleanYouTubeArtist,
  getYouTubeThumbnailUrl,
  getYouTubeDefaultThumbnailUrl,
  parseYouTubeTrackInfo,
  chunkArray,
  cleanTrackQueryForLyrics,
  parseLrcSyncedLyrics,
  findActiveLyricIndex,
  resolveLyricSide,
  getTargetRainDropCount,
  createRainDrop,
  adjustRainScaleForFps,
  NOTICE_MESSAGES,
  parseCustomYouTubeUrl,
  parseYouTubeStartSeconds,
  normalizeForMatch,
  isLyricTitleMatch,
  isLyricArtistMatch,
  calculateTitleSimilarity,
  calculateArtistSimilarity,
  scoreLrclibCandidate,
  extractBilingualTitleParts,
  fetchLyricsWithStatusFromLrclib,
  LYRIC_MAX_DURATION_DIFF_SEC,
  MAX_LYRIC_REQUESTS_PER_TRACK,
  isNonSkippablePlayerError,
  classifyLrclibSearchCandidates,
  resolvePlaybackErrorNotice,
  resolveLyricStatusNotice,
  shouldReplaceNotice,
  formatDurationMmSs,
  formatDurationDiffSigned,
  formatLyricCandidateLabel,
  shouldWarnLyricDurationDiff,
  sortLyricCandidatesByDurationDiff,
} from './helpers';

test('formatTimeDot formats Date into HH.MM.SS with dots and zero padding', () => {
  const d1 = new Date(2026, 9, 22, 5, 7, 9);
  assert.equal(formatTimeDot(d1), '05.07.09');

  const d2 = new Date(2026, 9, 22, 23, 59, 58);
  assert.equal(formatTimeDot(d2), '23.59.58');
});

test('parseTimezoneCity extracts city name from IANA timezone string', () => {
  assert.equal(parseTimezoneCity('Asia/Jakarta'), 'Jakarta');
  assert.equal(parseTimezoneCity('America/New_York'), 'New York');
  assert.equal(parseTimezoneCity('America/Argentina/Buenos_Aires'), 'Buenos Aires');
  assert.equal(parseTimezoneCity(''), 'Local Time');
});

test('formatReverseGeocodeLocation formats City, Country accurately', () => {
  assert.equal(
    formatReverseGeocodeLocation({ city: 'Bandung', countryName: 'Indonesia' }),
    'Bandung, Indonesia'
  );
  assert.equal(
    formatReverseGeocodeLocation({ locality: 'Cimahi', countryName: 'Indonesia' }),
    'Cimahi, Indonesia'
  );
  assert.equal(formatReverseGeocodeLocation({ city: 'Tokyo' }), 'Tokyo');
  assert.equal(formatReverseGeocodeLocation({}), null);
  assert.equal(formatReverseGeocodeLocation({ city: '   ', locality: '' }), null);
});

test('calculateCardTilt computes +/-8deg 3D tilt based on mouse position', () => {
  // Center of 200x100 card -> 0, 0
  const center = calculateCardTilt(100, 50, 200, 100);
  assert.equal(center.rotateX, 0);
  assert.equal(center.rotateY, 0);

  // Top-left corner (0, 0) -> rotateX = +8, rotateY = -8
  const topLeft = calculateCardTilt(0, 0, 200, 100);
  assert.equal(topLeft.rotateX, 8);
  assert.equal(topLeft.rotateY, -8);

  // Bottom-right corner (200, 100) -> rotateX = -8, rotateY = +8
  const bottomRight = calculateCardTilt(200, 100, 200, 100);
  assert.equal(bottomRight.rotateX, -8);
  assert.equal(bottomRight.rotateY, 8);
});

test('calculateMagneticOffset computes 0.3x translation from center', () => {
  const offset = calculateMagneticOffset(88, 44, 88, 88);
  assert.ok(Math.abs(offset.translateX - 13.2) < 1e-6);
  assert.equal(offset.translateY, 0);
});

test('lerp interpolates by 0.08 factor per frame', () => {
  assert.equal(lerp(0, 100, 0.08), 8);
  assert.equal(lerp(100, 100, 0.08), 100);
});

test('cleanYouTubeArtist strips trailing " - Topic" and " - Release" suffixes accurately', () => {
  assert.equal(cleanYouTubeArtist('YOASOBI - Topic'), 'YOASOBI');
  assert.equal(cleanYouTubeArtist('Ado - Release'), 'Ado');
  assert.equal(cleanYouTubeArtist('Nakano-ke no Itsutsugo - topic'), 'Nakano-ke no Itsutsugo');
  assert.equal(cleanYouTubeArtist('Kenshi Yonezu'), 'Kenshi Yonezu');
  assert.equal(cleanYouTubeArtist('', 'Fallback Artist'), 'Fallback Artist');
});

test('getYouTubeThumbnailUrl and getYouTubeDefaultThumbnailUrl return expected URLs', () => {
  assert.equal(
    getYouTubeThumbnailUrl('dQw4w9WgXcQ'),
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
  );
  assert.equal(getYouTubeThumbnailUrl('', 'assets/song.jpg'), 'assets/song.jpg');
  assert.equal(
    getYouTubeDefaultThumbnailUrl('dQw4w9WgXcQ'),
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg'
  );
  assert.equal(getYouTubeDefaultThumbnailUrl('', 'assets/song.jpg'), 'assets/song.jpg');
});

test('parseYouTubeTrackInfo splits "Artis - Judul", strips "- Topic", ignores version suffixes, and falls back to "Lagu {nomor}"', () => {
  assert.deepEqual(
    parseYouTubeTrackInfo('Maroon 5 - Payphone (Lyrics)', '7clouds', 1),
    { title: 'Payphone (Lyrics)', artist: 'Maroon 5' }
  );
  assert.deepEqual(
    parseYouTubeTrackInfo('Payphone', 'Maroon 5 - Topic', 2),
    { title: 'Payphone', artist: 'Maroon 5' }
  );
  assert.deepEqual(
    parseYouTubeTrackInfo('Lagu - Live', 'YOASOBI - Topic', 3),
    { title: 'Lagu - Live', artist: 'YOASOBI' }
  );
  assert.deepEqual(
    parseYouTubeTrackInfo('Lagu - Remastered 2011', 'Queen - Topic', 4),
    { title: 'Lagu - Remastered 2011', artist: 'Queen' }
  );
  assert.deepEqual(
    parseYouTubeTrackInfo('Artis - Judul', 'Channel', 5),
    { title: 'Judul', artist: 'Artis' }
  );
  assert.deepEqual(
    parseYouTubeTrackInfo('', '', 7, 'Izumi Music'),
    { title: 'Lagu 7', artist: 'Izumi Music' }
  );
});

test('chunkArray splits array into batches of size 5', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  assert.deepEqual(chunkArray(input, 5), [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
    [11],
  ]);
});

test('cleanTrackQueryForLyrics strips "- Topic", "- Release", Japanese/messy brackets, and splits "Artis - Judul" or "Judul / Artis"', () => {
  assert.deepEqual(
    cleanTrackQueryForLyrics('Payphone (Official Music Video) ft. Wiz Khalifa', 'Maroon 5 - Topic'),
    { title: 'Payphone', artist: 'Maroon 5' }
  );
  assert.deepEqual(
    cleanTrackQueryForLyrics('Where Are Ü Now (with Justin Bieber) [Official Audio]', 'Jack Ü'),
    { title: 'Where Are Ü Now', artist: 'Jack Ü' }
  );
  assert.deepEqual(
    cleanTrackQueryForLyrics('All Night | Lyrics (Lyric Video)', 'Icona Pop feat. Charli XCX'),
    { title: 'All Night', artist: 'Icona Pop' }
  );
  assert.deepEqual(
    cleanTrackQueryForLyrics('Lagu 【Official MV】', 'YOASOBI - Release'),
    { title: 'Lagu', artist: 'YOASOBI' }
  );
  assert.deepEqual(
    cleanTrackQueryForLyrics('夜に駆ける【公式】', 'YOASOBI'),
    { title: '夜に駆ける', artist: 'YOASOBI' }
  );
  assert.deepEqual(
    cleanTrackQueryForLyrics('【Judul Asli】', 'Artis'),
    { title: '【Judul Asli】', artist: 'Artis' }
  );
  assert.deepEqual(
    cleanTrackQueryForLyrics('YOASOBI「アイドル」 Official Music Video', 'Ayase / YOASOBI'),
    { title: 'アイドル', artist: 'Ayase / YOASOBI' }
  );
  assert.deepEqual(
    cleanTrackQueryForLyrics('【MV】夜に駆ける / YOASOBI (Full Audio) [4K HD]', ''),
    { title: '夜に駆ける', artist: 'YOASOBI' }
  );
  assert.deepEqual(
    cleanTrackQueryForLyrics('米津玄師 - Lemon 「Lyric Video」 『Full』', ''),
    { title: 'Lemon', artist: '米津玄師' }
  );
});

test('extractBilingualTitleParts splits Japanese and Romaji/English bilingual titles accurately', () => {
  assert.deepEqual(
    extractBilingualTitleParts('夜に駆ける (Into The Night) [Official MV]', 'YOASOBI'),
    ['夜に駆ける', 'Into The Night']
  );
  assert.deepEqual(
    extractBilingualTitleParts('夜に駆ける / Into The Night', 'YOASOBI'),
    ['夜に駆ける', 'Into The Night']
  );
  assert.deepEqual(
    extractBilingualTitleParts('紅蓮華 Gurenge', 'LiSA'),
    ['紅蓮華', 'Gurenge']
  );
  assert.deepEqual(
    extractBilingualTitleParts('Payphone (Official Video)', 'Maroon 5'),
    []
  );
});

test('parseLrcSyncedLyrics parses timestamps, keeps empty instrumental markers, and numbers visible lines', () => {
  const sampleLrc = [
    '[ar:Maroon 5]',
    '[00:08.50] I am at a payphone',
    '[00:12.25] Trying to call home',
    '[00:16.00] ',
    '[00:20.10] All of my change I spent on you',
  ].join('\n');

  const parsed = parseLrcSyncedLyrics(sampleLrc);
  assert.deepEqual(parsed, [
    { time: 8.5, text: 'I am at a payphone', displayOrder: 1 },
    { time: 12.25, text: 'Trying to call home', displayOrder: 2 },
    { time: 16, text: '', displayOrder: 0 },
    { time: 20.1, text: 'All of my change I spent on you', displayOrder: 3 },
  ]);
});

test('findActiveLyricIndex uses binary search and respects intro and offset', () => {
  const lines = parseLrcSyncedLyrics(
    '[00:05.00] First line\n[00:10.00] Second line\n[00:15.00] \n[00:20.00] Third line'
  );
  // Before intro (5.0s)
  assert.equal(findActiveLyricIndex(lines, 2.5), -1);
  // Exactly on first line
  assert.equal(findActiveLyricIndex(lines, 5.0), 0);
  // Between first and second line
  assert.equal(findActiveLyricIndex(lines, 9.9), 0);
  // Instrumental break at 15.0s
  assert.equal(findActiveLyricIndex(lines, 16.2), 2);
  // After third line
  assert.equal(findActiveLyricIndex(lines, 45.0), 3);
  // With positive LYRIC_OFFSET (+1.0s at t=4.2s -> 5.2s -> index 0)
  assert.equal(findActiveLyricIndex(lines, 4.2, 1.0), 0);
});

test('resolveLyricSide alternates odd=left, even=right and honors fixed modes', () => {
  assert.equal(resolveLyricSide(1, 'alternate'), 'left');
  assert.equal(resolveLyricSide(2, 'alternate'), 'right');
  assert.equal(resolveLyricSide(3, 'alternate'), 'left');
  assert.equal(resolveLyricSide(4, 'alternate'), 'right');
  assert.equal(resolveLyricSide(1, 'right'), 'right');
  assert.equal(resolveLyricSide(2, 'left'), 'left');
});

test('getTargetRainDropCount returns 120 for desktop, 60 for mobile (<768px), and scales with FPS', () => {
  assert.equal(getTargetRainDropCount(1440, 120, 60, 1), 120);
  assert.equal(getTargetRainDropCount(767, 120, 60, 1), 60);
  assert.equal(getTargetRainDropCount(1440, 120, 60, 0.5), 60);
});

test('createRainDrop generates depth-correlated raindrops with opacity between 0.08 and 0.25', () => {
  const farDrop = createRainDrop(1000, 800, false, () => 0);
  const nearDrop = createRainDrop(1000, 800, false, () => 1);
  assert.equal(farDrop.opacity, 0.08);
  assert.equal(nearDrop.opacity, 0.25);
  assert.ok(nearDrop.length > farDrop.length);
  assert.ok(nearDrop.speedY > farDrop.speedY);
});

test('adjustRainScaleForFps reduces rain scale above 24ms and increases it below 18ms', () => {
  assert.equal(adjustRainScaleForFps(30, 1), 0.85);
  assert.equal(adjustRainScaleForFps(12, 0.55), 0.65);
  assert.equal(adjustRainScaleForFps(12, 1), 1);
  assert.equal(adjustRainScaleForFps(20, 0.7), 0.7);
  assert.equal(adjustRainScaleForFps(35, 0.45), 0.4);
});

test('parseCustomYouTubeUrl accepts allowed hosts for playlist, video+playlist, and single video links while ignoring tracking params', () => {
  // Playlist on music.youtube.com with tracking params
  const pl = parseCustomYouTubeUrl(
    'https://music.youtube.com/playlist?list=PLR7rGtQ516NM&si=sq-7n1OZjvoBihdN&feature=share'
  );
  assert.equal(pl.ok, true);
  if (pl.ok && pl.sourceType === 'playlist') {
    assert.equal(pl.playlistId, 'PLR7rGtQ516NM');
    assert.equal(pl.videoId, undefined);
  }

  // Combined v=ID and list=ID with index
  const combined = parseCustomYouTubeUrl(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLR7rGtQ516NM&index=3&pp=iAQB'
  );
  assert.equal(combined.ok, true);
  if (combined.ok && combined.sourceType === 'playlist') {
    assert.equal(combined.playlistId, 'PLR7rGtQ516NM');
    assert.equal(combined.videoId, 'dQw4w9WgXcQ');
    assert.equal(combined.index, 2); // 1-based index=3 -> 0-based 2
  }

  // Single video on youtu.be and m.youtube.com
  const shortLink = parseCustomYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?si=abc123');
  assert.equal(shortLink.ok, true);
  if (shortLink.ok && shortLink.sourceType === 'video') {
    assert.equal(shortLink.videoId, 'dQw4w9WgXcQ');
  }

  const mobileLink = parseCustomYouTubeUrl('https://m.youtube.com/watch?v=5qap5aO4i9A&feature=youtu.be');
  assert.equal(mobileLink.ok, true);
  if (mobileLink.ok && mobileLink.sourceType === 'video') {
    assert.equal(mobileLink.videoId, '5qap5aO4i9A');
  }

  // Input with leading/trailing spaces remains valid
  const spacedLink = parseCustomYouTubeUrl('   https://youtu.be/dQw4w9WgXcQ   ');
  assert.equal(spacedLink.ok, true);
  if (spacedLink.ok && spacedLink.sourceType === 'video') {
    assert.equal(spacedLink.videoId, 'dQw4w9WgXcQ');
  }

  // YouTube Music Radio/Mix with v=ID -> treated as single video
  const radioVideo = parseCustomYouTubeUrl(
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ'
  );
  assert.equal(radioVideo.ok, true);
  if (radioVideo.ok) {
    assert.equal(radioVideo.sourceType, 'video');
    assert.equal(radioVideo.videoId, 'dQw4w9WgXcQ');
  }

  // YouTube Radio/Mix playlist without v=ID -> rejected with PLAYLIST_RADIO_UNSUPPORTED
  const radioPlaylist = parseCustomYouTubeUrl('https://www.youtube.com/playlist?list=RDCLAK5uy_abc');
  assert.equal(radioPlaylist.ok, false);
  if (!radioPlaylist.ok) {
    assert.equal(radioPlaylist.errorMessage, NOTICE_MESSAGES.PLAYLIST_RADIO_UNSUPPORTED);
  }

  // Start seconds parsing (&t=90, &t=1m30s, &t=1h, &t=abc)
  const t90 = parseCustomYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=90');
  assert.equal(t90.ok, true);
  if (t90.ok) {
    assert.equal(t90.startSeconds, 90);
  }

  const t1m30s = parseCustomYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s');
  assert.equal(t1m30s.ok, true);
  if (t1m30s.ok) {
    assert.equal(t1m30s.startSeconds, 90);
  }

  const t1h = parseCustomYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h');
  assert.equal(t1h.ok, true);
  if (t1h.ok) {
    assert.equal(t1h.startSeconds, 3600);
  }

  const tabc = parseCustomYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=abc');
  assert.equal(tabc.ok, true);
  if (tabc.ok) {
    assert.equal(tabc.startSeconds, undefined);
    assert.equal('startSeconds' in tabc, false);
  }

  assert.equal(parseYouTubeStartSeconds('90'), 90);
  assert.equal(parseYouTubeStartSeconds('1m30s'), 90);
  assert.equal(parseYouTubeStartSeconds('1h'), 3600);
  assert.equal(parseYouTubeStartSeconds('abc'), undefined);
});

test('parseCustomYouTubeUrl rejects non-YouTube hosts and malformed video/playlist IDs', () => {
  const spotify = parseCustomYouTubeUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
  assert.equal(spotify.ok, false);

  const evilHost = parseCustomYouTubeUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ');
  assert.equal(evilHost.ok, false);

  // Invalid video ID (not 11 chars)
  const badVid = parseCustomYouTubeUrl('https://www.youtube.com/watch?v=short');
  assert.equal(badVid.ok, false);
  if (!badVid.ok) {
    assert.equal(badVid.errorMessage, NOTICE_MESSAGES.PLAYBACK_INVALID_ID);
  }

  // Empty input
  const empty = parseCustomYouTubeUrl('   ');
  assert.equal(empty.ok, false);
});

test('normalizeForMatch, isLyricTitleMatch, and isLyricArtistMatch handle NFKC full-width, case, spaces, hyphens, tildes, and punctuation', () => {
  assert.equal(normalizeForMatch('ＹＯＡＳＯＢＩ　「アイドル！」'), 'yoasobiアイドル');
  assert.equal(normalizeForMatch('Nakanoke'), 'nakanoke');
  assert.equal(normalizeForMatch('Nakano-ke'), 'nakanoke');
  assert.equal(normalizeForMatch('Nakano ke'), 'nakanoke');
  assert.equal(
    normalizeForMatch('Nakanoke no Itsutsugo'),
    normalizeForMatch('Nakano-ke no Itsutsugo')
  );
  assert.equal(
    normalizeForMatch('Nakano-ke no Itsutsugo'),
    normalizeForMatch('Nakano ke no Itsutsugo')
  );
  assert.equal(
    normalizeForMatch('Gotoubun no Katachi ～五等分のカタチ～'),
    'gotoubunnokatachi五等分のカタチ'
  );
  assert.equal(isLyricArtistMatch('Nakanoke no Itsutsugo', 'Nakano-ke no Itsutsugo'), true);
  assert.equal(isLyricArtistMatch('Nakano ke no Itsutsugo', 'Nakano-ke no Itsutsugo'), true);
  assert.equal(isLyricTitleMatch('Payphone!', 'payphone'), true);
  assert.equal(isLyricTitleMatch('Yoru ni Kakeru ( Acoustic )', 'YoruNiKakeru'), true);
  assert.equal(isLyricTitleMatch('Ｙｏｒｕ　ｎｉ　Ｋａｋｅｒｕ', 'Yoru ni Kakeru'), true);
  assert.equal(isLyricTitleMatch('Payphone', 'Payphone - Radio Edit'), true);
  assert.equal(isLyricArtistMatch('ＹＯＡＳＯＢＩ', 'yoasobi'), true);
  assert.equal(isLyricTitleMatch('Shape of You', 'Blinding Lights'), false);
  assert.equal(isLyricTitleMatch('', 'Payphone'), false);
  assert.equal(isLyricTitleMatch('Payphone', '   '), false);
});

test('scoreLrclibCandidate and classifyLrclibSearchCandidates score title, duration closeness, and artist bonus, and accept Romaji title with Kanji artist', () => {
  assert.equal(LYRIC_MAX_DURATION_DIFF_SEC, 8);
  assert.equal(MAX_LYRIC_REQUESTS_PER_TRACK, 4);

  // Duration mismatch (> 8s difference with default tolerance)
  const mismatch = classifyLrclibSearchCandidates(
    [{ id: 1, syncedLyrics: '[00:01.00] Live version', duration: 245 }],
    200
  );
  assert.equal(mismatch.status, 'duration_mismatch');
  assert.equal(
    resolveLyricStatusNotice(mismatch.status),
    NOTICE_MESSAGES.LYRICS_DURATION_MISMATCH
  );

  // Plain lyrics only
  const plain = classifyLrclibSearchCandidates(
    [{ id: 2, syncedLyrics: null, plainLyrics: 'Some static lyrics', duration: 200 }],
    200
  );
  assert.equal(plain.status, 'plain_only');
  assert.equal(resolveLyricStatusNotice(plain.status), NOTICE_MESSAGES.LYRICS_PLAIN_ONLY);

  // Multiple versions of the same song: picks the version closest in duration within 8s
  const closest = classifyLrclibSearchCandidates(
    [
      { id: 3, trackName: 'Idol', syncedLyrics: '[00:05.00] Diff 7s', duration: 207 },
      { id: 4, trackName: 'Idol', syncedLyrics: '[00:05.00] Diff 2s', duration: 198 },
      { id: 5, trackName: 'Idol', syncedLyrics: '[00:05.00] Diff 5s', duration: 205 },
      { id: 6, trackName: 'Idol (TV Size)', syncedLyrics: '[00:05.00] TV Size', duration: 90 },
    ],
    200,
    8,
    'Idol',
    'YOASOBI'
  );
  assert.equal(closest.status, 'synced');
  assert.equal(closest.syncedLyrics, '[00:05.00] Diff 2s');
  assert.equal(closest.matchedTrack?.id, 4);

  // Cross-script artist tolerance: YouTube title in Romaji ("Gotoubun no Katachi") + Romaji artist ("Nakano-ke no Itsutsugo"),
  // while LRCLIB uses Kanji artist ("中野家の五つ子") -> still accepted because title & duration match!
  const crossScript = classifyLrclibSearchCandidates(
    [
      {
        id: 10,
        trackName: 'Gotoubun no Katachi (TV Size)',
        artistName: 'Nakano-ke no Itsutsugo',
        duration: 90,
        syncedLyrics: '[00:01.00] TV Size lyrics',
      },
      {
        id: 11,
        trackName: 'Gotoubun no Katachi',
        artistName: '中野家の五つ子',
        duration: 244,
        syncedLyrics: '[00:01.00] Full version lyrics',
      },
    ],
    243,
    8,
    'Gotoubun no Katachi',
    'Nakano-ke no Itsutsugo'
  );
  assert.equal(crossScript.status, 'synced');
  assert.equal(crossScript.syncedLyrics, '[00:01.00] Full version lyrics');
  assert.equal(crossScript.matchedTrack?.id, 11);
  assert.equal(crossScript.matchedTrack?.artistName, '中野家の五つ子');

  // Artist bonus: when two candidates have identical title and duration, the one with matching/similar artist wins
  const artistBonus = classifyLrclibSearchCandidates(
    [
      {
        id: 20,
        trackName: 'Gotoubun no Katachi',
        artistName: 'Cover Artist',
        duration: 244,
        syncedLyrics: '[00:01.00] Cover lyrics',
      },
      {
        id: 21,
        trackName: 'Gotoubun no Katachi',
        artistName: 'Nakanoke no Itsutsugo',
        duration: 244,
        syncedLyrics: '[00:01.00] Original lyrics',
      },
    ],
    244,
    8,
    'Gotoubun no Katachi',
    'Nakano-ke no Itsutsugo'
  );
  assert.equal(artistBonus.status, 'synced');
  assert.equal(artistBonus.matchedTrack?.id, 21);

  // Verify score weights directly
  const s1 = scoreLrclibCandidate(
    { trackName: 'Gotoubun no Katachi', artistName: '中野家の五つ子', duration: 243, syncedLyrics: '[00:01.00] A' },
    243,
    8,
    'Gotoubun no Katachi',
    'Nakano-ke no Itsutsugo'
  );
  assert.ok(s1);
  assert.equal(s1.titleSimilarity, 1);
  assert.equal(s1.artistSimilarity, 0);
  assert.equal(s1.score, 160); // 100 title + 60 duration + 0 artist

  assert.equal(calculateTitleSimilarity('Gotoubun no Katachi', 'Gotoubun no Katachi'), 1);
  assert.equal(calculateArtistSimilarity('Nakanoke', 'Nakano-ke'), 1);

  // With wantedTitle: duration matches but title is different -> not_found
  const wrongTitle = classifyLrclibSearchCandidates(
    [{ id: 6, trackName: 'Completely Different Song', syncedLyrics: '[00:05.00] Hi', duration: 200 }],
    200,
    8,
    'Payphone'
  );
  assert.equal(wrongTitle.status, 'not_found');
  assert.equal(wrongTitle.syncedLyrics, null);

  // Empty
  const empty = classifyLrclibSearchCandidates([], 200);
  assert.equal(empty.status, 'not_found');
  assert.equal(resolveLyricStatusNotice(empty.status), NOTICE_MESSAGES.LYRICS_NOT_AVAILABLE);
});

test('fetchLyricsWithStatusFromLrclib searches /api/search?q={judul} first, scores candidates, logs to console, and caps at 4 requests', async () => {
  const calledUrls: string[] = [];
  const loggedPayloads: unknown[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    loggedPayloads.push(args);
  };

  try {
    // 1. Primary search (/api/search?q={judul}) succeeds on the very first request even when LRCLIB artist is in Kanji
    const mockTitleFirstFetch: typeof fetch = async (input) => {
      const url = String(input);
      calledUrls.push(url);
      if (url.includes('/api/search?q=Gotoubun%20no%20Katachi')) {
        return new Response(
          JSON.stringify([
            {
              id: 101,
              trackName: 'Gotoubun no Katachi',
              artistName: '中野家の五つ子',
              duration: 244,
              syncedLyrics: '[00:01.00] 五等分のカタチ',
            },
          ]),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    const controller = new AbortController();
    const res1 = await fetchLyricsWithStatusFromLrclib(
      'Nakano-ke no Itsutsugo - Gotoubun no Katachi (Official Audio)',
      'Nakanoke no Itsutsugo - Topic',
      243,
      controller.signal,
      mockTitleFirstFetch
    );
    assert.equal(res1.status, 'synced');
    assert.equal(res1.syncedLyrics, '[00:01.00] 五等分のカタチ');
    assert.equal(res1.matchedTrack?.id, 101);
    assert.equal(calledUrls.length, 1);
    assert.ok(calledUrls[0].includes('/api/search?q=Gotoubun%20no%20Katachi'));
    if (import.meta.env?.DEV) {
      assert.ok(loggedPayloads.length >= 1);
    }

    // 2. Bilingual fallback when stage 1 & 2 return empty
    const bilingualUrls: string[] = [];
    const mockBilingualFetch: typeof fetch = async (input) => {
      const url = String(input);
      bilingualUrls.push(url);
      if (url.includes('Into%20The%20Night')) {
        return new Response(
          JSON.stringify([
            {
              id: 202,
              trackName: 'Into The Night',
              artistName: 'YOASOBI',
              duration: 260,
              syncedLyrics: '[00:02.00] Seize the day',
            },
          ]),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    const resBilingual = await fetchLyricsWithStatusFromLrclib(
      '夜に駆ける (Into The Night) [Official MV]',
      'YOASOBI',
      260,
      controller.signal,
      mockBilingualFetch
    );
    assert.equal(resBilingual.status, 'synced');
    assert.equal(resBilingual.matchedTrack?.id, 202);
    assert.ok(bilingualUrls[0].includes('/api/search?q=%E5%A4%9C%E3%81%AB%E9%A7%86%E3%81%91%E3%82%8B'));
    assert.ok(bilingualUrls.length <= 4);
  } finally {
    console.log = origLog;
  }
});

test('shouldReplaceNotice prevents lyrics notice from overwriting playback or playlist notices', () => {
  assert.equal(shouldReplaceNotice(null, 'lyrics'), true);
  assert.equal(shouldReplaceNotice('lyrics', 'lyrics'), true);
  assert.equal(shouldReplaceNotice('playback', 'lyrics'), false);
  assert.equal(shouldReplaceNotice('playlist', 'lyrics'), false);
  assert.equal(shouldReplaceNotice('lyrics', 'playback'), true);
  assert.equal(shouldReplaceNotice('playback', 'playlist'), true);
});

test('resolvePlaybackErrorNotice and isNonSkippablePlayerError map YouTube IFrame error codes accurately', () => {
  assert.equal(resolvePlaybackErrorNotice(101), NOTICE_MESSAGES.PLAYBACK_EMBED_BLOCKED);
  assert.equal(resolvePlaybackErrorNotice(150), NOTICE_MESSAGES.PLAYBACK_EMBED_BLOCKED);
  assert.equal(resolvePlaybackErrorNotice(100), NOTICE_MESSAGES.PLAYBACK_NOT_FOUND);
  assert.equal(resolvePlaybackErrorNotice(2), NOTICE_MESSAGES.PLAYBACK_INVALID_ID);
  assert.equal(resolvePlaybackErrorNotice(153), NOTICE_MESSAGES.PLAYBACK_EMBED_CONFIG_ERROR);
  assert.equal(resolvePlaybackErrorNotice(5), NOTICE_MESSAGES.PLAYBACK_GENERIC_ERROR);
  assert.equal(isNonSkippablePlayerError(153), true);
  assert.equal(isNonSkippablePlayerError(101), false);
});

test('formatDurationMmSs, formatDurationDiffSigned, formatLyricCandidateLabel, shouldWarnLyricDurationDiff, and sortLyricCandidatesByDurationDiff work accurately', () => {
  assert.equal(formatDurationMmSs(244), '4:04');
  assert.equal(formatDurationMmSs(65), '1:05');
  assert.equal(formatDurationMmSs(0), '0:00');

  assert.equal(formatDurationDiffSigned(246, 243), '+0:03');
  assert.equal(formatDurationDiffSigned(241, 243), '-0:02');
  assert.equal(formatDurationDiffSigned(243, 243), '+0:00');
  assert.equal(formatDurationDiffSigned(318, 243), '+1:15');

  assert.equal(
    formatLyricCandidateLabel({
      trackName: 'Gotoubun no Katachi',
      artistName: 'Nakano-ke no Itsutsugo',
      duration: 244,
    }),
    'Gotoubun no Katachi - Nakano-ke no Itsutsugo (4:04)'
  );

  // Warning threshold is > 3 seconds
  assert.equal(shouldWarnLyricDurationDiff(246, 243), false); // diff = 3s
  assert.equal(shouldWarnLyricDurationDiff(247, 243), true); // diff = 4s (> 3s)
  assert.equal(shouldWarnLyricDurationDiff(238, 243), true); // diff = 5s (> 3s)
  assert.equal(
    NOTICE_MESSAGES.LYRICS_DURATION_WARN,
    'Lirik mungkin tidak pas dengan versi lagu ini. Coba ganti versi lirik.'
  );

  // classifyLrclibSearchCandidates collects all syncedLyrics candidates sorted by smallest duration diff
  const classified = classifyLrclibSearchCandidates(
    [
      {
        id: 1,
        trackName: 'Idol (TV Size)',
        artistName: 'YOASOBI',
        duration: 90,
        syncedLyrics: '[00:01.00] TV',
      },
      {
        id: 2,
        trackName: 'Idol',
        artistName: 'YOASOBI',
        duration: 218,
        syncedLyrics: '[00:01.00] MV',
      },
      {
        id: 3,
        trackName: 'Idol',
        artistName: 'YOASOBI',
        duration: 213,
        syncedLyrics: '[00:01.00] Audio',
      },
      {
        id: 4,
        trackName: 'Idol',
        artistName: 'YOASOBI',
        duration: 215,
        syncedLyrics: null,
        plainLyrics: 'Plain only',
      },
    ],
    212,
    8,
    'Idol',
    'YOASOBI'
  );

  assert.equal(classified.candidates.length, 3);
  assert.deepEqual(
    classified.candidates.map((c) => c.id),
    [3, 2, 1] // diffs from 212s: |213-212|=1s, |218-212|=6s, |90-212|=122s
  );

  const sorted = sortLyricCandidatesByDurationDiff(classified.candidates, 217);
  assert.deepEqual(
    sorted.map((c) => c.id),
    [2, 3, 1] // diffs from 217s: |218-217|=1s, |213-217|=4s, |90-217|=127s
  );
});


