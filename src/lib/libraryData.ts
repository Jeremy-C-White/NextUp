import { UserShow } from "../types";

type LibraryRecord = Partial<UserShow> & {
  title?: unknown;
  showName?: unknown;
  posterUrl?: unknown;
  show?: { name?: unknown } | unknown;
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Reads saved library records without turning patch-only or malformed Firestore
 * documents into fake "Untitled" shows. Older title aliases are recovered when
 * possible; records with no real display title are omitted from the UI.
 */
export function parseLibraryShowRecord(data: unknown, documentId: string): UserShow | null {
  if (!data || typeof data !== "object") return null;

  const record = data as LibraryRecord;
  const nestedShow = record.show && typeof record.show === "object"
    ? record.show as { name?: unknown }
    : null;
  const name = nonEmptyString(record.name) ||
    nonEmptyString(record.title) ||
    nonEmptyString(record.showName) ||
    nonEmptyString(nestedShow?.name);

  if (!name) return null;

  const imageUrl = nonEmptyString(record.imageUrl) || nonEmptyString(record.posterUrl) || "";
  return {
    ...record,
    id: documentId,
    name,
    imageUrl
  } as UserShow;
}
