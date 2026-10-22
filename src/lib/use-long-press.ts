"use client";

import { useRef, useCallback } from "react";
import { triggerHaptic } from "./haptics";

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick: () => void;
  thresholdMs?: number;
  moveTolerancePx?: number;
}

export function useLongPress({
  onLongPress,
  onClick,
  thresholdMs = 450,
  moveTolerancePx = 8,
}: UseLongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Solo botón primario (toque o clic izquierdo)
      if (e.button !== 0) return;

      // Si el toque proviene de un botón secundario u otro control interactivo, no activar long press ni clic de tarjeta
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, select, textarea, [data-no-card-click]")) {
        return;
      }

      isLongPressRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };

      clearTimer();
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        triggerHaptic(20);
        onLongPress();
      }, thresholdMs);
    },
    [onLongPress, thresholdMs, clearTimer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current) return;
      const distance = Math.hypot(
        e.clientX - startPosRef.current.x,
        e.clientY - startPosRef.current.y
      );

      // Si el dedo se movió más de la tolerancia (ej: scroll de la lista), cancelar de inmediato
      if (distance > moveTolerancePx) {
        clearTimer();
      }
    },
    [moveTolerancePx, clearTimer]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const hadTimer = timerRef.current !== null;
      clearTimer();
      startPosRef.current = null;

      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, select, textarea, [data-no-card-click]")) {
        isLongPressRef.current = false;
        return;
      }

      // Si no se alcanzó a disparar el long press, ejecutar el clic normal
      if (!isLongPressRef.current && hadTimer) {
        onClick();
      }
    },
    [onClick, clearTimer]
  );

  const handlePointerCancel = useCallback(() => {
    clearTimer();
    startPosRef.current = null;
    isLongPressRef.current = false;
  }, [clearTimer]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Prevenir el menú contextual nativo del navegador en long press
    e.preventDefault();
  }, []);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onPointerLeave: handlePointerCancel,
    onContextMenu: handleContextMenu,
  };
}
