"use client";

import { Columns2, FileText, Pencil, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/files";
import type { FileRecord, PaneId } from "@/lib/types";

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
}: FileRowProps) {
  return (
    <div
      className={`group flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-slate-100 ${
        isActiveLeft || isActiveRight ? "bg-slate-100" : ""
      }`}
      style={{ paddingLeft: `${level * 16 + 24}px` }}
    >
      <FileText size={15} className="shrink-0 text-red-500" />

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
          onClick={() => onOpen(file, "left")}
          className="min-w-0 flex-1 truncate text-left"
          title={file.name}
        >
          {file.name}
          {isActiveLeft && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />
          )}
          {isActiveRight && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
          )}
        </button>
      )}

      <span className="hidden shrink-0 text-xs text-slate-400 group-hover:inline">
        {formatBytes(file.size)}
      </span>

      <button
        type="button"
        onClick={() => onOpen(file, "right")}
        title="Открыть в правой панели"
        className="hidden shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 group-hover:inline-flex"
      >
        <Columns2 size={14} />
      </button>
      <button
        type="button"
        onClick={() => onStartRename(file)}
        title="Переименовать"
        className="hidden shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 group-hover:inline-flex"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(file)}
        title="Удалить"
        className="hidden shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600 group-hover:inline-flex"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
