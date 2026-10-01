export interface CarouselWheelState {
  accumulatedDelta: number;
  lastEventAt: number;
  lockedUntil: number;
}

export interface CarouselWheelResult {
  direction: -1 | 1 | null;
  state: CarouselWheelState;
}

export const createCarouselWheelState = (): CarouselWheelState => ({
  accumulatedDelta: 0,
  lastEventAt: 0,
  lockedUntil: 0
});

/** The card currently being revealed by a phone drag, before the swipe lands. */
export function getCarouselPreviewIndex(
  activeIndex: number,
  itemCount: number,
  dragOffset: number,
  revealThreshold = 20
): number {
  if (!Number.isInteger(itemCount) || itemCount <= 0) return 0;
  const normalizedActiveIndex = ((Math.trunc(activeIndex) % itemCount) + itemCount) % itemCount;
  if (itemCount <= 1 || !Number.isFinite(dragOffset) || Math.abs(dragOffset) < revealThreshold) {
    return normalizedActiveIndex;
  }
  const direction = dragOffset < 0 ? 1 : -1;
  return (normalizedActiveIndex + direction + itemCount) % itemCount;
}

export function getCarouselSwipeDirection(
  deltaX: number,
  deltaY: number,
  threshold = 48,
  elapsedMs?: number,
  flickVelocity = 0.35,
  minimumFlickDistance = 24
): -1 | 1 | null {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return null;
  const horizontalDistance = Math.abs(deltaX);
  const isHorizontal = horizontalDistance > Math.abs(deltaY);
  const isDeliberateSwipe = horizontalDistance >= threshold;
  const isQuickFlick = typeof elapsedMs === "number"
    && Number.isFinite(elapsedMs)
    && elapsedMs > 0
    && elapsedMs <= 400
    && horizontalDistance >= minimumFlickDistance
    && horizontalDistance / elapsedMs >= flickVelocity;
  if (!isHorizontal || (!isDeliberateSwipe && !isQuickFlick)) return null;
  return deltaX < 0 ? 1 : -1;
}

export function consumeCarouselWheel(
  state: CarouselWheelState,
  deltaX: number,
  deltaY: number,
  now: number,
  threshold = 18,
  cooldownMs = 300
): CarouselWheelResult {
  const dominantDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
  if (!Number.isFinite(dominantDelta) || dominantDelta === 0) {
    return { direction: null, state };
  }

  if (now < state.lockedUntil) {
    return {
      direction: null,
      state: { ...state, accumulatedDelta: 0, lastEventAt: now }
    };
  }

  const accumulatedDelta = (now - state.lastEventAt > 220 ? 0 : state.accumulatedDelta) + dominantDelta;
  if (Math.abs(accumulatedDelta) < threshold) {
    return {
      direction: null,
      state: { ...state, accumulatedDelta, lastEventAt: now }
    };
  }

  return {
    direction: accumulatedDelta > 0 ? 1 : -1,
    state: {
      accumulatedDelta: 0,
      lastEventAt: now,
      lockedUntil: now + cooldownMs
    }
  };
}
