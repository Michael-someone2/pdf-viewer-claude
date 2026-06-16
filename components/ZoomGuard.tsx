"use client";

import { useEffect, useRef } from "react";

/**
 * Глобально запрещает браузерный зум СТРАНИЦЫ всеми способами ввода,
 * И одновременно работает живым диагностическим зондом (временно).
 *
 * Зонд пишет прямо на плашку: число пальцев, cancelable события и реальный
 * computed touch-action элемента под пальцем — чтобы понять, почему пинч
 * всё ещё зумит страницу на устройстве пользователя.
 */
export default function ZoomGuard() {
  const probeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setProbe = (text: string) => {
      if (probeRef.current) probeRef.current.textContent = text;
    };

    const describe = (e: TouchEvent) => {
      const t = e.target as Element | null;
      const tag = t?.tagName ?? "?";
      const ta = t
        ? getComputedStyle(t).touchAction
        : "?";
      setProbe(
        `n=${e.touches.length} canc=${e.cancelable ? "Y" : "N"} ${tag} ta=${ta}`,
      );
    };

    // Тач-пинч (2+ пальца) на тачскрине
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        describe(e);
        if (e.cancelable) e.preventDefault();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        describe(e);
        if (e.cancelable) e.preventDefault();
      }
    };
    // Safari (iPad/Mac) использует отдельные gesture-события
    const onGesture = (e: Event) => {
      setProbe(`gesture ${e.type}`);
      e.preventDefault();
    };
    // Трекпад-пинч и Ctrl+колесо мыши приходят как wheel с ctrlKey
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        setProbe(`wheel ctrl canc=${e.cancelable ? "Y" : "N"}`);
        e.preventDefault();
      }
    };

    const opts = { passive: false } as const;
    document.addEventListener("touchstart", onTouchStart, opts);
    document.addEventListener("touchmove", onTouchMove, opts);
    document.addEventListener("gesturestart", onGesture, opts);
    document.addEventListener("gesturechange", onGesture, opts);
    document.addEventListener("gestureend", onGesture, opts);
    document.addEventListener("wheel", onWheel, opts);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("gestureend", onGesture);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ВРЕМЕННЫЙ диагностический зонд — читается глазами на устройстве.
  return (
    <div
      ref={probeRef}
      style={{
        position: "fixed",
        left: 4,
        bottom: 4,
        zIndex: 99999,
        background: "red",
        color: "white",
        font: "bold 11px monospace",
        padding: "2px 5px",
        borderRadius: 4,
        pointerEvents: "none",
        maxWidth: "95vw",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      ZG ready
    </div>
  );
}
