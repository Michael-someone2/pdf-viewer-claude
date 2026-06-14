"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FileRecord } from "@/lib/types";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerPaneProps {
  file: FileRecord | null;
  label: string;
  onClose?: () => void;
}

export default function PdfViewerPane({
  file,
  label,
  onClose,
}: PdfViewerPaneProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1.2);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setUrl(null);
    setNumPages(0);
    setPageNumber(1);
    setPageInput("1");
    setScale(1.2);

    if (!file) return;

    let active = true;
    setLoadingUrl(true);
    const supabase = createClient();
    supabase.storage
      .from("pdfs")
      .createSignedUrl(file.storage_path, 60 * 60)
      .then(({ data, error: signError }) => {
        if (!active) return;
        if (signError || !data) {
          setError("Не удалось получить ссылку на файл");
        } else {
          setUrl(data.signedUrl);
        }
        setLoadingUrl(false);
      });

    return () => {
      active = false;
    };
  }, [file]);

  const goToPage = (page: number) => {
    if (!Number.isFinite(page)) {
      setPageInput(String(pageNumber));
      return;
    }
    const max = numPages || 1;
    const clamped = Math.min(Math.max(Math.round(page), 1), max);
    setPageNumber(clamped);
    setPageInput(String(clamped));
  };

  if (!file) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500">
          {label}
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          Выберите файл в списке слева
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium"
          title={file.name}
        >
          {file.name}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToPage(pageNumber - 1)}
            disabled={pageNumber <= 1}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            title="Предыдущая страница"
          >
            <ChevronLeft size={16} />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToPage(Number(pageInput));
            }}
            className="flex items-center gap-1"
          >
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => goToPage(Number(pageInput))}
              className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center text-xs focus:outline-none"
              inputMode="numeric"
            />
            <span className="text-xs text-slate-400">
              / {numPages || "?"}
            </span>
          </form>
          <button
            type="button"
            onClick={() => goToPage(pageNumber + 1)}
            disabled={pageNumber >= numPages}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            title="Следующая страница"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setScale((s) => Math.max(0.4, +(s - 0.1).toFixed(2)))
            }
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            title="Уменьшить"
          >
            <ZoomOut size={16} />
          </button>
          <span className="w-10 text-center text-xs text-slate-500">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              setScale((s) => Math.min(3, +(s + 0.1).toFixed(2)))
            }
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            title="Увеличить"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
            title="Закрыть панель"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-slate-200 p-4">
        {error && (
          <p className="mx-auto max-w-md rounded bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            {error}
          </p>
        )}
        {loadingUrl && (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        )}
        {url && (
          <div className="flex justify-center">
            <Document
              key={url}
              file={url}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              onLoadError={() => setError("Не удалось открыть PDF-файл")}
              loading={
                <div className="flex h-96 items-center justify-center text-slate-400">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              }
            >
              <Page pageNumber={pageNumber} scale={scale} />
            </Document>
          </div>
        )}
      </div>
    </div>
  );
}
