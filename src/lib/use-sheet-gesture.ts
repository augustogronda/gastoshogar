"use client";

import { useState, useRef, useCallback } from "react";

interface UseSheetGestureOptions {
  onClose: () => void;
  dismissThreshold?: number;
}

/**
 * Hook al estilo iOS Sheet (Apple HIG sheets.md):
 * - Permite arrastrar hacia abajo desde el grabber/cabecera (o desde el contenido cuando scrollTop === 0)
 *   para cerrar el modal con seguimiento en tiempo real del dedo.
 * - Permite tocar el grabber para alternar entre altura media (compact) y expandida (large detent).
 * - Permite cerrar tocando el fondo oscuro (backdrop).
 */
export function useSheetGesture({
  onClose,
  dismissThreshold = 85,
}: UseSheetGestureOptions) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [detent, setDetent] = useState<"large" | "medium">("large");

  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canDragSheetRef = useRef<boolean>(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, fromHeader = false) => {
      const touch = e.touches[0];
      if (!touch) return;

      const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
      // Permitir arrastrar el sheet si empezó en el grabber/header o si el scroll interno está arriba del todo
      if (fromHeader || scrollTop <= 2) {
        startYRef.current = touch.clientY;
        startTimeRef.current = Date.now();
        canDragSheetRef.current = true;
      } else {
        canDragSheetRef.current = false;
      }
    },
    []
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!canDragSheetRef.current || startYRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;

    const deltaY = touch.clientY - startYRef.current;
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;

    if (deltaY > 0 && scrollTop <= 2) {
      // Arrastrando hacia abajo para cambiar detent o cerrar
      setIsDragging(true);
      setDragY(deltaY);
    } else if (deltaY < -35 && detent === "medium") {
      // Arrastrando hacia arriba cuando está en detent medio -> expandir a large
      setDetent("large");
      setDragY(0);
      setIsDragging(false);
      startYRef.current = null;
    } else if (deltaY <= 0) {
      setDragY(0);
      setIsDragging(false);
    }
  }, [detent]);

  const handleTouchEnd = useCallback(() => {
    if (!canDragSheetRef.current || startYRef.current === null) {
      setIsDragging(false);
      setDragY(0);
      return;
    }

    const elapsed = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = dragY / elapsed; // px/ms

    // Si arrastró suficiente distancia o hizo un flick rápido hacia abajo
    if (dragY > dismissThreshold || (dragY > 35 && velocity > 0.55)) {
      setIsDragging(false);
      setDragY(0);
      startYRef.current = null;
      canDragSheetRef.current = false;
      onClose();
      return;
    }

    setIsDragging(false);
    setDragY(0);
    startYRef.current = null;
    canDragSheetRef.current = false;
  }, [dragY, dismissThreshold, onClose]);

  const toggleDetent = useCallback(() => {
    setDetent((prev) => (prev === "large" ? "medium" : "large"));
  }, []);

  const sheetStyle: React.CSSProperties = {
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
    transition: isDragging
      ? "none"
      : "transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), max-height 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
    maxHeight: detent === "large" ? "92dvh" : "70dvh",
  };

  return {
    scrollContainerRef,
    detent,
    toggleDetent,
    sheetStyle,
    handleHeaderTouchStart: (e: React.TouchEvent) => handleTouchStart(e, true),
    handleBodyTouchStart: (e: React.TouchEvent) => handleTouchStart(e, false),
    handleTouchMove,
    handleTouchEnd,
  };
}
