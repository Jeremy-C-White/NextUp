import { describe, expect, it } from "vitest";
import { resolveBackAction, shouldIgnoreBackPress } from "./backNavigation";

const noLayers = {
  player: false,
  resumeChoice: false,
  recommendation: false,
  details: false,
  search: false,
  settings: false,
  error: false
};

describe("Back navigation", () => {
  it("handles only the top visible layer", () => {
    expect(resolveBackAction({ ...noLayers, player: true, details: true }, 1_000, 0).action).toBe("player");
    expect(resolveBackAction({ ...noLayers, resumeChoice: true, details: true }, 1_000, 0).action).toBe("resume-choice");
    expect(resolveBackAction({ ...noLayers, details: true, search: true }, 1_000, 0).action).toBe("details");
  });

  it("requires an explicit second Back press before exiting", () => {
    const first = resolveBackAction(noLayers, 10_000, 0);
    expect(first.action).toBe("arm-exit");
    expect(resolveBackAction(noLayers, 11_000, first.exitArmedUntil).action).toBe("exit");
    expect(resolveBackAction(noLayers, 13_000, first.exitArmedUntil).action).toBe("arm-exit");
  });

  it("ignores held and duplicate Back events", () => {
    expect(shouldIgnoreBackPress(true, 1_000, 0)).toBe(true);
    expect(shouldIgnoreBackPress(false, 1_300, 1_000)).toBe(true);
    expect(shouldIgnoreBackPress(false, 1_500, 1_000)).toBe(false);
  });
});
