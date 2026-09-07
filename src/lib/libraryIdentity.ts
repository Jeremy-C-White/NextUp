import { UserShow } from "../types";

export type LibraryShowIdentity = Pick<UserShow, "id" | "tvmazeId">;

export function normalizeLibraryDocumentId(showId: string | number): string {
  const documentId = String(showId).trim();
  if (!documentId || documentId.includes("/")) {
    throw new Error("Invalid library show ID");
  }
  return documentId;
}

/**
 * Return every Firestore document ID that older app versions may have used
 * for a show. The original source ID is canonical; a resolved TVMaze ID is
 * included so removing a show also clears a duplicate created by the old
 * watched-progress bug.
 */
export function getLibraryDocumentIds(show: LibraryShowIdentity): string[] {
  const ids = [normalizeLibraryDocumentId(show.id)];
  if (Number.isFinite(show.tvmazeId)) {
    ids.push(normalizeLibraryDocumentId(show.tvmazeId));
  }
  return [...new Set(ids)];
}
