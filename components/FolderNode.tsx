"use client";

import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import FileRow from "./FileRow";
import {
  DRAG_MIME_TYPE,
  type DragPayload,
  type FileRecord,
  type FolderRecord,
  type PaneId,
} from "@/lib/types";
import { useLongPressDrag } from "@/lib/useLongPressDrag";

export interface RenameState {
  type: "folder" | "file";
  id: string;
}

export interface FolderNodeProps {
  folder: FolderRecord;
  folders: FolderRecord[];
  files: FileRecord[];
  level: number;
  expanded: Set<string>;
  activeFolderId: string | null;
  activeFiles: { left: string | null; right: string | null };
  renaming: RenameState | null;
  renameValue: string;
  onToggleExpand: (id: string) => void;
  onSetActiveFolder: (id: string) => void;
  onOpenFile: (file: FileRecord, pane: PaneId) => void;
  onStartRenameFolder: (folder: FolderRecord) => void;
  onStartRenameFile: (file: FileRecord) => void;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDeleteFolder: (folder: FolderRecord) => void;
  onDeleteFile: (file: FileRecord) => void;
  onMoveFile: (fileId: string, targetFolderId: string | null) => void;
  onMoveFolder: (folderId: string, targetFolderId: string | null) => void;
  dragOverTarget: string | null;
  onSetDragOverTarget: (target: string | null) => void;
  onStartTouchDrag: (
    payload: DragPayload,
    label: string,
    x: number,
    y: number,
  ) => void;
}

export default function FolderNode(props: FolderNodeProps) {
  const {
    folder,
    folders,
    files,
    level,
    expanded,
    activeFolderId,
    activeFiles,
    renaming,
    renameValue,
    onToggleExpand,
    onSetActiveFolder,
    onOpenFile,
    onStartRenameFolder,
    onStartRenameFile,
    onRenameValueChange,
    onRenameSubmit,
    onRenameCancel,
    onDeleteFolder,
    onDeleteFile,
    onMoveFile,
    onMoveFolder,
    dragOverTarget,
    onSetDragOverTarget,
    onStartTouchDrag,
  } = props;

  const isExpanded = expanded.has(folder.id);
  const isActive = activeFolderId === folder.id;
  const isRenaming = renaming?.type === "folder" && renaming.id === folder.id;

  const longPress = useLongPressDrag(
    onStartTouchDrag,
    { type: "folder", id: folder.id },
    folder.name,
    isRenaming,
  );

  const childFolders = folders
    .filter((f) => f.parent_id === folder.id)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const childFiles = files
    .filter((f) => f.folder_id === folder.id)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <div>
      <div
        draggable={!isRenaming}
        onDragStart={(e) => {
          e.dataTransfer.setData(
            DRAG_MIME_TYPE,
            JSON.stringify({
              type: "folder",
              id: folder.id,
            } satisfies DragPayload),
          );
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => onSetDragOverTarget(null)}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragOverTarget !== folder.id) onSetDragOverTarget(folder.id);
        }}
        onDragLeave={() => {
          if (dragOverTarget === folder.id) onSetDragOverTarget(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData(DRAG_MIME_TYPE);
          onSetDragOverTarget(null);
          if (!raw) return;
          const payload: DragPayload = JSON.parse(raw);
          if (payload.type === "file") onMoveFile(payload.id, folder.id);
          else onMoveFolder(payload.id, folder.id);
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
        onClickCapture={longPress.onClickCapture}
        data-drop-target={folder.id}
        className={`group flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-slate-100 ${
          isActive ? "bg-slate-100 font-medium" : ""
        } ${
          dragOverTarget === folder.id
            ? "bg-blue-50 ring-1 ring-inset ring-blue-300"
            : ""
        }`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => onToggleExpand(folder.id)}
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {isExpanded ? (
          <FolderOpen size={15} className="shrink-0 text-amber-500" />
        ) : (
          <Folder size={15} className="shrink-0 text-amber-500" />
        )}

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit();
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={onRenameSubmit}
            className="min-w-0 flex-1 rounded border border-slate-300 px-1 py-0.5 text-sm focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              onSetActiveFolder(folder.id);
              onToggleExpand(folder.id);
            }}
            className="min-w-0 flex-1 truncate text-left"
            title={folder.name}
          >
            {folder.name}
          </button>
        )}

        <button
          type="button"
          onClick={() => onStartRenameFolder(folder)}
          title="Переименовать"
          className="hidden shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 group-hover:inline-flex [@media(hover:none)]:inline-flex"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => onDeleteFolder(folder)}
          title="Удалить папку"
          className="hidden shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600 group-hover:inline-flex [@media(hover:none)]:inline-flex"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {isExpanded && (
        <div>
          {childFolders.map((child) => (
            <FolderNode
              key={child.id}
              {...props}
              folder={child}
              level={level + 1}
            />
          ))}
          {childFiles.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              level={level + 1}
              isActiveLeft={activeFiles.left === file.id}
              isActiveRight={activeFiles.right === file.id}
              isRenaming={renaming?.type === "file" && renaming.id === file.id}
              renameValue={renameValue}
              onOpen={onOpenFile}
              onStartRename={onStartRenameFile}
              onRenameValueChange={onRenameValueChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onDelete={onDeleteFile}
              onSetDragOverTarget={onSetDragOverTarget}
              onStartTouchDrag={onStartTouchDrag}
            />
          ))}
        </div>
      )}
    </div>
  );
}
