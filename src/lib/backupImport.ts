import { UserShow } from "../types";
import { removeUndefined } from "./library";

export const LIBRARY_IMPORT_BATCH_SIZE = 450;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function prepareLibraryImport(value: unknown): UserShow[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid backup file format. Expected an array of shows.");
  }

  return value.flatMap(item => {
    if (!isRecord(item)) return [];

    const id = typeof item.id === "string" || typeof item.id === "number"
      ? String(item.id).trim()
      : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";

    // Firestore document IDs are path segments. Backups created by NextUp do
    // not contain slashes, so reject a malformed external file instead of
    // accidentally writing outside the intended show document.
    if (!id || id.includes("/") || !name) return [];

    return [removeUndefined({ ...item, id, name }) as UserShow];
  });
}

export function chunkLibraryImport(
  shows: UserShow[],
  batchSize: number = LIBRARY_IMPORT_BATCH_SIZE
): UserShow[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error("Import batch size must be between 1 and 500.");
  }

  const chunks: UserShow[][] = [];
  for (let index = 0; index < shows.length; index += batchSize) {
    chunks.push(shows.slice(index, index + batchSize));
  }
  return chunks;
}
