import { describe, expect, it } from "vitest";
import { findReleasedDigitalDate } from "./movieRelease";

const NOW = Date.parse("2026-07-28T12:00:00Z");

describe("findReleasedDigitalDate", () => {
  it("returns a past US digital release", () => {
    expect(findReleasedDigitalDate({
      results: [{
        iso_3166_1: "US",
        release_dates: [
          { type: 3, release_date: "2026-06-01T00:00:00Z" },
          { type: 4, release_date: "2026-07-20T00:00:00Z" }
        ]
      }]
    }, "US", NOW)).toBe("2026-07-20T00:00:00Z");
  });

  it("does not accept theatrical or physical releases", () => {
    expect(findReleasedDigitalDate({
      results: [{
        iso_3166_1: "US",
        release_dates: [
          { type: 3, release_date: "2026-06-01T00:00:00Z" },
          { type: 5, release_date: "2026-07-01T00:00:00Z" }
        ]
      }]
    }, "US", NOW)).toBeNull();
  });

  it("does not accept a digital release scheduled for the future", () => {
    expect(findReleasedDigitalDate({
      results: [{
        iso_3166_1: "US",
        release_dates: [{ type: 4, release_date: "2026-08-01T00:00:00Z" }]
      }]
    }, "US", NOW)).toBeNull();
  });

  it("requires the requested region", () => {
    expect(findReleasedDigitalDate({
      results: [{
        iso_3166_1: "GB",
        release_dates: [{ type: 4, release_date: "2026-07-01T00:00:00Z" }]
      }]
    }, "US", NOW)).toBeNull();
  });
});
