export interface FolderRecord {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

export interface FileRecord {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  size: number;
  created_at: string;
}

export type PaneId = "left" | "right";

export interface DragPayload {
  type: "file" | "folder";
  id: string;
}

export const DRAG_MIME_TYPE = "application/x-pdfviewer-item";
