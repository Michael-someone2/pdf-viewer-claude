"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { getViewerState, setViewerState } from "@/lib/viewerState";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PAGE_GAP = 16;
const RENDER_BUFFER = 2;

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
  const [pageSize, setPageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const prevItemHeightRef = useRef<number | null>(null);
  const pendingPageRef = useRef<number | null>(null);
  const pageNumberRef = useRef(1);

  useEffect(() => {
    pageNumberRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    setError(null);
    setUrl(null);
    setNumPages(0);
    setPageNumber(1);
    setPageInput("1");
    setPageSize(null);
    prevItemHeightRef.current = null;
    pendingPageRef.current = null;
    if (containerRef.current) containerRef.current.scrollTop = 0;

    if (!file) return;

    const saved = getViewerState(file.id);
    if (saved?.scale) setScale(saved.scale);
    if (saved?.page && saved.page > 1) {
      setPageNumber(saved.page);
      setPageInput(String(saved.page));
      pendingPageRef.current = saved.page;
    }

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

  // При изменении масштаба пересчитываем прокрутку, чтобы текущая
  // страница осталась на том же месте, а не "уплыла" из-за изменения
  // высоты страниц.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pageSize) return;
    const newItemHeight = pageSize.height * scale + PAGE_GAP;
    const prevItemHeight = prevItemHeightRef.current;
    if (prevItemHeight && prevItemHeight !== newItemHeight) {
      el.scrollTop = (el.scrollTop / prevItemHeight) * newItemHeight;
    }
    prevItemHeightRef.current = newItemHeight;
  }, [scale, pageSize]);

  // При открытии файла прокручиваем к сохранённой странице, как только
  // становится известен размер страницы.
  useEffect(() => {
    const el = containerRef.current;
    const pending = pendingPageRef.current;
    if (!el || !pageSize || !pending) return;
    const target = numPages ? Math.min(pending, numPages) : pending;
    const itemHeight = pageSize.height * scale + PAGE_GAP;
    el.scrollTop = (target - 1) * itemHeight;
    pendingPageRef.current = null;
  }, [pageSize, numPages, scale]);

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = containerRef.current;
      if (!el || !pageSize || !numPages) return;
      const itemHeight = pageSize.height * scale + PAGE_GAP;
      const idx = Math.floor(el.scrollTop / itemHeight) + 1;
      const clamped = Math.min(Math.max(idx, 1), numPages);
      if (clamped !== pageNumberRef.current && file) {
        setViewerState(file.id, { page: clamped });
      }
      setPageNumber((prev) => (prev === clamped ? prev : clamped));
      setPageInput((prev) =>
        prev === String(clamped) ? prev : String(clamped),
      );
    });
  }, [pageSize, scale, numPages, file]);

  const goToPage = (page: number) => {
    if (!Number.isFinite(page)) {
      setPageInput(String(pageNumber));
      return;
    }
    const max = numPages || 1;
    const clamped = Math.min(Math.max(Math.round(page), 1), max);
    setPageNumber(clamped);
    setPageInput(String(clamped));
    if (file) setViewerState(file.id, { page: clamped });
    const el = containerRef.current;
    if (el && pageSize) {
      const itemHeight = pageSize.height * scale + PAGE_GAP;
      el.scrollTop = (clamped - 1) * itemHeight;
    }
  };

  const adjustScale = (delta: number) => {
    const next = Math.min(3, Math.max(0.4, +(scale + delta).toFixed(2)));
    setScale(next);
    if (file) setViewerState(file.id, { scale: next });
  };

  // Зум щипком (pinch) на тач-устройствах. touch-action: pan-y на
  // контейнере отключает нативный зум браузера, не мешая вертикальной
  // прокрутке одним пальцем.
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  const touchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { distance: touchDistance(e.touches), scale };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const pinch = pinchRef.current;
    if (e.touches.length === 2 && pinch) {
      const ratio = touchDistance(e.touches) / pinch.distance;
      setScale(Math.min(3, Math.max(0.4, +(pinch.scale * ratio).toFixed(2))));
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2 && pinchRef.current) {
      pinchRef.current = null;
      if (file) setViewerState(file.id, { scale });
    }
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
            <span className="text-xs text-slate-400">/ {numPages || "?"}</span>
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
            onClick={() => adjustScale(-0.1)}
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
            onClick={() => adjustScale(0.1)}
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

      <div
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: "pan-y" }}
        className="flex-1 overflow-auto bg-slate-200 p-4"
      >
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
          <Document
            key={url}
            file={url}
            onLoadSuccess={(pdf) => {
              setNumPages(pdf.numPages);
              pdf.getPage(1).then((page) => {
                const viewport = page.getViewport({ scale: 1 });
                setPageSize({
                  width: viewport.width,
                  height: viewport.height,
                });
              });
            }}
            onLoadError={() => setError("Не удалось открыть PDF-файл")}
            loading={
              <div className="flex h-96 items-center justify-center text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            }
          >
            {pageSize && (
              <div className="flex flex-col items-center">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                  <div
                    key={p}
                    style={{
                      width: pageSize.width * scale,
                      height: pageSize.height * scale,
                      marginBottom: PAGE_GAP,
                    }}
                    className="bg-white shadow"
                  >
                    {Math.abs(p - pageNumber) <= RENDER_BUFFER && (
                      <Page pageNumber={p} scale={scale} loading={null} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Document>
        )}
      </div>
    </div>
  );
}
