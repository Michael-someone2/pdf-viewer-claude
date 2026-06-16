export type TagColor = "red" | "orange" | "green" | "blue" | "purple";

// Hex values used for inline styles to avoid Tailwind purge issues.
export const TAG_HEX: Record<TagColor, string> = {
  red: "#ef4444",
  orange: "#f97316",
  green: "#10b981",
  blue: "#3b82f6",
  purple: "#8b5cf6",
};

export const TAG_LABELS: Record<TagColor, string> = {
  red: "Красная метка",
  orange: "Оранжевая метка",
  green: "Зелёная метка",
  blue: "Синяя метка",
  purple: "Фиолетовая метка",
};

export const TAG_COLOR_LIST: TagColor[] = [
  "red",
  "orange",
  "green",
  "blue",
  "purple",
];

const STORAGE_KEY = "pdf-viewer-tags";

function readAll(): Record<string, TagColor> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getTag(fileId: string): TagColor | null {
  return readAll()[fileId] ?? null;
}

export function setTag(fileId: string, color: TagColor | null): void {
  try {
    const all = readAll();
    if (color === null) {
      delete all[fileId];
    } else {
      all[fileId] = color;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage недоступен
  }
}
