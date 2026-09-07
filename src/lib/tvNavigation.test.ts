import { describe, expect, it } from "vitest";
import { consumeCarouselWheel, createCarouselWheelState } from "./carouselWheel";
import {
  horizontalWheelDelta,
  shouldDelegateHorizontalNavigation,
  shouldDeferWheelToSyncedCarousel,
  shouldRetainNativeDirectionalInput,
  wheelDeltaPixels
} from "./tvNavigation";

describe("shouldDeferWheelToSyncedCarousel", () => {
  it("leaves a wheel event inside the synchronized stage for its bubble handler", () => {
    const synchronizedStage = {} as Element;
    const thumbnailTarget = {
      closest: (selector: string) => selector === "[data-tv-synced-wheel-carousel]"
        ? synchronizedStage
        : null
    };

    expect(shouldDeferWheelToSyncedCarousel(thumbnailTarget)).toBe(true);
  });

  it("keeps global wheel scrolling active outside a synchronized stage", () => {
    const pageTarget = { closest: () => null };
    expect(shouldDeferWheelToSyncedCarousel(pageTarget)).toBe(false);
  });

  it("lets capture defer every tick before the shared stage advances", () => {
    const synchronizedStage = {} as Element;
    const thumbnailTarget = {
      closest: (selector: string) => selector === "[data-tv-synced-wheel-carousel]"
        ? synchronizedStage
        : null
    };
    let globalScrollEvents = 0;
    let stageWheelEvents = 0;
    let wheelState = createCarouselWheelState();
    const directions: Array<-1 | 1> = [];

    [1_000, 1_080, 1_160, 1_240].forEach(now => {
      if (!shouldDeferWheelToSyncedCarousel(thumbnailTarget)) {
        globalScrollEvents += 1;
        return;
      }

      stageWheelEvents += 1;
      const result = consumeCarouselWheel(wheelState, 0, 5, now);
      wheelState = result.state;
      if (result.direction !== null) directions.push(result.direction);
    });

    expect(globalScrollEvents).toBe(0);
    expect(stageWheelEvents).toBe(4);
    expect(directions).toEqual([1]);
  });
});

describe("wheelDeltaPixels", () => {
  it("normalizes vertical Magic Remote line scrolling", () => {
    expect(wheelDeltaPixels(4, 1, 900)).toBe(160);
    expect(wheelDeltaPixels(-4, 1, 900)).toBe(-160);
  });

  it("uses the current viewport for page scrolling", () => {
    expect(wheelDeltaPixels(1, 2, 900)).toBe(900);
  });
});

describe("horizontalWheelDelta", () => {
  it("maps a Magic Remote vertical wheel step to horizontal pixels", () => {
    expect(horizontalWheelDelta(0, 3, 1, 800)).toBe(120);
  });

  it("preserves trackpad-style horizontal pixel movement", () => {
    expect(horizontalWheelDelta(-64, 12, 0, 800)).toBe(-64);
  });

  it("uses the visible rail width for page-sized wheel movement", () => {
    expect(horizontalWheelDelta(0, 1, 2, 720)).toBe(720);
  });
});

describe("shouldDelegateHorizontalNavigation", () => {
  it("lets a focused carousel handle Left and Right itself", () => {
    expect(shouldDelegateHorizontalNavigation("left", true)).toBe(true);
    expect(shouldDelegateHorizontalNavigation("right", true)).toBe(true);
  });

  it("keeps vertical and ordinary navigation in the global TV controller", () => {
    expect(shouldDelegateHorizontalNavigation("down", true)).toBe(false);
    expect(shouldDelegateHorizontalNavigation("right", false)).toBe(false);
  });
});

describe("shouldRetainNativeDirectionalInput", () => {
  it("keeps Left and Right native in single-line fields and range controls", () => {
    expect(shouldRetainNativeDirectionalInput("left", "input", "text")).toBe(true);
    expect(shouldRetainNativeDirectionalInput("right", "input", "range")).toBe(true);
  });

  it("releases Up and Down for spatial navigation from single-line controls", () => {
    expect(shouldRetainNativeDirectionalInput("up", "input", "text")).toBe(false);
    expect(shouldRetainNativeDirectionalInput("down", "input", "search")).toBe(false);
    expect(shouldRetainNativeDirectionalInput("down", "input", "range")).toBe(false);
  });

  it("preserves native directional editing for multiline and select controls", () => {
    expect(shouldRetainNativeDirectionalInput("down", "textarea")).toBe(true);
    expect(shouldRetainNativeDirectionalInput("up", "select")).toBe(true);
    expect(shouldRetainNativeDirectionalInput("left", "div", "", true)).toBe(true);
  });
});
