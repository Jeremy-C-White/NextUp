import { getAioStreamsBaseUrl } from "./debrid";
import { fetchThroughProxy } from "./webos";

export interface AioCatalogItem {
  id: string;
  type: string;
  name: string;
  releaseInfo?: string;
  catalogName: string;
}

export interface AioCatalogPlayback {
  itemId: string;
  streamId: string;
  streamType: string;
  name: string;
  episodeName: string;
  season: number;
  episode: number;
}

interface CatalogExtra {
  name?: unknown;
  options?: unknown;
  isRequired?: unknown;
}

interface CatalogDefinition {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  extra?: unknown;
  extraRequired?: unknown;
}

export interface AdultCatalogTarget {
  id: string;
  type: string;
  name: string;
  genre?: string;
}

const ADULT_MARKER = /adult|xxx|nsfw|porn|18\s*\+/i;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function catalogExtras(catalog: CatalogDefinition): CatalogExtra[] {
  return Array.isArray(catalog.extra) ? catalog.extra as CatalogExtra[] : [];
}

function requiredExtras(catalog: CatalogDefinition): string[] {
  const declared = Array.isArray(catalog.extraRequired)
    ? catalog.extraRequired.map(stringValue).filter(Boolean)
    : [];
  const inline = catalogExtras(catalog)
    .filter(extra => extra.isRequired === true)
    .map(extra => stringValue(extra.name))
    .filter(Boolean);
  return Array.from(new Set([...declared, ...inline]));
}

export function findAdultCatalogTargets(manifest: unknown): AdultCatalogTarget[] {
  if (!manifest || typeof manifest !== "object") return [];
  const value = manifest as { catalogs?: unknown; behaviorHints?: { adult?: unknown } };
  if (!Array.isArray(value.catalogs)) return [];

  const definitions = value.catalogs as CatalogDefinition[];
  const targets = definitions.flatMap(catalog => {
    const id = stringValue(catalog.id);
    const type = stringValue(catalog.type);
    const name = stringValue(catalog.name) || id;
    if (!id || !type) return [];

    const genreExtra = catalogExtras(catalog).find(extra => stringValue(extra.name).toLowerCase() === "genre");
    const genre = Array.isArray(genreExtra?.options)
      ? genreExtra.options.map(stringValue).find(option => ADULT_MARKER.test(option))
      : undefined;
    const isNamedAdultCatalog = ADULT_MARKER.test(`${id} ${name}`);
    const unsupportedRequiredExtra = requiredExtras(catalog).some(extra => extra !== "genre" || !genre);

    if ((!isNamedAdultCatalog && !genre) || unsupportedRequiredExtra) return [];
    return [{ id, type, name, ...(genre ? { genre } : {}) }];
  });

  if (targets.length > 0) return targets;

  if (value.behaviorHints?.adult === true && definitions.length === 1) {
    const only = definitions[0];
    const id = stringValue(only.id);
    const type = stringValue(only.type);
    if (id && type && requiredExtras(only).length === 0) {
      return [{ id, type, name: stringValue(only.name) || id }];
    }
  }

  return [];
}

async function fetchJsonResponse(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetchThroughProxy(url, signal);
  if (!response.ok) throw new Error(`AIOStreams returned HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error("AIOStreams returned invalid catalog data.");
  }
}

function catalogUrl(baseUrl: string, target: AdultCatalogTarget): string {
  const extra = target.genre ? `/genre=${encodeURIComponent(target.genre)}` : "";
  return `${baseUrl}/catalog/${encodeURIComponent(target.type)}/${encodeURIComponent(target.id)}${extra}.json`;
}

export async function getAdultAioCatalog(signal?: AbortSignal): Promise<{
  items: AioCatalogItem[];
  catalogCount: number;
}> {
  const baseUrl = getAioStreamsBaseUrl();
  const manifest = await fetchJsonResponse(`${baseUrl}/manifest.json`, signal);
  const targets = findAdultCatalogTargets(manifest);
  if (targets.length === 0) return { items: [], catalogCount: 0 };

  const responses = await Promise.allSettled(
    targets.slice(0, 4).map(async target => ({
      target,
      response: await fetchJsonResponse(catalogUrl(baseUrl, target), signal)
    }))
  );

  const fulfilledResponses = responses.filter(result => result.status === "fulfilled");
  if (fulfilledResponses.length === 0) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const firstFailure = responses.find(result => result.status === "rejected");
    throw firstFailure?.reason instanceof Error
      ? firstFailure.reason
      : new Error("The configured AIOStreams adult catalogs could not be loaded.");
  }

  const seen = new Set<string>();
  const items: AioCatalogItem[] = [];
  for (const result of responses) {
    if (result.status !== "fulfilled") continue;
    const payload = result.value.response as { metas?: unknown };
    if (!Array.isArray(payload?.metas)) continue;
    for (const meta of payload.metas) {
      if (!meta || typeof meta !== "object") continue;
      const record = meta as Record<string, unknown>;
      const id = stringValue(record.id);
      const type = stringValue(record.type) || result.value.target.type;
      const name = stringValue(record.name);
      const key = `${type}:${id}`;
      if (!id || !name || seen.has(key)) continue;
      seen.add(key);
      items.push({
        id,
        type,
        name,
        releaseInfo: stringValue(record.releaseInfo) || stringValue(record.year) || undefined,
        catalogName: result.value.target.name
      });
      if (items.length >= 40) break;
    }
    if (items.length >= 40) break;
  }

  return { items, catalogCount: targets.length };
}

export async function resolveAioCatalogPlayback(item: AioCatalogItem, signal?: AbortSignal): Promise<AioCatalogPlayback> {
  const baseUrl = getAioStreamsBaseUrl();
  let meta: Record<string, unknown> | undefined;

  try {
    const payload = await fetchJsonResponse(
      `${baseUrl}/meta/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}.json`,
      signal
    ) as { meta?: unknown };
    if (payload.meta && typeof payload.meta === "object") meta = payload.meta as Record<string, unknown>;
  } catch (error) {
    if (item.type === "series") throw error;
  }

  const behaviorHints = meta?.behaviorHints && typeof meta.behaviorHints === "object"
    ? meta.behaviorHints as Record<string, unknown>
    : undefined;
  const videos = Array.isArray(meta?.videos) ? meta.videos as Array<Record<string, unknown>> : [];
  const defaultVideoId = stringValue(behaviorHints?.defaultVideoId);
  const defaultVideo = videos.find(video => stringValue(video.id) === defaultVideoId);
  const releasedVideos = videos
    .filter(video => !stringValue(video.released) || Date.parse(stringValue(video.released)) <= Date.now())
    .sort((left, right) => Date.parse(stringValue(right.released)) - Date.parse(stringValue(left.released)));
  const video = defaultVideo || releasedVideos[0] || videos[0];

  if (item.type === "series" && !video) {
    throw new Error("This catalog item does not expose a playable episode through AIOStreams.");
  }

  return {
    itemId: item.id,
    streamId: stringValue(video?.id) || defaultVideoId || item.id,
    streamType: item.type,
    name: stringValue(meta?.name) || item.name,
    episodeName: stringValue(video?.title) || item.name,
    season: Number(video?.season) || 0,
    episode: Number(video?.episode) || 0
  };
}
