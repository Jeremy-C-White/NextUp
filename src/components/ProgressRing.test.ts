import { describe, expect, it } from "vitest";
import { getProgressRingPositioningClass } from "./ProgressRing";

describe("progress ring positioning", () => {
  it("does not add relative positioning to an absolutely positioned card badge", () => {
    expect(getProgressRingPositioningClass("absolute top-8 right-8 z-20")).toBe("");
  });

  it("provides a positioning context when the caller does not position the ring", () => {
    expect(getProgressRingPositioningClass("pointer-events-none")).toBe("relative");
  });
});
