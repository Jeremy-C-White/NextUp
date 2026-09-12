import { describe, expect, it } from "vitest";
import { findAdultCatalogTargets } from "./aioCatalog";

describe("findAdultCatalogTargets", () => {
  it("selects catalogs explicitly labeled for adults", () => {
    expect(findAdultCatalogTargets({
      catalogs: [
        { id: "popular", type: "movie", name: "Popular" },
        { id: "xxx-top", type: "movie", name: "XXX Top" }
      ]
    })).toEqual([{ id: "xxx-top", type: "movie", name: "XXX Top" }]);
  });

  it("uses an adult genre exposed by a general catalog", () => {
    expect(findAdultCatalogTargets({
      catalogs: [{
        id: "top",
        type: "movie",
        name: "Top",
        extra: [{ name: "genre", options: ["Action", "Adult"] }]
      }]
    })).toEqual([{ id: "top", type: "movie", name: "Top", genre: "Adult" }]);
  });

  it("does not treat a normal mixed manifest as an adult catalog", () => {
    expect(findAdultCatalogTargets({
      catalogs: [{ id: "popular", type: "movie", name: "Popular" }]
    })).toEqual([]);
  });
});
