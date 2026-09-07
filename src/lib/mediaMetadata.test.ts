import { describe, expect, it } from "vitest";
import { firstPositiveNumber, formatRuntimeMinutes } from "./mediaMetadata";

describe("firstPositiveNumber", () => {
  it("skips missing, invalid, and zero metadata", () => {
    expect(firstPositiveNumber(undefined, 0, "", -1, 7.4)).toBe(7.4);
  });

  it("returns null instead of exposing a zero", () => {
    expect(firstPositiveNumber(0, undefined, null)).toBeNull();
  });
});

describe("formatRuntimeMinutes", () => {
  it("formats feature-length runtimes", () => {
    expect(formatRuntimeMinutes(125)).toBe("2h 5m");
    expect(formatRuntimeMinutes(120)).toBe("2h");
  });

  it("formats shorter runtimes and hides missing values", () => {
    expect(formatRuntimeMinutes(45)).toBe("45 min");
    expect(formatRuntimeMinutes(0)).toBeNull();
  });
});
