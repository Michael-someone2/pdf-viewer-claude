"use client";

import { useState } from "react";
import { Columns2, LogOut } from "lucide-react";
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
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <h1 className="text-base font-semibold text-slate-900">
          PDF Просмотрщик
        </h1>
        <div className="flex items-center gap-3">
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
            Разделить экран
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
              Выйти
            </button>
          </form>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <FileBrowser
          onOpenFile={handleOpenFile}
          activeFiles={{ left: leftFile?.id ?? null, right: rightFile?.id ?? null }}
        />
        <main className="flex-1 overflow-hidden">
          <SplitViewer
            leftFile={leftFile}
            rightFile={rightFile}
            splitEnabled={splitEnabled}
            onCloseRight={() => {
              setRightFile(null);
              setSplitEnabled(false);
            }}
          />
        </main>
      </div>
    </div>
  );
}
