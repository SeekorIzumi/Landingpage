import { useEffect, useRef } from 'react';
import { siteConfig } from '../config/siteConfig';

interface LocationModalProps {
  isOpen: boolean;
  isGpsOffError: boolean;
  onAllow: () => void;
  onDeny: () => void;
}

export function LocationModal({
  isOpen,
  isGpsOffError,
  onAllow,
  onDeny,
}: LocationModalProps) {
  const allowBtnRef = useRef<HTMLButtonElement | null>(null);
  const denyBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      if (document.activeElement instanceof HTMLElement) {
        previousActiveElementRef.current = document.activeElement;
      }
      allowBtnRef.current?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      previousActiveElementRef.current?.focus();
      previousActiveElementRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDeny();
        return;
      }

      if (e.key === 'Tab') {
        const denyEl = denyBtnRef.current;
        const allowEl = allowBtnRef.current;
        if (!denyEl || !allowEl) return;

        e.preventDefault();
        if (e.shiftKey) {
          if (document.activeElement === allowEl) {
            denyEl.focus();
          } else {
            allowEl.focus();
          }
        } else {
          if (document.activeElement === denyEl) {
            allowEl.focus();
          } else {
            denyEl.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onDeny]);

  const modalCopy = isGpsOffError
    ? siteConfig.widgets.locationModal.gpsOffVariant
    : siteConfig.widgets.locationModal.defaultVariant;

  return (
    <div
      className={`modal-overlay${isOpen ? ' active' : ''}`}
      id="loc-modal-overlay"
      aria-hidden={!isOpen ? 'true' : undefined}
    >
      <div
        className="loc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-modal-title"
      >
        <div className="loc-modal-icon" aria-hidden="true">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div className="loc-modal-title" id="loc-modal-title">
          {modalCopy.title}
        </div>
        <div className="loc-modal-desc">{modalCopy.description}</div>
        <div className="loc-modal-actions">
          <button
            ref={denyBtnRef}
            type="button"
            className="loc-btn btn-deny"
            id="btn-loc-deny"
            tabIndex={isOpen ? 0 : -1}
            onClick={onDeny}
          >
            {modalCopy.denyButton}
          </button>
          <button
            ref={allowBtnRef}
            type="button"
            className="loc-btn btn-allow"
            id="btn-loc-allow"
            tabIndex={isOpen ? 0 : -1}
            onClick={onAllow}
          >
            {modalCopy.allowButton}
          </button>
        </div>
      </div>
    </div>
  );
}
