import { useRef } from "react";
import type { DragPayload } from "./types";

const LONG_PRESS_MS = 400;
const MOVE_THRESHOLD = 10;

// Эмулирует drag-and-drop на тач-устройствах: удержание элемента
// дольше LONG_PRESS_MS запускает перетаскивание, обычный тап (или
// свайп для скролла) его не запускает.
export function useLongPressDrag(
  onStart: (payload: DragPayload, label: string, x: number, y: number) => void,
  payload: DragPayload,
  label: string,
  disabled: boolean,
) {
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    const t = e.touches[0];
    startPosRef.current = { x: t.clientX, y: t.clientY };
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      const pos = startPosRef.current;
      if (pos) onStart(payload, label, pos.x, pos.y);
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (timerRef.current === null || !startPosRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startPosRef.current.x;
    const dy = t.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD) clearTimer();
  };

  const onTouchEnd = () => clearTimer();

  const onClickCapture = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd, onClickCapture };
}
