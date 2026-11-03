import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { siteConfig } from '../config/siteConfig';
import { calculateMagneticOffset } from '../utils/helpers';

export function Hero() {
  const sealRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const seal = sealRef.current;
    if (!seal) return;
    const rect = seal.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { translateX, translateY } = calculateMagneticOffset(
      x,
      y,
      rect.width,
      rect.height,
      0.3
    );
    seal.style.transform = `translate(${translateX}px, ${translateY}px)`;
    seal.style.transition = 'transform 0.1s ease-out';
  };

  const handleMouseLeave = () => {
    const seal = sealRef.current;
    if (!seal) return;
    seal.style.transform = 'translate(0px, 0px)';
    seal.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
  };

  return (
    <section className="hero" aria-label="Identity">
      <div className="seal-wrapper">
        <div
          ref={sealRef}
          className="seal-container"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="seal-ring" />
          <div className="seal" aria-hidden="true">
            {!imgError ? (
              <img
                src={siteConfig.profileImage}
                alt="Profile Picture"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="seal-fallback">I</div>
            )}
          </div>
        </div>
      </div>

      <h1 className="brand">{siteConfig.brandName}</h1>
      <div className="creator-tag">{siteConfig.creator}</div>

      <p className="tagline">
        {siteConfig.tagline.prefix}
        <span className="rotating-words">
          {siteConfig.tagline.rotatingWords.map((word) => (
            <span key={word} className="word">
              {word}
            </span>
          ))}
        </span>
        {siteConfig.tagline.suffix}
      </p>
    </section>
  );
}
