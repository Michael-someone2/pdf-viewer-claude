"use client";

import { useEffect } from "react";

/**
 * Глобально запрещает браузерный зум СТРАНИЦЫ всеми способами ввода.
 * Монтируется один раз в <body> и живёт всё время работы приложения.
 *
 * Почему именно так:
 * - touch-action в CSS ненадёжно гасит pinch-zoom визуального вьюпорта на
 *   Windows/Chrome, а user-scalable=no Chrome вообще игнорирует.
 * - Единственный надёжный способ — НЕпассивный слушатель на document, который
 *   вызывает preventDefault. {passive:false} заставляет Chrome ждать главный
 *   поток, поэтому зум реально отменяется (а не запускается на compositor'е).
 *
 * Зум PDF при этом НЕ ломается: PdfViewerPane читает те же touch-события и сам
 * считает масштаб — preventDefault отменяет только дефолтное действие браузера,
 * но не мешает нашим обработчикам отработать.
 */
export default function ZoomGuard() {
  useEffect(() => {
    // Тач-пинч (2+ пальца) на тачскрине
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    // Safari (iPad/Mac) использует отдельные gesture-события
    const onGesture = (e: Event) => e.preventDefault();
    // Трекпад-пинч и Ctrl+колесо мыши приходят как wheel с ctrlKey
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };

    const opts = { passive: false } as const;
    document.addEventListener("touchmove", onTouchMove, opts);
    document.addEventListener("gesturestart", onGesture, opts);
    document.addEventListener("gesturechange", onGesture, opts);
    document.addEventListener("gestureend", onGesture, opts);
    document.addEventListener("wheel", onWheel, opts);

    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("gestureend", onGesture);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);

  return null;
}
