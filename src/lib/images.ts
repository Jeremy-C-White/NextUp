export type ArtworkSize = "hero" | "poster";

export function optimizeArtworkUrl(url?: string, size: ArtworkSize = "hero"): string {
  if (!url) return "";
  const tmdbSize = size === "hero" ? "w1280" : "w500";
  return url
    .replace(/\/t\/p\/(?:original|w1280|w780|w500|w342)\//, `/t/p/${tmdbSize}/`);
}
