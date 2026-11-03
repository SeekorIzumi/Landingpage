import { useCallback, useEffect, useState } from 'react';
import { AmbientBackground } from './components/AmbientBackground';
import { CursorGlow } from './components/CursorGlow';
import { Flavor } from './components/Flavor';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { LinkCard } from './components/LinkCard';
import { LocationClock } from './components/LocationClock';
import { LocationModal } from './components/LocationModal';
import { InlineLyricsSlot, MusicPlayer } from './components/MusicPlayer';
import { siteConfig } from './config/siteConfig';
import { formatReverseGeocodeLocation, parseTimezoneCity } from './utils/helpers';

export default function App() {
  const [locationText, setLocationText] = useState<string>(
    siteConfig.widgets.locationClock.locationPlaceholder
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isGpsOffError, setIsGpsOffError] = useState<boolean>(false);

  const fallbackLocation = useCallback(() => {
    setLocationText(parseTimezoneCity());
  }, []);

  const showModal = useCallback((gpsOff = false) => {
    setIsGpsOffError(gpsOff);
    setIsModalOpen(true);
  }, []);

  const fetchGPSLocation = useCallback(
    async (lat: number, lon: number) => {
      try {
        const roundedLat = Math.round(lat * 100) / 100;
        const roundedLon = Math.round(lon * 100) / 100;
        const res = await fetch(
          siteConfig.widgets.locationClock.gpsReverseGeocodeUrl(roundedLat, roundedLon)
        );
        if (!res.ok) {
          throw new Error('Reverse geocode request failed');
        }
        const data = await res.json();
        const formatted = formatReverseGeocodeLocation(data);
        if (!formatted) {
          throw new Error('Empty location');
        }
        setLocationText(formatted);
      } catch {
        fallbackLocation();
      }
    },
    [fallbackLocation]
  );

  const requestGPS = useCallback(() => {
    setLocationText(siteConfig.widgets.locationClock.locationPlaceholder);
    if (!navigator.geolocation) {
      fallbackLocation();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void fetchGPSLocation(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        fallbackLocation();
        if (err.code === err.PERMISSION_DENIED) {
          // Pengguna menolak: hapus flag, JANGAN munculkan modal lagi.
          try {
            localStorage.removeItem(siteConfig.widgets.locationClock.localStorageKey);
          } catch {
            // ignore storage errors
          }
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          showModal(true); // GPS/layanan lokasi perangkat benar-benar tidak tersedia
        }
        // TIMEOUT: diam saja, cukup tampilkan kota dari timezone.
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }, [fallbackLocation, fetchGPSLocation, showModal]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      fallbackLocation();
      return;
    }

    const storageKey = siteConfig.widgets.locationClock.localStorageKey;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (result.state === 'granted') {
            requestGPS();
          } else if (result.state === 'prompt') {
            showModal(false);
          } else {
            fallbackLocation();
          }
        })
        .catch(() => {
          try {
            const hasAllowed = localStorage.getItem(storageKey);
            if (hasAllowed) {
              requestGPS();
            } else {
              showModal(false);
            }
          } catch {
            showModal(false);
          }
        });
    } else {
      try {
        const hasAllowed = localStorage.getItem(storageKey);
        if (hasAllowed) {
          requestGPS();
        } else {
          showModal(false);
        }
      } catch {
        showModal(false);
      }
    }
  }, [fallbackLocation, requestGPS, showModal]);

  const handleDenyLocation = () => {
    setIsModalOpen(false);
    fallbackLocation();
  };

  const handleAllowLocation = () => {
    setIsModalOpen(false);
    try {
      localStorage.setItem(siteConfig.widgets.locationClock.localStorageKey, 'true');
    } catch {
      // ignore storage errors
    }
    requestGPS();
  };

  return (
    <>
      <AmbientBackground />
      <CursorGlow />
      <LocationClock locationText={locationText} />
      <MusicPlayer />
      <LocationModal
        isOpen={isModalOpen}
        isGpsOffError={isGpsOffError}
        onAllow={handleAllowLocation}
        onDeny={handleDenyLocation}
      />

      <div className="wrapper">
        <Hero />

        <InlineLyricsSlot />

        <div className="rule" aria-hidden="true">
          <div className="rule-mark" />
        </div>

        <nav className="cards" aria-label="Links">
          {siteConfig.cards.map((card) => (
            <LinkCard key={card.id} card={card} />
          ))}
        </nav>

        <Flavor />
        <Footer />
      </div>
    </>
  );
}
