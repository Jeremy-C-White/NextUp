export function getAdjacentCarouselIndexes(activeIndex: number, itemCount: number): number[] {
  if (itemCount <= 1) return [];

  const safeIndex = Math.min(Math.max(0, activeIndex), itemCount - 1);
  const previousIndex = (safeIndex - 1 + itemCount) % itemCount;
  const nextIndex = (safeIndex + 1) % itemCount;
  return previousIndex === nextIndex ? [nextIndex] : [previousIndex, nextIndex];
}
