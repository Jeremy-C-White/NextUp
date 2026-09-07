import { describe, expect, it } from "vitest";
import { getLibraryDocumentIds, normalizeLibraryDocumentId } from "./libraryIdentity";

describe("library document identity", () => {
  it("uses the exact persisted document ID for writes", () => {
    expect(normalizeLibraryDocumentId("-1000123456")).toBe("-1000123456");
  });

  it("deduplicates a matching source and TVMaze ID", () => {
    expect(getLibraryDocumentIds({ id: "123", tvmazeId: 123 })).toEqual(["123"]);
  });

  it("includes the legacy TVMaze duplicate when IDs differ", () => {
    expect(getLibraryDocumentIds({ id: "-1000123456", tvmazeId: 9876 })).toEqual([
      "-1000123456",
      "9876"
    ]);
  });

  it("rejects an unsafe Firestore path segment", () => {
    expect(() => normalizeLibraryDocumentId("bad/id")).toThrow("Invalid library show ID");
  });
});
