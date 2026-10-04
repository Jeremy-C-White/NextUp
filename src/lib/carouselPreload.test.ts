import { describe, expect, it } from "vitest";
import { getAdjacentCarouselIndexes } from "./carouselPreload";

describe("getAdjacentCarouselIndexes", () => {
  it("returns the previous and next items", () => {
    expect(getAdjacentCarouselIndexes(2, 5)).toEqual([1, 3]);
  });

  it("wraps around both ends of the queue", () => {
    expect(getAdjacentCarouselIndexes(0, 5)).toEqual([4, 1]);
    expect(getAdjacentCarouselIndexes(4, 5)).toEqual([3, 0]);
  });

  it("deduplicates the adjacent item in a two-item queue", () => {
    expect(getAdjacentCarouselIndexes(0, 2)).toEqual([1]);
  });

  it("does not preload when the queue has no neighbor", () => {
    expect(getAdjacentCarouselIndexes(0, 1)).toEqual([]);
    expect(getAdjacentCarouselIndexes(0, 0)).toEqual([]);
  });

  it("preloads the next layer of cards without duplicates", () => {
    expect(getAdjacentCarouselIndexes(2, 6, 2)).toEqual([1, 3, 0, 4]);
    expect(getAdjacentCarouselIndexes(0, 4, 2)).toEqual([3, 1, 2]);
    expect(getAdjacentCarouselIndexes(0, 3, 2)).toEqual([2, 1]);
  });
});
