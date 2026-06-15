"use client";

import { useEffect, useState } from "react";
import { Columns2, LogOut, Maximize2, Minimize2 } from "lucide-react";
import { logout } from "@/app/login/actions";
import FileBrowser from "./FileBrowser";
import SplitViewer from "./SplitViewer";
import type { FileRecord, PaneId } from "@/lib/types";

interface AppShellProps {
  userEmail: string;
}

export default function AppShell({ userEmail }: AppShellProps) {
  const [leftFile, setLeftFile] = useState<FileRecord | null>(null);
  const [rightFile, setRightFile] = useState<FileRecord | null>(null);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  const handleOpenFile = (file: FileRecord, pane: PaneId) => {
    if (pane === "left") {
      setLeftFile(file);
    } else {
      setRightFile(file);
      setSplitEnabled(true);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {!focusMode && (
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
          <h1 className="text-base font-semibold text-slate-900">
            PDF Просмотрщик
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-2 gap-y-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSplitEnabled((s) => !s)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                splitEnabled
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
              title="Показать вторую панель просмотра"
            >
              <Columns2 size={14} />
              <span className="hidden sm:inline">Разделить экран</span>
            </button>
            <button
              type="button"
              onClick={() => setFocusMode(true)}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="Скрыть интерфейс (выход — Esc)"
            >
              <Maximize2 size={14} />
              <span className="hidden sm:inline">Скрыть интерфейс</span>
            </button>
            <span className="hidden text-xs text-slate-500 sm:inline">
              {userEmail}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </form>
          </div>
        </header>
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className={focusMode ? "hidden" : "contents"}>
          <FileBrowser
            onOpenFile={handleOpenFile}
            activeFiles={{
              left: leftFile?.id ?? null,
              right: rightFile?.id ?? null,
            }}
          />
        </div>
        <main className="relative flex-1 overflow-hidden">
          <SplitViewer
            leftFile={leftFile}
            rightFile={rightFile}
            splitEnabled={splitEnabled}
            onCloseRight={() => {
              setRightFile(null);
              setSplitEnabled(false);
            }}
          />
          {focusMode && (
            <button
              type="button"
              onClick={() => setFocusMode(false)}
              title="Показать интерфейс (Esc)"
              className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-xs font-medium text-slate-700 shadow backdrop-blur hover:bg-white"
            >
              <Minimize2 size={14} />
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
