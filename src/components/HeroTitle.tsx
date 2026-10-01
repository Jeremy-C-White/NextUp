import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { UserShow } from "../types";
import { readCachedTitleLogo, resolveTitleLogo, TitleLogo } from "../lib/titleLogos";

// Hero cards are intentionally remounted as the carousel advances. Remember
// which logo assets have already decoded so a remounted card can paint its
// logo immediately instead of briefly returning to the loading state.
const decodedLogoUrls = new Set<string>();

/**
 * The title's logo from the cache, looking it up once when it is not known yet.
 * Returns null while unknown or when the title has no logo.
 */
export function useTitleLogo(show: UserShow | undefined): TitleLogo | null {
  const showId = show?.id;
  const [, setRevision] = useState(0);
  const cached = readCachedTitleLogo(showId);

  useEffect(() => {
    if (!show || readCachedTitleLogo(show.id) !== undefined) return;
    let active = true;
    resolveTitleLogo(show).then(
      () => { if (active) setRevision(revision => revision + 1); },
      () => undefined
    );
    return () => { active = false; };
  }, [showId]);

  return cached ?? null;
}

type HeadingTag = "h2" | "h3";

interface HeroTitleProps {
  name: string;
  logo: TitleLogo | null;
  headingClassName: string;
  as?: HeadingTag;
  variant?: "hero" | "loading";
}

/**
 * Shows the title's logo art when there is one, and the text title otherwise.
 * The logo's box is reserved at its final size, so nothing shifts when it
 * appears. If the logo is slow to arrive, the text title shows in its place.
 * The text heading always stays in the page for screen readers.
 */
export function HeroTitle({ name, logo, headingClassName, as: Heading = "h3", variant = "hero" }: HeroTitleProps) {
  // When the logo is already known as the title appears, the text waits
  // briefly for it. When the logo is found while the text is showing, the text
  // simply stays until the logo is ready.
  const [delayTextReveal] = useState(() => Boolean(logo));
  const [loadedUrl, setLoadedUrl] = useState<string | null>(() =>
    logo && decodedLogoUrls.has(logo.url) ? logo.url : null
  );
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const logoUrl = logo && logo.url !== failedUrl ? logo.url : null;
  const state = !logoUrl ? "none" : loadedUrl === logoUrl ? "ready" : "loading";
  const style = logoUrl
    ? ({ "--logo-ar": String(Math.min(12, Math.max(0.5, logo!.aspectRatio))) } as CSSProperties)
    : undefined;

  return (
    <div
      data-tv-hero-title="true"
      data-hero-title-variant={variant}
      data-logo-state={state}
      data-logo-reveal={delayTextReveal ? "delayed" : "immediate"}
      style={style}
    >
      <Heading data-tv-hero-title-text="true" className={headingClassName}>{name}</Heading>
      {logoUrl && (
        <img
          key={logoUrl}
          src={logoUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          referrerPolicy="no-referrer"
          data-tv-hero-logo="true"
          data-logo-tone={logo!.tone}
          onLoad={() => {
            decodedLogoUrls.add(logoUrl);
            setLoadedUrl(logoUrl);
          }}
          onError={() => {
            decodedLogoUrls.delete(logoUrl);
            setFailedUrl(logoUrl);
          }}
        />
      )}
    </div>
  );
}
