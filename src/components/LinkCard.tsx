import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { BookOpen, ChevronDown, Gift, ListMusic, Music, Sparkles } from 'lucide-react';
import type { CardIconType, LinkCardItem } from '../config/siteConfig';
import { calculateCardTilt } from '../utils/helpers';

function renderCardIcon(icon: CardIconType) {
  switch (icon) {
    case 'music':
      return <Music />;
    case 'gift':
      return <Gift />;
    case 'list-music':
      return <ListMusic />;
    case 'book-open':
      return <BookOpen />;
    case 'sparkles':
      return <Sparkles />;
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
          <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
        </svg>
      );
  }
}

interface LinkCardProps {
  card: LinkCardItem;
}

export function LinkCard({ card }: LinkCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { rotateX, rotateY } = calculateCardTilt(x, y, rect.width, rect.height, 8);

    el.style.transform = `scale3d(1.02, 1.02, 1.02) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    el.style.transition = 'transform 0.1s ease-out';

    if (glareRef.current) {
      glareRef.current.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(143, 163, 199, 0.18), transparent 60%)`;
    }
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = 'scale3d(1, 1, 1) rotateX(0deg) rotateY(0deg)';
    el.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';

    if (glareRef.current) {
      glareRef.current.style.background =
        'radial-gradient(circle at 50% 50%, rgba(143, 163, 199, 0.16), transparent 60%)';
    }
  };

  const handleToggleRules = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRulesOpen((prev) => !prev);
  };

  const handleRulesBoxClick = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const hasSubLinks = Boolean(card.subLinks && card.subLinks.length > 0);
  const hasRules = Boolean(card.expandableRules && card.expandableRules.items.length > 0);

  const innerContent = (
    <>
      <div ref={glareRef} className="card-glare" />
      <div className="card-icon" aria-hidden="true">
        {renderCardIcon(card.icon)}
      </div>
      <div className="card-body">
        <div className="card-title">{card.title}</div>
        <div className="card-desc">{card.description}</div>
        {hasRules && (
          <div className="card-rules-section">
            <button
              type="button"
              className={`card-rules-toggle${isRulesOpen ? ' is-open' : ''}`}
              aria-expanded={isRulesOpen}
              onClick={handleToggleRules}
            >
              <span>{card.expandableRules!.toggleLabel}</span>
              <ChevronDown className="card-rules-chevron" aria-hidden="true" />
            </button>
            <div
              className={`card-rules-collapse${isRulesOpen ? ' is-open' : ''}`}
              aria-hidden={!isRulesOpen}
              onClick={handleRulesBoxClick}
            >
              <div className="card-rules-inner">
                <ul className="card-rules-list">
                  {card.expandableRules!.items.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        {hasSubLinks && (
          <div className="card-pills">
            {card.subLinks!.map((sub) => {
              const isAvailable = Boolean(sub.href && sub.href.trim().length > 0);
              if (isAvailable) {
                return (
                  <a
                    key={sub.id}
                    href={sub.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-pill"
                  >
                    {sub.label}
                  </a>
                );
              }
              return (
                <button
                  key={sub.id}
                  type="button"
                  className="card-pill is-disabled"
                  disabled
                  aria-disabled="true"
                >
                  {sub.emptyLabel || sub.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {hasSubLinks && card.href ? (
        <a
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          className="arrow"
          aria-label={`Open ${card.title}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </a>
      ) : (
        <div className="arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      )}
    </>
  );

  if (hasSubLinks) {
    return (
      <div
        ref={(node) => {
          cardRef.current = node;
        }}
        className="card card-with-pills"
        role="group"
        aria-label={card.ariaLabel}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {innerContent}
      </div>
    );
  }

  return (
    <a
      ref={(node) => {
        cardRef.current = node;
      }}
      href={card.href}
      className="card"
      aria-label={card.ariaLabel}
      target={card.newTab ? '_blank' : undefined}
      rel={card.newTab ? 'noopener noreferrer' : undefined}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {innerContent}
    </a>
  );
}
