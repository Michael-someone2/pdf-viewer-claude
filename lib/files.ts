import type { FolderRecord } from "./types";

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** Возвращает id папки и всех её вложенных подпапок (рекурсивно). */
export function getDescendantFolderIds(
  folders: FolderRecord[],
  rootId: string,
): string[] {
  const result = [rootId];
  let frontier = [rootId];

  while (frontier.length > 0) {
    const next = folders
      .filter((f) => f.parent_id && frontier.includes(f.parent_id))
      .map((f) => f.id);
    result.push(...next);
    frontier = next;
  }

  return result;
}
