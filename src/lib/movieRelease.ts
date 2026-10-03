interface TMDBReleaseDateEntry {
  type?: number;
  release_date?: string;
}

interface TMDBCountryReleaseDates {
  iso_3166_1?: string;
  release_dates?: TMDBReleaseDateEntry[];
}

interface TMDBReleaseDatesResponse {
  results?: TMDBCountryReleaseDates[];
}

export function findReleasedDigitalDate(
  data: TMDBReleaseDatesResponse,
  region = "US",
  now: number = Date.now()
): string | null {
  const country = data.results?.find(result => result.iso_3166_1 === region);
  const releasedDigitalDates = (country?.release_dates || [])
    .filter(entry => Number(entry.type) === 4 && typeof entry.release_date === "string")
    .map(entry => ({
      value: entry.release_date as string,
      timestamp: new Date(entry.release_date as string).getTime()
    }))
    .filter(entry => Number.isFinite(entry.timestamp) && entry.timestamp <= now)
    .sort((first, second) => first.timestamp - second.timestamp);

  return releasedDigitalDates[0]?.value || null;
}

// Digital (rent/buy or streaming), Physical (disc) and TV release types.
const HOME_RELEASE_TYPES = new Set([4, 5, 6]);

/**
 * The first date a movie could be watched at home in the region (digital,
 * disc or TV, whichever came first), or null when it is not out at home yet.
 * A later disc or streaming date does not make an older movie "new".
 */
export function findFirstHomeReleaseDate(
  data: TMDBReleaseDatesResponse,
  region = "US",
  now: number = Date.now()
): string | null {
  const country = data.results?.find(result => result.iso_3166_1 === region);
  const first = (country?.release_dates || [])
    .filter(entry => HOME_RELEASE_TYPES.has(Number(entry.type)) && typeof entry.release_date === "string")
    .map(entry => ({
      value: entry.release_date as string,
      timestamp: new Date(entry.release_date as string).getTime()
    }))
    .filter(entry => Number.isFinite(entry.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp)[0];

  if (!first || first.timestamp > now) return null;
  return first.value;
}
