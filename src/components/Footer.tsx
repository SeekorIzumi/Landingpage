import { siteConfig } from '../config/siteConfig';

export function Footer() {
  return (
    <footer className="footer">
      <svg className="footer-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <p className="footer-text">
        {siteConfig.footer.prefix}
        <span>{siteConfig.footer.highlightWord}</span>
      </p>
    </footer>
  );
}
