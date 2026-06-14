"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { FileRecord } from "@/lib/types";

const PdfViewerPane = dynamic(() => import("./PdfViewerPane"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  ),
});

interface SplitViewerProps {
  leftFile: FileRecord | null;
  rightFile: FileRecord | null;
  splitEnabled: boolean;
  onCloseRight: () => void;
}

export default function SplitViewer({
  leftFile,
  rightFile,
  splitEnabled,
  onCloseRight,
}: SplitViewerProps) {
  return (
    <div className="flex h-full w-full">
      <div
        className={
          splitEnabled
            ? "h-full w-1/2 border-r border-slate-200"
            : "h-full w-full"
        }
      >
        <PdfViewerPane file={leftFile} label="Левая панель" />
      </div>
      {splitEnabled && (
        <div className="h-full w-1/2">
          <PdfViewerPane
            file={rightFile}
            label="Правая панель"
            onClose={onCloseRight}
          />
        </div>
      )}
    </div>
  );
}
