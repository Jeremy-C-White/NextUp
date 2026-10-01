import { describe, expect, it } from "vitest";
import { consumeCarouselWheel, createCarouselWheelState, getCarouselPreviewIndex, getCarouselSwipeDirection } from "./carouselWheel";

describe("getCarouselPreviewIndex", () => {
  it("previews the next card while dragging left and the previous card while dragging right", () => {
    expect(getCarouselPreviewIndex(2, 5, -40)).toBe(3);
    expect(getCarouselPreviewIndex(2, 5, 40)).toBe(1);
  });

  it("wraps at both ends of the deck", () => {
    expect(getCarouselPreviewIndex(4, 5, -40)).toBe(0);
    expect(getCarouselPreviewIndex(0, 5, 40)).toBe(4);
  });

  it("keeps the active artwork for taps and tiny movements", () => {
    expect(getCarouselPreviewIndex(2, 5, 12)).toBe(2);
    expect(getCarouselPreviewIndex(0, 0, -40)).toBe(0);
  });
});

describe("getCarouselSwipeDirection", () => {
  it("moves with deliberate horizontal phone swipes", () => {
    expect(getCarouselSwipeDirection(-80, 12)).toBe(1);
    expect(getCarouselSwipeDirection(80, 12)).toBe(-1);
  });

  it("leaves vertical scrolling and small taps alone", () => {
    expect(getCarouselSwipeDirection(35, 4)).toBeNull();
    expect(getCarouselSwipeDirection(40, 90)).toBeNull();
  });

  it("accepts a short, fast thumb flick without treating a slow drag as one", () => {
    expect(getCarouselSwipeDirection(-30, 4, 48, 60)).toBe(1);
    expect(getCarouselSwipeDirection(30, 4, 48, 60)).toBe(-1);
    expect(getCarouselSwipeDirection(30, 4, 48, 500)).toBeNull();
  });

  it("does not turn a quick vertical gesture into a carousel flick", () => {
    expect(getCarouselSwipeDirection(30, 55, 48, 50)).toBeNull();
  });
});

describe("consumeCarouselWheel", () => {
  it("moves forward for a vertical wheel-down gesture", () => {
    const result = consumeCarouselWheel(createCarouselWheelState(), 0, 40, 1000);
    expect(result.direction).toBe(1);
  });

  it("moves backward for a horizontal wheel-left gesture", () => {
    const result = consumeCarouselWheel(createCarouselWheelState(), -35, 4, 1000);
    expect(result.direction).toBe(-1);
  });

  it("accumulates small Magic Remote wheel deltas", () => {
    const first = consumeCarouselWheel(createCarouselWheelState(), 0, 8, 1000);
    const second = consumeCarouselWheel(first.state, 0, 11, 1080);
    expect(first.direction).toBeNull();
    expect(second.direction).toBe(1);
  });

  it("suppresses inertial follow-up events during the cooldown", () => {
    const first = consumeCarouselWheel(createCarouselWheelState(), 0, 40, 1000);
    const second = consumeCarouselWheel(first.state, 0, 60, 1100);
    expect(first.direction).toBe(1);
    expect(second.direction).toBeNull();
  });
});
