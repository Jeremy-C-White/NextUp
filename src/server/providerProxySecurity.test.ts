import { describe, expect, it } from "vitest";
import { isAllowedProviderProxyTarget, normalizeProviderProxyBaseUrl } from "./providerProxySecurity";

describe("provider proxy security", () => {
  const base = normalizeProviderProxyBaseUrl(
    "https://aio.example.com/stremio/personal-token/manifest.json"
  );

  it("allows only manifest and stream lookups below the configured installation", () => {
    expect(isAllowedProviderProxyTarget(
      new URL("https://aio.example.com/stremio/personal-token/manifest.json"),
      base
    )).toBe(true);
    expect(isAllowedProviderProxyTarget(
      new URL("https://aio.example.com/stremio/personal-token/stream/series/tt123:1:2.json"),
      base
    )).toBe(true);
  });

  it("rejects another origin, another installation path, and arbitrary endpoints", () => {
    expect(isAllowedProviderProxyTarget(
      new URL("https://evil.example/stream/series/tt123:1:2.json"),
      base
    )).toBe(false);
    expect(isAllowedProviderProxyTarget(
      new URL("https://aio.example.com/stremio/other-token/stream/series/tt123:1:2.json"),
      base
    )).toBe(false);
    expect(isAllowedProviderProxyTarget(
      new URL("https://aio.example.com/stremio/personal-token/admin"),
      base
    )).toBe(false);
  });

  it("fails closed without a configured provider and rejects unsafe schemes", () => {
    expect(normalizeProviderProxyBaseUrl(undefined)).toBeNull();
    expect(normalizeProviderProxyBaseUrl("http://metadata.internal/provider")).toBeNull();
    expect(isAllowedProviderProxyTarget(
      new URL("https://aio.example.com/stremio/personal-token/manifest.json"),
      null
    )).toBe(false);
  });

  it("permits an explicitly configured localhost provider for development", () => {
    const local = normalizeProviderProxyBaseUrl("http://localhost:3001/addon/manifest.json");
    expect(isAllowedProviderProxyTarget(
      new URL("http://localhost:3001/addon/stream/movie/tt123.json"),
      local
    )).toBe(true);
  });
});
