export function firstPositiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numericValue = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
  }
  return null;
}

export function formatRuntimeMinutes(value: unknown): string | null {
  const runtime = firstPositiveNumber(value);
  if (runtime === null) return null;

  const totalMinutes = Math.round(runtime);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
