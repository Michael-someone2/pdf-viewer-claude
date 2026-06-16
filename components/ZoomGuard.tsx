"use client";

import { useEffect } from "react";

/**
 * Глобально запрещает браузерный зум СТРАНИЦЫ вне области PDF.
 * Область PDF сама ставит touch-action: none и обрабатывает жесты в JS;
 * этот guard страхует остальную страницу (тулбары, сайдбар) и десктопные
 * способы зума.
 */
export default function ZoomGuard() {
  useEffect(() => {
    // Тач-пинч (2+ пальца)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
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
