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
