import { describe, expect, it, vi } from "vitest";
import {
  readAutoSkipEnabled,
  saveAutoSkipEnabled,
  shouldAutomaticallySkipSegment
} from "./autoSkip";

describe("auto-skip preference", () => {
  it("is off by default and only enables for an explicit saved value", () => {
    expect(readAutoSkipEnabled({ getItem: () => null })).toBe(false);
    expect(readAutoSkipEnabled({ getItem: () => "false" })).toBe(false);
    expect(readAutoSkipEnabled({ getItem: () => "true" })).toBe(true);
  });

  it("persists the preference without making storage required", () => {
    const setItem = vi.fn();
    saveAutoSkipEnabled(true, { setItem });
    expect(setItem).toHaveBeenCalledWith("NEXTUP_AUTO_SKIP_INTROS_RECAPS", "true");

    expect(() => saveAutoSkipEnabled(true, {
      setItem: () => { throw new Error("storage unavailable"); }
    })).not.toThrow();
  });
});

describe("shouldAutomaticallySkipSegment", () => {
  it("waits until ten seconds into an intro or recap", () => {
    expect(shouldAutomaticallySkipSegment(true, true, "intro", 19.9, 10, 70)).toBe(false);
    expect(shouldAutomaticallySkipSegment(true, true, "intro", 20, 10, 70)).toBe(true);
    expect(shouldAutomaticallySkipSegment(true, true, "recap", 80, 70, 120)).toBe(true);
  });

  it("never auto-skips credits, paused playback, disabled preferences, or very short segments", () => {
    expect(shouldAutomaticallySkipSegment(true, true, "outro", 20, 10, 70)).toBe(false);
    expect(shouldAutomaticallySkipSegment(false, true, "intro", 20, 10, 70)).toBe(false);
    expect(shouldAutomaticallySkipSegment(true, false, "intro", 20, 10, 70)).toBe(false);
    expect(shouldAutomaticallySkipSegment(true, true, "intro", 20, 10, 21)).toBe(false);
  });
});

