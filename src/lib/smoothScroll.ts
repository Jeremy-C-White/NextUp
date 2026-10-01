/**
 * Eased scrolling for TV rows and pages.
 *
 * Moving focus past the edge of a row used to jump the row instantly. Rows now
 * glide to the new position. A new move while a glide is running continues
 * from where the row is heading, so quick presses add up instead of lagging,
 * and holding a direction uses a shorter glide that keeps pace with the remote.
 */

export interface ScrollableElement {
  scrollLeft: number;
  scrollTop: number;
  readonly scrollWidth: number;
  readonly scrollHeight: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
}
export type GlideSpeed = "instant" | "glide" | "quick";

export const GLIDE_DURATION_MS = 280;
export const QUICK_GLIDE_DURATION_MS = 130;
const FRAME_MS = 16;

interface Glide {
  fromLeft: number;
  fromTop: number;
  toLeft: number;
  toTop: number;
  /** Set on the first animation frame, so the whole curve is always shown. */
  start: number | null;
  duration: number;
  frame: number | null;
}

const glides = new WeakMap<ScrollableElement, Glide>();

export function easeOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return 1 - Math.pow(1 - clamped, 3);
}

export function glideDurationFor(speed: GlideSpeed): number {
  if (speed === "quick") return QUICK_GLIDE_DURATION_MS;
  if (speed === "glide") return GLIDE_DURATION_MS;
  return 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Distance still to travel for a running glide (0 when none is running). */
export function getPendingScroll(element: ScrollableElement): { left: number; top: number } {
  const glide = glides.get(element);
  if (!glide) return { left: 0, top: 0 };
  return { left: glide.toLeft - element.scrollLeft, top: glide.toTop - element.scrollTop };
}

/** Stop any glide on this element where it is (used when the wheel takes over). */
export function stopGlide(element: ScrollableElement) {
  const glide = glides.get(element);
  if (!glide) return;
  if (glide.frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(glide.frame);
  glides.delete(element);
}

/**
 * Scroll by (left, top) relative to where the element is already heading.
 * The target is clamped to the scrollable range.
 */
export function glideScrollBy(element: ScrollableElement, left: number, top: number, speed: GlideSpeed = "glide") {
  const existing = glides.get(element);
  const baseLeft = existing ? existing.toLeft : element.scrollLeft;
  const baseTop = existing ? existing.toTop : element.scrollTop;
  const toLeft = clamp(baseLeft + left, 0, Math.max(0, element.scrollWidth - element.clientWidth));
  const toTop = clamp(baseTop + top, 0, Math.max(0, element.scrollHeight - element.clientHeight));
  if (existing?.frame != null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(existing.frame);
  glides.delete(element);

  const duration = glideDurationFor(speed);
  const canAnimate = duration > 0
    && typeof requestAnimationFrame === "function"
    && !prefersReducedMotion();

  if (!canAnimate) {
    element.scrollLeft = toLeft;
    element.scrollTop = toTop;
    return;
  }
  if (Math.abs(toLeft - element.scrollLeft) < 0.5 && Math.abs(toTop - element.scrollTop) < 0.5) return;

  const glide: Glide = {
    fromLeft: element.scrollLeft,
    fromTop: element.scrollTop,
    toLeft,
    toTop,
    start: null,
    duration,
    frame: null
  };

  const step = (now: number) => {
    if (glides.get(element) !== glide) return;
    // Start one frame back so the first frame already moves.
    if (glide.start === null) glide.start = now - FRAME_MS;
    const progress = (now - glide.start) / glide.duration;
    const eased = easeOutCubic(progress);
    element.scrollLeft = glide.fromLeft + (glide.toLeft - glide.fromLeft) * eased;
    element.scrollTop = glide.fromTop + (glide.toTop - glide.fromTop) * eased;
    if (progress < 1) {
      glide.frame = requestAnimationFrame(step);
    } else {
      element.scrollLeft = glide.toLeft;
      element.scrollTop = glide.toTop;
      glides.delete(element);
    }
  };

  glides.set(element, glide);
  glide.frame = requestAnimationFrame(step);
}
