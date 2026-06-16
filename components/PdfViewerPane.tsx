"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
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

interface OutlineItem {
  title: string;
  dest: string | any[] | null;
  items: OutlineItem[];
  bold?: boolean;
}

function OutlineTree({
  items,
  depth = 0,
  onNavigate,
}: {
  items: OutlineItem[];
  depth?: number;
  onNavigate: (dest: string | any[] | null) => void;
}) {
  return (
    <>
      {items.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => onNavigate(item.dest)}
            style={{ paddingLeft: `${depth * 10 + 8}px` }}
            className={`w-full truncate rounded py-0.5 pr-2 text-left text-[11px] leading-5 hover:bg-slate-100 dark:hover:bg-zinc-800 ${
              item.bold ? "font-semibold" : ""
            } text-slate-700 dark:text-zinc-300`}
            title={item.title}
          >
            {item.title}
          </button>
          {item.items?.length > 0 && (
            <OutlineTree
              items={item.items}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          )}
        </div>
      ))}
    </>
  );
}

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

  // ── Outline (Table of Contents) ────────────────────────────────────
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);

  // ── Text search ────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPages, setSearchPages] = useState<number[]>([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const [indexingDone, setIndexingDone] = useState(false);
  const pdfDocRef = useRef<any>(null);
  const pageTextsRef = useRef<Map<number, string>>(new Map());
  const indexGenRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

    // Reset outline and search state for new file
    setOutline(null);
    setOutlineOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchPages([]);
    setSearchIdx(0);
    setIndexingDone(false);
    pageTextsRef.current.clear();
    pdfDocRef.current = null;
    indexGenRef.current += 1;

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

  // Build a plain-text index of all pages for in-pane search.
  // Runs in the background page-by-page so it doesn't block the UI.
  const buildTextIndex = async (pdf: any, gen: number) => {
    pageTextsRef.current.clear();
    for (let i = 1; i <= pdf.numPages; i++) {
      if (indexGenRef.current !== gen) return; // file changed — abort
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = (content.items as any[])
        .filter((item) => typeof item.str === "string")
        .map((item) => item.str as string)
        .join(" ")
        .toLowerCase();
      pageTextsRef.current.set(i, text);
    }
    if (indexGenRef.current === gen) setIndexingDone(true);
  };

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

  // ── Search helpers ─────────────────────────────────────────────────

  const doSearch = (q: string) => {
    const term = q.toLowerCase().trim();
    if (!term) {
      setSearchPages([]);
      setSearchIdx(0);
      return;
    }
    const matches: number[] = [];
    for (const [page, text] of pageTextsRef.current) {
      if (text.includes(term)) matches.push(page);
    }
    matches.sort((a, b) => a - b);
    setSearchPages(matches);
    setSearchIdx(0);
    if (matches.length > 0) goToPage(matches[0]);
  };

  // Re-run search when indexing completes so results are complete.
  useEffect(() => {
    if (indexingDone && searchQuery.trim()) doSearch(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexingDone]);

  const goToSearchResult = (dir: "next" | "prev") => {
    if (searchPages.length < 2) return;
    const next =
      dir === "next"
        ? (searchIdx + 1) % searchPages.length
        : (searchIdx - 1 + searchPages.length) % searchPages.length;
    setSearchIdx(next);
    goToPage(searchPages[next]);
  };

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 40);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchPages([]);
    setSearchIdx(0);
  };

  // ── Outline navigation ─────────────────────────────────────────────

  const handleOutlineClick = async (dest: string | any[] | null) => {
    if (!dest || !pdfDocRef.current) return;
    try {
      const resolved = Array.isArray(dest)
        ? dest
        : await pdfDocRef.current.getDestination(dest as string);
      if (!resolved) return;
      const pageIndex = await pdfDocRef.current.getPageIndex(resolved[0]);
      goToPage(pageIndex + 1);
    } catch {
      // некоторые PDF имеют невалидные destination-ы
    }
  };

  // ── Pinch-to-zoom ──────────────────────────────────────────────────
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
      <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
        <div className="border-b border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
          {label}
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400 dark:text-zinc-600">
          Выберите файл в списке слева
        </div>
      </div>
    );
  }

  return (
    // dark:flex-col-reverse перемещает тулбар вниз в тёмном режиме
    <div className="flex h-full flex-col dark:flex-col-reverse">
      {/* ── Toolbar ── */}
      <div className="flex flex-col border-b border-slate-200 bg-white dark:border-t dark:border-b-0 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Main row */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span
            className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-zinc-100"
            title={file.name}
          >
            {file.name}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(pageNumber - 1)}
              disabled={pageNumber <= 1}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
                className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center text-xs focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                inputMode="numeric"
              />
              <span className="text-xs text-slate-400 dark:text-zinc-500">
                / {numPages || "?"}
              </span>
            </form>
            <button
              type="button"
              onClick={() => goToPage(pageNumber + 1)}
              disabled={pageNumber >= numPages}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Следующая страница"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => adjustScale(-0.1)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Уменьшить"
            >
              <ZoomOut size={16} />
            </button>
            <span className="w-10 text-center text-xs text-slate-500 dark:text-zinc-400">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => adjustScale(0.1)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Увеличить"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={searchOpen ? closeSearch : openSearch}
            className={`rounded p-1 transition-colors ${
              searchOpen
                ? "bg-blue-50 text-blue-600 dark:bg-violet-900/40 dark:text-violet-400"
                : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            title="Поиск по тексту"
          >
            <Search size={16} />
          </button>

          {outline !== null && (
            <button
              type="button"
              onClick={() => setOutlineOpen((v) => !v)}
              className={`rounded p-1 transition-colors ${
                outlineOpen
                  ? "bg-blue-50 text-blue-600 dark:bg-violet-900/40 dark:text-violet-400"
                  : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
              title={
                outline.length === 0 ? "Оглавление отсутствует" : "Оглавление"
              }
              disabled={outline.length === 0}
            >
              <BookOpen size={16} />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
              title="Закрыть панель"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search row */}
        {searchOpen && (
          <div className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-1.5 dark:border-zinc-800">
            <Search
              size={13}
              className="shrink-0 text-slate-400 dark:text-zinc-500"
            />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                doSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToSearchResult("next");
                if (e.key === "Escape") closeSearch();
              }}
              placeholder="Поиск по тексту..."
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none dark:text-zinc-200 dark:placeholder-zinc-600"
            />
            {searchQuery && (
              <span className="shrink-0 whitespace-nowrap text-xs text-slate-500 dark:text-zinc-500">
                {!indexingDone
                  ? "Индексирую..."
                  : searchPages.length === 0
                    ? "Не найдено"
                    : `стр. ${searchPages[searchIdx]}  (${searchIdx + 1}/${searchPages.length})`}
              </span>
            )}
            <button
              type="button"
              onClick={() => goToSearchResult("prev")}
              disabled={searchPages.length < 2}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Предыдущее совпадение"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => goToSearchResult("next")}
              disabled={searchPages.length < 2}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Следующее совпадение"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={closeSearch}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:text-zinc-600 dark:hover:bg-zinc-800"
              title="Закрыть поиск"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── PDF content area (outline sidebar + scroll) ── */}
      <div className="flex flex-1 overflow-hidden">
        {outlineOpen && outline && outline.length > 0 && (
          <aside className="w-52 shrink-0 overflow-y-auto border-r border-slate-200 bg-white py-1 dark:border-zinc-800 dark:bg-zinc-900">
            <OutlineTree items={outline} onNavigate={handleOutlineClick} />
          </aside>
        )}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: "pan-y" }}
          className="flex-1 overflow-auto bg-slate-200 p-4 dark:bg-zinc-950"
        >
          {error && (
            <p className="mx-auto max-w-md rounded bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
              {error}
            </p>
          )}
          {loadingUrl && (
            <div className="flex h-full items-center justify-center text-slate-400 dark:text-zinc-600">
              <Loader2 size={24} className="animate-spin" />
            </div>
          )}
          {url && (
            <Document
              key={url}
              file={url}
              onLoadSuccess={(pdf) => {
                setNumPages(pdf.numPages);
                if (file) setViewerState(file.id, { totalPages: pdf.numPages });
                pdfDocRef.current = pdf;
                const gen = indexGenRef.current;
                buildTextIndex(pdf, gen);
                pdf.getOutline().then((items: any) => {
                  setOutline(items ?? []);
                });
                pdf.getPage(1).then((page: any) => {
                  const viewport = page.getViewport({ scale: 1 });
                  setPageSize({
                    width: viewport.width,
                    height: viewport.height,
                  });
                });
              }}
              onLoadError={() => setError("Не удалось открыть PDF-файл")}
              loading={
                <div className="flex h-96 items-center justify-center text-slate-400 dark:text-zinc-600">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              }
            >
              {pageSize && (
                <div className="flex flex-col items-center">
                  {Array.from({ length: numPages }, (_, i) => i + 1).map(
                    (p) => (
                      <div
                        key={p}
                        style={{
                          width: pageSize.width * scale,
                          height: pageSize.height * scale,
                          marginBottom: PAGE_GAP,
                        }}
                        className="bg-white shadow-md dark:shadow-black/60"
                      >
                        {Math.abs(p - pageNumber) <= RENDER_BUFFER && (
                          <Page pageNumber={p} scale={scale} loading={null} />
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
