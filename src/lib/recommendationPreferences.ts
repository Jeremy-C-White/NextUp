export type RecommendationFeedbackKind = "more-like-this" | "not-for-me" | "already-watched";

export interface RecommendationCandidate {
  id?: string | number;
  tvmazeId?: number;
  imdbId?: string;
  externals?: { imdb?: string };
  _tmdbId?: number;
  name: string;
  genres?: string[];
  runtime?: number;
  isMovie?: boolean;
  premiered?: string;
}

export interface RecommendationFeedbackEntry {
  key: string;
  kind: RecommendationFeedbackKind;
  name: string;
  genres: string[];
  updatedAt: number;
}

export interface RecommendationProfile {
  entries: Record<string, RecommendationFeedbackEntry>;
}

export interface RecommendationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type RecommendationSource =
  | { kind: "popular" }
  | { kind: "trending" }
  | { kind: "hidden-gem" }
  | { kind: "premiering" }
  | { kind: "network"; name: string };

export interface RecommendationReasonContext {
  source: RecommendationSource;
  profile: RecommendationProfile;
  watchedLibrary: RecommendationCandidate[];
  finishedLibrary: RecommendationCandidate[];
  inLibrary?: boolean;
  hasNewEpisode?: boolean;
}

const STORAGE_PREFIX = "nextup_recommendation_preferences_v1";
const MAX_FEEDBACK_ENTRIES = 200;

export const EMPTY_RECOMMENDATION_PROFILE: RecommendationProfile = { entries: {} };

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function normalizeGenres(genres: string[] | undefined): string[] {
  return Array.from(new Set(
    (genres || [])
      .filter(genre => typeof genre === "string" && genre.trim().length > 0)
      .map(normalizeText)
  ));
}

