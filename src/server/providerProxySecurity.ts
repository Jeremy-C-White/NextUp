const LOCAL_PROVIDER_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeProviderProxyBaseUrl(configuredUrl: string | undefined): URL | null {
  const raw = configuredUrl?.trim();
  if (!raw) return null;

  const withoutManifest = raw
    .replace(/\/manifest\.json(?:\?.*)?$/i, "")
    .replace(/\/+$/, "");

  let parsed: URL;
  try {
    parsed = new URL(withoutManifest);
  } catch {
    return null;
  }

  const isLocalHttp = parsed.protocol === "http:" && LOCAL_PROVIDER_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalHttp) return null;
  if (parsed.username || parsed.password || parsed.hash || parsed.search) return null;

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed;
}

export function isAllowedProviderProxyTarget(target: URL, configuredBase: URL | null): boolean {
  if (!configuredBase) return false;
  if (target.username || target.password || target.hash || target.search) return false;
  if (target.origin !== configuredBase.origin) return false;

  const basePath = configuredBase.pathname.replace(/\/+$/, "");
  const prefix = `${basePath}/`;
  if (!target.pathname.startsWith(prefix)) return false;

  const relativePath = target.pathname.slice(basePath.length);
  return relativePath === "/manifest.json" ||
    /^\/stream\/(?:movie|series)\/[^/]+\.json$/i.test(relativePath);
}
