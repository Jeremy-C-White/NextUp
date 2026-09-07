import { describe, expect, it } from "vitest";
import { parseLibraryShowRecord } from "./libraryData";

describe("parseLibraryShowRecord", () => {
  it("preserves a complete version-40 library record", () => {
    const show = parseLibraryShowRecord({ name: "  Severance  ", imageUrl: "poster.jpg", imdbId: "tt11280740" }, "saved-id");

    expect(show?.id).toBe("saved-id");
    expect(show?.name).toBe("Severance");
    expect(show?.imageUrl).toBe("poster.jpg");
    expect(show?.imdbId).toBe("tt11280740");
  });

  it("recovers known title aliases from older records", () => {
    expect(parseLibraryShowRecord({ title: "The Bear", posterUrl: "bear.jpg" }, "title-id"))
      .toMatchObject({ id: "title-id", name: "The Bear", imageUrl: "bear.jpg" });
    expect(parseLibraryShowRecord({ showName: "Slow Horses" }, "show-name-id")?.name).toBe("Slow Horses");
    expect(parseLibraryShowRecord({ show: { name: "Andor" } }, "nested-id")?.name).toBe("Andor");
  });

  it("omits patch-only records instead of displaying Unknown or Untitled", () => {
    expect(parseLibraryShowRecord({ _auditVersion: 3 } as never, "patch-only")).toBeNull();
    expect(parseLibraryShowRecord({ name: "   " }, "blank-title")).toBeNull();
    expect(parseLibraryShowRecord(null, "invalid")).toBeNull();
  });
});
