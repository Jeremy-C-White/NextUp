import { describe, expect, it } from "vitest";
import { findFirstHomeReleaseDate, findReleasedDigitalDate } from "./movieRelease";

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

describe("findFirstHomeReleaseDate", () => {
  const SEPT_27 = Date.parse("2026-09-27T12:00:00Z");

  it("uses the first at-home date, so a later disc release does not make a movie new", () => {
    expect(findFirstHomeReleaseDate({
      results: [{
        iso_3166_1: "US",
        release_dates: [
          { type: 3, release_date: "2026-03-20T00:00:00.000Z" },
          { type: 4, release_date: "2026-05-12T00:00:00.000Z" },
          { type: 4, release_date: "2026-06-18T00:00:00.000Z" },
          { type: 5, release_date: "2026-08-11T00:00:00.000Z" },
          { type: 6, release_date: "2026-06-20T00:00:00.000Z" }
        ]
      }]
    }, "US", SEPT_27)).toBe("2026-05-12T00:00:00.000Z");
  });

  it("counts disc and TV releases when they come first", () => {
    expect(findFirstHomeReleaseDate({
      results: [{ iso_3166_1: "US", release_dates: [{ type: 5, release_date: "2026-09-01T00:00:00Z" }, { type: 4, release_date: "2026-09-20T00:00:00Z" }] }]
    }, "US", SEPT_27)).toBe("2026-09-01T00:00:00Z");
    expect(findFirstHomeReleaseDate({
      results: [{ iso_3166_1: "US", release_dates: [{ type: 6, release_date: "2026-09-10T00:00:00Z" }] }]
    }, "US", SEPT_27)).toBe("2026-09-10T00:00:00Z");
  });

  it("ignores theatrical dates and movies not yet out at home", () => {
    expect(findFirstHomeReleaseDate({
      results: [{ iso_3166_1: "US", release_dates: [{ type: 3, release_date: "2026-09-01T00:00:00Z" }, { type: 4, release_date: "2026-10-14T00:00:00Z" }] }]
    }, "US", SEPT_27)).toBeNull();
    expect(findFirstHomeReleaseDate({
      results: [{ iso_3166_1: "GB", release_dates: [{ type: 4, release_date: "2026-09-01T00:00:00Z" }] }]
    }, "US", SEPT_27)).toBeNull();
  });
});
