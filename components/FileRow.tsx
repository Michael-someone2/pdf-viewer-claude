"use client";

import { Columns2, FileText, Pencil, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/files";
import {
  DRAG_MIME_TYPE,
  type DragPayload,
  type FileRecord,
  type PaneId,
} from "@/lib/types";
import { useLongPressDrag } from "@/lib/useLongPressDrag";
import { getViewerState } from "@/lib/viewerState";

interface FileRowProps {
  file: FileRecord;
  level: number;
  isActiveLeft: boolean;
  isActiveRight: boolean;
  isRenaming: boolean;
  renameValue: string;
  onOpen: (file: FileRecord, pane: PaneId) => void;
  onStartRename: (file: FileRecord) => void;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDelete: (file: FileRecord) => void;
  onSetDragOverTarget: (target: string | null) => void;
  onStartTouchDrag: (
    payload: DragPayload,
    label: string,
    x: number,
    y: number,
  ) => void;
}

export default function FileRow({
  file,
  level,
  isActiveLeft,
  isActiveRight,
  isRenaming,
  renameValue,
  onOpen,
  onStartRename,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  onSetDragOverTarget,
  onStartTouchDrag,
}: FileRowProps) {
  const longPress = useLongPressDrag(
    onStartTouchDrag,
    { type: "file", id: file.id },
    file.name,
    isRenaming,
  );

  const saved = getViewerState(file.id);
  const progress =
    saved?.totalPages && saved.page
      ? Math.min(Math.round((saved.page / saved.totalPages) * 100), 100)
      : 0;

  return (
    <div
      draggable={!isRenaming}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          DRAG_MIME_TYPE,
          JSON.stringify({ type: "file", id: file.id } satisfies DragPayload),
        );
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => onSetDragOverTarget(null)}
      onTouchStart={longPress.onTouchStart}
      onTouchMove={longPress.onTouchMove}
      onTouchEnd={longPress.onTouchEnd}
      onClickCapture={longPress.onClickCapture}
      className={`relative group flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 ${
        isActiveLeft || isActiveRight ? "bg-slate-100 dark:bg-zinc-800" : ""
      }`}
      style={{ paddingLeft: `${level * 16 + 24}px` }}
    >
      <FileText size={15} className="shrink-0 text-red-500 dark:text-red-400" />

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
          className="min-w-0 flex-1 rounded border border-slate-300 px-1 py-0.5 text-sm focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
      ) : (
        <button
          type="button"
          onClick={() => onOpen(file, "left")}
          className="min-w-0 flex-1 truncate text-left text-slate-700 dark:text-zinc-200"
          title={file.name}
        >
          {file.name}
          {isActiveLeft && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle dark:bg-blue-400" />
          )}
          {isActiveRight && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle dark:bg-emerald-400" />
          )}
        </button>
      )}

      <span className="hidden shrink-0 text-xs text-slate-400 group-hover:inline dark:text-zinc-600">
        {formatBytes(file.size)}
      </span>

      <button
        type="button"
        onClick={() => onOpen(file, "right")}
        title="Открыть в правой панели"
        className="hidden shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 group-hover:inline-flex [@media(hover:none)]:inline-flex dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
      >
        <Columns2 size={14} />
      </button>
      <button
        type="button"
        onClick={() => onStartRename(file)}
        title="Переименовать"
        className="hidden shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 group-hover:inline-flex [@media(hover:none)]:inline-flex dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(file)}
        title="Удалить"
        className="hidden shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600 group-hover:inline-flex [@media(hover:none)]:inline-flex dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
      >
        <Trash2 size={14} />
      </button>

      {progress > 0 && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
          <div
            className={`h-full transition-all ${
              progress >= 100
                ? "bg-emerald-500 dark:bg-emerald-400"
                : "bg-blue-400 dark:bg-violet-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
