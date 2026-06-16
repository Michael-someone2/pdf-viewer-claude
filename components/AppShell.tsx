"use client";

import { useEffect, useState } from "react";
import { Columns2, LogOut, Maximize2, Minimize2, Sparkles } from "lucide-react";
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
  const [isV2, setIsV2] = useState(false);

  useEffect(() => {
    setIsV2(localStorage.getItem("pdfViewerInterface") === "v2");
  }, []);

  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  const toggleInterface = () => {
    const next = !isV2;
    setIsV2(next);
    localStorage.setItem("pdfViewerInterface", next ? "v2" : "v1");
  };

  const handleOpenFile = (file: FileRecord, pane: PaneId) => {
    if (pane === "left") {
      setLeftFile(file);
    } else {
      setRightFile(file);
      setSplitEnabled(true);
    }
  };

  return (
    <div className={`flex h-screen flex-col${isV2 ? " dark" : ""}`}>
      {!focusMode && (
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            PDF Просмотрщик
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-2 gap-y-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSplitEnabled((s) => !s)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                splitEnabled
                  ? "border-slate-900 bg-slate-900 text-white dark:border-violet-600 dark:bg-violet-600"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
              title="Показать вторую панель просмотра"
            >
              <Columns2 size={14} />
              <span className="hidden sm:inline">Разделить экран</span>
            </button>

            <button
              type="button"
              onClick={toggleInterface}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors border-violet-400 text-violet-600 hover:bg-violet-50 dark:border-violet-500/60 dark:text-violet-300 dark:hover:bg-violet-900/30"
              title={
                isV2 ? "Вернуться к интерфейсу 1.0" : "Включить интерфейс 2.0"
              }
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">
                {isV2 ? "Интерфейс 1.0" : "Интерфейс 2.0"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFocusMode(true)}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Скрыть интерфейс (выход — Esc)"
            >
              <Maximize2 size={14} />
              <span className="hidden sm:inline">Скрыть интерфейс</span>
            </button>

            <span className="hidden text-xs text-slate-500 dark:text-zinc-500 sm:inline">
              {userEmail}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </form>
          </div>
        </header>
      )}
      <div className="flex flex-1 overflow-hidden bg-white dark:bg-zinc-950">
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
              className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-xs font-medium text-slate-700 shadow backdrop-blur hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <Minimize2 size={14} />
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
