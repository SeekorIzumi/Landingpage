import { siteConfig } from '../config/siteConfig';

export function Flavor() {
  return (
    <section className="flavor" aria-label="Currently">
      <p className="flavor-label">{siteConfig.flavor.label}</p>
      <p className="flavor-quote">
        {siteConfig.flavor.textBefore}
        <em className="rotating-titles">
          {siteConfig.flavor.rotatingTitles.map((title) => (
            <span key={title} className="title">
              {title}
            </span>
          ))}
        </em>
        <br />
        {siteConfig.flavor.textAfter}
      </p>
    </section>
  );
}
