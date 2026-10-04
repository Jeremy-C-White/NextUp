export function getAdjacentCarouselIndexes(activeIndex: number, itemCount: number, depth = 1): number[] {
  if (itemCount <= 1 || depth <= 0) return [];

  const safeIndex = Math.min(Math.max(0, activeIndex), itemCount - 1);
  const indexes: number[] = [];
  const seen = new Set([safeIndex]);
  const maximumDepth = Math.min(Math.floor(depth), itemCount - 1);

  for (let distance = 1; distance <= maximumDepth; distance += 1) {
    const candidates = [
      (safeIndex - distance + itemCount) % itemCount,
      (safeIndex + distance) % itemCount
    ];
    candidates.forEach(index => {
      if (seen.has(index)) return;
      seen.add(index);
      indexes.push(index);
    });
  }

  return indexes;
}
