"use client";

import { useEffect, useState } from "react";
import {
  Columns2,
  LogOut,
  Maximize2,
  Minimize2,
  PanelLeft,
  Sparkles,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import FileBrowser from "./FileBrowser";
import SplitViewer from "./SplitViewer";
import type { FileRecord, PaneId } from "@/lib/types";

// Блокируем браузерный пинч-зум страницы везде, кроме PDF-контейнера
// (внутри PDF-контейнера зум обрабатывается отдельным нативным listener'ом)
if (typeof document !== "undefined") {
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1 && !(e.target as Element).closest?.("[data-pdf-scroll]")) {
        e.preventDefault();
      }
    },
    { passive: false },
  );
}

interface AppShellProps {
  userEmail: string;
}

export default function AppShell({ userEmail }: AppShellProps) {
  const [leftFile, setLeftFile] = useState<FileRecord | null>(null);
  const [rightFile, setRightFile] = useState<FileRecord | null>(null);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isV2, setIsV2] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    setSidebarOpen(false);
    localStorage.setItem("pdfViewerInterface", next ? "v2" : "v1");
  };

  const handleOpenFile = (file: FileRecord, pane: PaneId) => {
    if (pane === "left") {
      setLeftFile(file);
    } else {
      setRightFile(file);
      setSplitEnabled(true);
    }
    if (isV2) setSidebarOpen(false);
  };

  // ── Interface 2.0 ─────────────────────────────────────────────────
  if (isV2) {
    return (
      <div className="dark relative flex h-screen bg-zinc-950">
        {/* Thin icon rail — replaces header entirely */}
        {!focusMode && (
          <nav className="relative z-40 flex w-12 flex-col items-center gap-1 border-r border-zinc-800 bg-zinc-950 py-3">
            <div className="mb-2 select-none text-[10px] font-bold tracking-widest text-violet-400">
              PDF
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              title="Файлы"
              className={`rounded-lg p-2.5 transition-colors ${
                sidebarOpen
                  ? "bg-violet-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <PanelLeft size={18} />
            </button>

            <button
              type="button"
              onClick={() => setSplitEnabled((s) => !s)}
              title="Разделить экран"
              className={`rounded-lg p-2.5 transition-colors ${
                splitEnabled
                  ? "bg-violet-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <Columns2 size={18} />
            </button>

            <div className="flex-1" />

            <button
              type="button"
              onClick={toggleInterface}
              title="Вернуться к интерфейсу 1.0"
              className="rounded-lg p-2.5 text-violet-400 transition-colors hover:bg-violet-900/40 hover:text-violet-300"
            >
              <Sparkles size={18} />
            </button>

            <button
              type="button"
              onClick={() => setFocusMode(true)}
              title="Режим фокуса (Esc для выхода)"
              className="rounded-lg p-2.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <Maximize2 size={18} />
            </button>

            <form action={logout}>
              <button
                type="submit"
                title={`Выйти (${userEmail})`}
                className="rounded-lg p-2.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
              >
                <LogOut size={18} />
              </button>
            </form>
          </nav>
        )}

        {/* Slide-in file browser — always mounted, hidden via translate */}
        <div
          className={`absolute top-0 z-30 h-full w-72 border-r border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60 transition-transform duration-200 ease-in-out ${
            focusMode ? "left-0" : "left-12"
          } ${!focusMode && sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <FileBrowser
            onOpenFile={handleOpenFile}
            activeFiles={{
              left: leftFile?.id ?? null,
              right: rightFile?.id ?? null,
            }}
          />
        </div>

        {/* Backdrop — closes sidebar on click */}
        {!focusMode && sidebarOpen && (
          <div
            className="absolute inset-0 left-12 z-20 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* PDF content — takes all remaining space */}
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
              className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/90 px-2 py-1.5 text-xs font-medium text-zinc-300 shadow backdrop-blur hover:bg-zinc-900"
            >
              <Minimize2 size={14} />
            </button>
          )}
        </main>
      </div>
    );
  }

  // ── Interface 1.0 (unchanged) ──────────────────────────────────────
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
              onClick={toggleInterface}
              className="flex items-center gap-1.5 rounded-md border border-violet-400 px-3 py-1.5 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-50"
              title="Включить интерфейс 2.0"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">Интерфейс 2.0</span>
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
      <div className="flex flex-1 overflow-hidden bg-white">
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
