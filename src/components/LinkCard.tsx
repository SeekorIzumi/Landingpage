import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent } from 'react';
import { BookOpen, ChevronDown, Gift, Headphones, ListMusic, Music, Sparkles } from 'lucide-react';
import type { CardIconType, CardSubLink, LinkCardItem } from '../config/siteConfig';
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

function renderSubLinkPlatformIcon(sub: CardSubLink, index: number) {
  const lowerId = sub.id.toLowerCase();
  const lowerLabel = sub.label.toLowerCase();
  if (lowerId.includes('spotify') || lowerLabel.includes('spotify') || index % 2 === 1) {
    return <Headphones className="card-arrow-menu-item-icon" aria-hidden="true" />;
  }
  return <Music className="card-arrow-menu-item-icon" aria-hidden="true" />;
}

interface LinkCardProps {
  card: LinkCardItem;
}

export function LinkCard({ card }: LinkCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const arrowWrapRef = useRef<HTMLDivElement | null>(null);
  const arrowButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);

  const availableSubLinks = (card.subLinks ?? []).filter((sub) =>
    Boolean(sub.href && sub.href.trim().length > 0)
  );
  const hasMultipleSubLinks = availableSubLinks.length >= 2;
  const menuId = `card-platform-menu-${card.id}`;

  const resetCardTransform = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = 'scale3d(1, 1, 1) rotateX(0deg) rotateY(0deg)';
    el.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';

    if (glareRef.current) {
      glareRef.current.style.background =
        'radial-gradient(circle at 50% 50%, rgba(143, 163, 199, 0.16), transparent 60%)';
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (isMenuOpen) return;
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
    resetCardTransform();
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

  const computeShouldOpenUpward = () => {
    const btn = arrowButtonRef.current;
    if (!btn || typeof window === 'undefined') return false;
    const rect = btn.getBoundingClientRect();
    const isCompactViewport = window.innerWidth < 1024;
    const itemHeight = isCompactViewport ? 46 : 38;
    const estimatedMenuHeight = 36 + availableSubLinks.length * itemHeight;
    const playerEl = isCompactViewport ? document.querySelector('.music-player') : null;
    const playerTop = playerEl ? playerEl.getBoundingClientRect().top : window.innerHeight;
    const bottomLimit = isCompactViewport
      ? Math.min(window.innerHeight - 12, playerTop - 8)
      : window.innerHeight - 12;
    const spaceBelow = bottomLimit - rect.bottom;
    return spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight;
  };

  const openMenu = (focusFirstItem: boolean) => {
    resetCardTransform();
    setOpenUpward(computeShouldOpenUpward());
    setIsMenuOpen(true);
    if (focusFirstItem) {
      window.requestAnimationFrame(() => {
        const firstItem = menuRef.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]');
        firstItem?.focus();
      });
    }
  };

  const handleToggleMenuClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMenuOpen) {
      setIsMenuOpen(false);
    } else {
      // detail === 0 indicates keyboard activation (Enter / Space) on button
      openMenu(e.detail === 0);
    }
  };

  const handleArrowButtonKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (!isMenuOpen) {
        openMenu(true);
      } else {
        const firstItem = menuRef.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]');
        firstItem?.focus();
      }
    } else if (e.key === 'Escape' && isMenuOpen) {
      e.preventDefault();
      e.stopPropagation();
      setIsMenuOpen(false);
      arrowButtonRef.current?.focus();
    }
  };

  const handleMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []
    );
    if (items.length === 0) return;
    const activeEl = document.activeElement as HTMLAnchorElement | null;
    const currentIdx = activeEl ? items.indexOf(activeEl) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % items.length;
      items[nextIdx]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const prevIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1;
      items[prevIdx]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsMenuOpen(false);
      arrowButtonRef.current?.focus();
    } else if (e.key === 'Tab') {
      setIsMenuOpen(false);
    }
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDownOutside = (e: globalThis.MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (arrowWrapRef.current?.contains(target)) return;
      setIsMenuOpen(false);
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsMenuOpen(false);
        arrowButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside, { passive: true });
    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isMenuOpen]);

  const hasSubLinks = Boolean(card.subLinks && card.subLinks.length > 0);
  const hasRules = Boolean(card.expandableRules && card.expandableRules.items.length > 0);
  const singleAvailableHref =
    availableSubLinks.length === 1 ? availableSubLinks[0].href : card.href;

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
      {hasSubLinks && hasMultipleSubLinks ? (
        <div ref={arrowWrapRef} className="card-arrow-menu-wrap">
          <button
            ref={arrowButtonRef}
            type="button"
            className={`arrow arrow-menu-trigger${isMenuOpen ? ' is-open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
            aria-label={`Pilih platform untuk membuka ${card.title}`}
            onClick={handleToggleMenuClick}
            onKeyDown={handleArrowButtonKeyDown}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          {isMenuOpen && (
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={`Pilih platform untuk membuka ${card.title}`}
              className={`card-arrow-menu${openUpward ? ' is-upward' : ''}`}
              onKeyDown={handleMenuKeyDown}
            >
              <div className="card-arrow-menu-header" aria-hidden="true">
                Buka di
              </div>
              {availableSubLinks.map((sub, idx) => (
                <a
                  key={sub.id}
                  href={sub.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  className="card-arrow-menu-item"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {renderSubLinkPlatformIcon(sub, idx)}
                  <span className="card-arrow-menu-item-label">{sub.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : hasSubLinks && singleAvailableHref ? (
        <a
          href={singleAvailableHref}
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
        className={`card card-with-pills${isMenuOpen ? ' is-menu-open' : ''}`}
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

