export type CardIconType = 'music' | 'gift' | 'list-music' | 'book-open' | 'sparkles' | 'whatsapp';

export interface CardSubLink {
  id: string;
  label: string;
  emptyLabel?: string;
  href: string;
}

export interface CardExpandableRules {
  toggleLabel: string;
  items: string[];
}

export interface LinkCardItem {
  id: string;
  title: string;
  description: string;
  href?: string;
  ariaLabel: string;
  newTab: boolean;
  icon: CardIconType;
  subLinks?: CardSubLink[];
  expandableRules?: CardExpandableRules;
}

export const siteConfig = {
  brandName: 'Izumi',
  creator: 'made by Seekor Izumi',
  profileImage: 'assets/pfp.jpg',
  tagline: {
    prefix: 'I’m ',
    rotatingWords: ['building', 'keeping', 'refining', 'making'],
    suffix: ' simple things.',
  },
  cards: [
    {
      id: 'tiktok',
      title: 'Seekor Izumi (TikTok)',
      description: 'Lyrics video di sini yaaa',
      href: 'https://www.tiktok.com/@shirakawaizumi_',
      ariaLabel: 'Seekor Izumi (TikTok)',
      newTab: true,
      icon: 'music',
    },
    {
      id: 'request-lagu',
      title: 'Request Lagu',
      description:
        'Donasi mulai Rp5.000 via Saweria. Tulis judul lagu + artis di pesan yaaa',
      href: 'https://saweria.co/SeekorIzumi',
      ariaLabel: 'Request Lagu',
      newTab: true,
      icon: 'gift',
      expandableRules: {
        toggleLabel: 'Lihat aturan',
        items: [
          'Rp5.000: antrean biasa, sesuai urutan masuk',
          'Rp10.000: didahulukan',
          'Tulis judul lagu dan nama artis di pesan donasi',
          'Slot terbatas tiap minggu. Kalau penuh, request ditunda ke minggu berikutnya',
        ],
      },
    },
    {
      id: 'playlist',
      title: 'Playlist',
      description: 'Izumi After Midnight: songs for the quiet hours',
      href: 'https://music.youtube.com/playlist?list=PLR7rGtQ516NM&si=sq-7n1OZjvoBihdN',
      ariaLabel: 'Playlist',
      newTab: true,
      icon: 'list-music',
      subLinks: [
        {
          id: 'yt-music',
          label: 'YouTube Music',
          href: 'https://music.youtube.com/playlist?list=PLR7rGtQ516NM&si=sq-7n1OZjvoBihdN',
        },
        {
          id: 'spotify',
          label: 'Spotify',
          emptyLabel: 'Segera hadir',
          href: '',
        },
      ],
    },
    {
      id: 'izumipedia',
      title: 'IzumiPedia',
      description: 'Database karakter anime dan manga di sini yaaa',
      href: 'https://kiyora.web.id/',
      ariaLabel: 'IzumiPedia',
      newTab: true,
      icon: 'book-open',
    },
    {
      id: 'saluran-wa',
      title: 'Saluran WA Izumi',
      description: 'Info dan update terbaru di sini yaaa',
      href: 'https://whatsapp.com/channel/0029VbDpHgSBVJlBQ5dPyP3Q',
      ariaLabel: 'Saluran WA Izumi',
      newTab: true,
      icon: 'whatsapp',
    },
  ] as LinkCardItem[],
  flavor: {
    label: 'currently',
    textBefore: 're-reading ',
    rotatingTitles: [
      'Attack on Titan',
      'Gotoubun no Hanayome',
      'Kimi no Na wa',
      'A Silent Voice',
      'Tenki no Ko',
    ],
    textAfter: 'and collecting small, beautiful things.',
  },
  footer: {
    prefix: 'made with stillness \u00A0·\u00A0 ',
    highlightWord: 'Izumi',
  },
  widgets: {
    locationClock: {
      locationPlaceholder: 'Locating...',
      localStorageKey: 'izumi_gps_allowed_v1',
      gpsReverseGeocodeUrl: (lat: number, lon: number) =>
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`,
    },
    locationModal: {
      defaultVariant: {
        title: 'Izin Akses Lokasi',
        description:
          'Izumi ingin menampilkan nama kota Anda di pojok layar agar terasa lebih personal. Akses ini hanya digunakan untuk fitur tersebut dan lokasi Anda tidak akan kami simpan.',
        allowButton: 'Izinkan',
        denyButton: 'Nanti Saja',
      },
      gpsOffVariant: {
        title: 'GPS Perangkat Mati',
        description:
          'Akses browser sudah diizinkan, tapi fitur GPS perangkat Anda sedang mati. Tolong nyalakan GPS (Lokasi) di perangkat lalu coba lagi.',
        allowButton: 'Coba Lagi',
        denyButton: 'Nanti Saja',
      },
    },
    musicPlayer: {
      playlistId: 'PLR7rGtQ516NM',
      playlistUrl: 'https://music.youtube.com/playlist?list=PLR7rGtQ516NM',
      albumArtSrc: 'assets/song.jpg',
      title: 'Gotoubun no Kimochi',
      artist: 'Nakano-ke no Itsutsugo',
    },
  },
};
