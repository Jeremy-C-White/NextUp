/**
 * A tiny shared value for the page's ambient colour glow: the artwork of the
 * title the viewer has settled on in Next Up. Kept outside React state so a
 * title change never re-renders the whole app.
 */

type Listener = () => void;

let currentArtwork: string | null = null;
const listeners = new Set<Listener>();

export function getAmbientArtwork(): string | null {
  return currentArtwork;
}

export function setAmbientArtwork(url: string | null) {
  const next = url || null;
  if (next === currentArtwork) return;
  currentArtwork = next;
  listeners.forEach(listener => listener());
}

export function subscribeAmbientArtwork(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

