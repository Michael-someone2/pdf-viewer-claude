const STORAGE_KEY = "pdf-viewer-state";

interface FileViewerState {
  page?: number;
  scale?: number;
  totalPages?: number;
}

function readAll(): Record<string, FileViewerState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getViewerState(fileId: string): FileViewerState | null {
  return readAll()[fileId] ?? null;
}

export function setViewerState(fileId: string, state: FileViewerState) {
  try {
    const all = readAll();
    all[fileId] = { ...all[fileId], ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — игнорируем
  }
}