export function getRecommendationCandidateKey(candidate: RecommendationCandidate): string {
  const imdbId = candidate.imdbId || candidate.externals?.imdb;
  if (imdbId && imdbId !== "none") {
    return `imdb:${normalizeText(imdbId)}`;
  }
  if (Number.isFinite(candidate._tmdbId) && (candidate._tmdbId || 0) > 0) {
    return `tmdb:${candidate.isMovie ? "movie" : "series"}:${candidate._tmdbId}`;
  }
  if (Number.isFinite(candidate.tvmazeId) && (candidate.tvmazeId || 0) > 0) {
    return `tvmaze:${candidate.tvmazeId}`;
  }
  if (candidate.id !== undefined && String(candidate.id).trim()) {
    return `source:${candidate.isMovie ? "movie" : "series"}:${String(candidate.id).trim()}`;
  }

  const year = candidate.premiered ? candidate.premiered.slice(0, 4) : "unknown";
  return `title:${candidate.isMovie ? "movie" : "series"}:${normalizeText(candidate.name)}:${year}`;
}

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}`;
}

function isFeedbackKind(value: unknown): value is RecommendationFeedbackKind {
  return value === "more-like-this" || value === "not-for-me" || value === "already-watched";
}

export function readRecommendationProfile(storage: RecommendationStorage, userId: string): RecommendationProfile {
  try {
    const serialized = storage.getItem(getStorageKey(userId));
    if (!serialized) return EMPTY_RECOMMENDATION_PROFILE;

    const parsed = JSON.parse(serialized) as Partial<RecommendationProfile>;
    if (!parsed.entries || typeof parsed.entries !== "object") return EMPTY_RECOMMENDATION_PROFILE;

    const entries: Record<string, RecommendationFeedbackEntry> = {};
    Object.entries(parsed.entries).forEach(([key, value]) => {
      const entry = value as Partial<RecommendationFeedbackEntry>;
      if (!entry || !isFeedbackKind(entry.kind) || typeof entry.name !== "string" || !Number.isFinite(entry.updatedAt)) return;
      entries[key] = {
        key,
        kind: entry.kind,
        name: entry.name,
        genres: normalizeGenres(entry.genres),
        updatedAt: entry.updatedAt || 0
      };
    });
    return { entries };
  } catch {
    return EMPTY_RECOMMENDATION_PROFILE;
  }
}

export function applyRecommendationFeedback(
  profile: RecommendationProfile,
  candidate: RecommendationCandidate,
  kind: RecommendationFeedbackKind,
  now = Date.now()
): RecommendationProfile {
  const key = getRecommendationCandidateKey(candidate);
  const entries = {
    ...profile.entries,
    [key]: {
      key,
      kind,
      name: candidate.name,
      genres: normalizeGenres(candidate.genres),
      updatedAt: now
    }
  };

  const newestEntries = Object.values(entries)
    .sort((first, second) => second.updatedAt - first.updatedAt)
    .slice(0, MAX_FEEDBACK_ENTRIES);
  return { entries: Object.fromEntries(newestEntries.map(entry => [entry.key, entry])) };
}

export function writeRecommendationProfile(
  storage: RecommendationStorage,
  userId: string,
  profile: RecommendationProfile
): boolean {
  try {
    storage.setItem(getStorageKey(userId), JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

function sharedGenreCount(first: RecommendationCandidate, secondGenres: string[]): number {
  const firstGenres = new Set(normalizeGenres(first.genres));
  return secondGenres.reduce((count, genre) => count + (firstGenres.has(genre) ? 1 : 0), 0);
}

function candidateMediaType(candidate: RecommendationCandidate): "movie" | "series" {
  return candidate.isMovie ? "movie" : "series";
}

function candidateImdbId(candidate: RecommendationCandidate): string {
  const imdbId = candidate.imdbId || candidate.externals?.imdb || "";
  return imdbId === "none" ? "" : normalizeText(imdbId);
}

function candidateTvmazeId(candidate: RecommendationCandidate): number | null {
  if (Number.isFinite(candidate.tvmazeId) && (candidate.tvmazeId || 0) > 0) return candidate.tvmazeId || null;
  const sourceId = Number(candidate.id);
  if (!candidate._tmdbId && Number.isFinite(sourceId) && sourceId > 0) return sourceId;
  return null;
}

export function isRecommendationCandidateInLibrary(
  candidate: RecommendationCandidate,
  library: RecommendationCandidate[]
): boolean {
  const candidateType = candidateMediaType(candidate);
  const imdbId = candidateImdbId(candidate);
  const tmdbId = Number.isFinite(candidate._tmdbId) ? candidate._tmdbId : null;
  const tvmazeId = candidateTvmazeId(candidate);
  const sourceId = candidate.id === undefined ? "" : String(candidate.id).trim();
  const name = normalizeText(candidate.name);
  const year = candidate.premiered?.slice(0, 4) || "";

  return library.some(item => {
    if (candidateMediaType(item) !== candidateType) return false;

    const libraryImdbId = candidateImdbId(item);
    if (imdbId && libraryImdbId && imdbId === libraryImdbId) return true;

    const libraryTmdbId = Number.isFinite(item._tmdbId) ? item._tmdbId : null;
    if (tmdbId && libraryTmdbId && tmdbId === libraryTmdbId) return true;

    const libraryTvmazeId = candidateTvmazeId(item);
    if (tvmazeId && libraryTvmazeId && tvmazeId === libraryTvmazeId) return true;

    if (sourceId && item.id !== undefined && sourceId === String(item.id).trim()) return true;
    if (name !== normalizeText(item.name)) return false;

    const libraryYear = item.premiered?.slice(0, 4) || "";
    return !year || !libraryYear || year === libraryYear;
  });
}

export function rankRecommendationCandidates<T extends RecommendationCandidate>(
  candidates: T[],
  profile: RecommendationProfile,
  library: RecommendationCandidate[] = []
): T[] {
  const positiveEntries = Object.values(profile.entries).filter(entry => entry.kind === "more-like-this");

  return candidates
    .map((candidate, originalIndex) => {
      const exactFeedback = profile.entries[getRecommendationCandidateKey(candidate)];
      const suppressed = exactFeedback?.kind === "not-for-me" || exactFeedback?.kind === "already-watched";
      const feedbackScore = positiveEntries.reduce(
        (total, entry) => total + sharedGenreCount(candidate, entry.genres),
        0
      );
      const libraryScore = library.reduce(
        (total, item) => total + sharedGenreCount(candidate, normalizeGenres(item.genres)),
        0
      );
      const score = feedbackScore * 4 + libraryScore;
      return { candidate, originalIndex, suppressed, score };
    })
    .filter(item => !item.suppressed)
    .sort((first, second) => second.score - first.score || first.originalIndex - second.originalIndex)
    .map(item => item.candidate);
}

function findMostRecentGenreMatch(
  candidate: RecommendationCandidate,
  entries: RecommendationCandidate[]
): RecommendationCandidate | null {
  return entries.find(entry => sharedGenreCount(candidate, normalizeGenres(entry.genres)) > 0) || null;
}

export function getRecommendationReason(
  candidate: RecommendationCandidate,
  context: RecommendationReasonContext
): string {
  if (context.inLibrary && context.hasNewEpisode) return "A new episode from your Library";
  if (context.inLibrary) return "Saved in your Library";

  const positiveEntries = Object.values(context.profile.entries)
    .filter(entry => entry.kind === "more-like-this" && entry.key !== getRecommendationCandidateKey(candidate))
    .sort((first, second) => second.updatedAt - first.updatedAt);
  const positiveMatch = positiveEntries.find(entry => sharedGenreCount(candidate, entry.genres) > 0);
  if (positiveMatch) return `Similar to ${positiveMatch.name}`;

  const finishedMatch = findMostRecentGenreMatch(candidate, context.finishedLibrary);
  if (finishedMatch) return `Because you finished ${finishedMatch.name}`;

  const watchedMatch = findMostRecentGenreMatch(candidate, context.watchedLibrary);
  if (watchedMatch) return `Because you watched ${watchedMatch.name}`;

  const runtime = Number(candidate.runtime);
  if (Number.isFinite(runtime) && runtime > 0 && runtime <= 35) return `A quick ${Math.round(runtime)}-minute watch`;
  if (candidate.isMovie && Number.isFinite(runtime) && runtime >= 60 && runtime <= 105) {
    return `A shorter ${Math.round(runtime)}-minute movie`;
  }

  if (context.source.kind === "trending" && context.watchedLibrary.length >= 3) {
    const knownGenres = new Set(context.watchedLibrary.flatMap(item => normalizeGenres(item.genres)));
    const candidateGenres = normalizeGenres(candidate.genres);
    const outsideUsualGenres = candidateGenres.length > 0 && candidateGenres.every(genre => !knownGenres.has(genre));
    if (outsideUsualGenres) return "Trending outside your usual genres";
  }

  switch (context.source.kind) {
    case "trending": return "Trending this week";
    case "hidden-gem": return "Highly rated and easy to miss";
    case "premiering": return "A new arrival for your radar";
    case "network": return `Popular on ${context.source.name}`;
    default: return "A popular starting point";
  }
}
