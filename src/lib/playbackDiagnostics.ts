import { PlaybackCandidate } from "../types";

export type PlaybackDiagnosticValue = string | number | boolean | null | undefined;

const sanitizeDiagnosticValue = (value: string): string => {
  const compact = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(compact)) return "[redacted-url]";
  return compact
    .replace(/([?&](?:token|auth|key|signature|expires)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 240);
};

const formatValue = (value: Exclude<PlaybackDiagnosticValue, null | undefined>): string => {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(sanitizeDiagnosticValue(value));
};

/**
 * Produces a single copy-friendly console line. Values are quoted and scrubbed
 * so provider URLs or short-lived credentials cannot accidentally enter logs.
 */
export function formatPlaybackDiagnostic(
  event: string,
  details: Record<string, PlaybackDiagnosticValue> = {}
): string {
  const fields = Object.entries(details)
    .filter((entry): entry is [string, Exclude<PlaybackDiagnosticValue, null | undefined>] => (
      entry[1] !== undefined && entry[1] !== null && entry[1] !== ""
    ))
    .map(([key, value]) => `${key}=${formatValue(value)}`);
  return `[NextUp playback] ${sanitizeDiagnosticValue(event)}${fields.length ? ` ${fields.join(" ")}` : ""}`;
}

export function getPlaybackSourceDiagnosticFields(
  candidate: PlaybackCandidate | null | undefined,
  index?: number,
  total?: number
): Record<string, PlaybackDiagnosticValue> {
  const position = Number.isInteger(index) && (index || 0) >= 0 && Number.isInteger(total) && (total || 0) > 0
    ? `${(index || 0) + 1}/${total}`
    : "unknown";
  return {
    position,
    provider: candidate?.provider || "unknown",
    quality: candidate?.quality || "unknown",
    codec: candidate?.videoCodec || "unknown",
    fingerprint: candidate?.fingerprint || "unavailable"
  };
}

