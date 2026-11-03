import { useEffect, useState } from 'react';
import { formatTimeDot } from '../utils/helpers';

interface LocationClockProps {
  locationText: string;
}

export function LocationClock({ locationText }: LocationClockProps) {
  const [timeText, setTimeText] = useState<string>(() => formatTimeDot(new Date()));

  useEffect(() => {
    const updateTime = () => {
      setTimeText(formatTimeDot(new Date()));
    };
    updateTime();
    const intervalId = setInterval(updateTime, 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="location-clock" aria-hidden="true">
      <div className="loc" id="user-location">
        {locationText}
      </div>
      <div className="time" id="user-time">
        {timeText}
      </div>
    </div>
  );
}
