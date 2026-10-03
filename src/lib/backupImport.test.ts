import { describe, expect, it } from "vitest";
import { chunkLibraryImport, prepareLibraryImport } from "./backupImport";

describe("library backup import", () => {
  it("cleans valid shows and ignores malformed records", () => {
    const shows = prepareLibraryImport([
      { id: 42, name: "  Example  ", optional: undefined, nested: { missing: undefined, kept: true } },
      null,
      { id: "bad/path", name: "Unsafe" },
      { id: "missing-name" }
    ]);

    expect(shows).toEqual([{
      id: "42",
      name: "Example",
      nested: { kept: true }
    }]);
  });

  it("splits large restores below Firestore's write-batch limit", () => {
    const shows = Array.from({ length: 901 }, (_, index) => ({
      id: String(index + 1),
      name: `Show ${index + 1}`
    })) as any;

    expect(chunkLibraryImport(shows).map(chunk => chunk.length)).toEqual([450, 450, 1]);
  });

  it("rejects a backup whose top-level value is not an array", () => {
    expect(() => prepareLibraryImport({ shows: [] })).toThrow(/array of shows/i);
  });
});
