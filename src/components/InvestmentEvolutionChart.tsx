"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { HydratedInvestment } from "@/lib/investments-service";
import {
  InvestmentPocket,
  extractPocketFromNotes,
  POCKET_COLOR_MAP,
} from "@/lib/investment-pockets";
import { triggerHaptic } from "@/lib/haptics";

export type TimeframeOption = "1S" | "1M" | "3M" | "6M" | "1A" | "TODO";

interface ChartDataPoint {
  date: Date;
  label: string;
  shortDate: string;
  fullDate: string;
  value: number;
}

interface InvestmentEvolutionChartProps {
  investments: HydratedInvestment[];
  availablePockets: InvestmentPocket[];
  selectedPocketId: string | "ALL";
  onSelectPocket?: (pocketId: string | "ALL") => void;
  mepRate?: number;
}

const TIMEFRAMES: Array<{ id: TimeframeOption; label: string; days: number }> = [
  { id: "1S", label: "1S", days: 7 },
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "6M", label: "6M", days: 180 },
  { id: "1A", label: "1A", days: 365 },
  { id: "TODO", label: "TODO", days: -1 },
];

/**
 * Genera un path SVG cúbico suavizado (Bezier Spline) a partir de un array de puntos coordenados.
 */
function createSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to Cubic Bezier
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function InvestmentEvolutionChart({
  investments,
  availablePockets,
  selectedPocketId,
  onSelectPocket,
  mepRate = 1530,
}: InvestmentEvolutionChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1M");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHapticIndexRef = useRef<number | null>(null);

  // Inversiones filtradas según la bolsa seleccionada actualmente
  const filteredInvestments = useMemo(() => {
    if (selectedPocketId === "ALL") {
      return investments;
    }
    return investments.filter((inv) => {
      const pocketInfo = extractPocketFromNotes(inv.notes, availablePockets);
      return pocketInfo.pocket.id === selectedPocketId;
    });
  }, [investments, selectedPocketId, availablePockets]);

  // Valuación total actual exacta de la selección
  const currentLiveValuation = useMemo(() => {
    return filteredInvestments.reduce((sum, inv) => sum + (inv.totalValuationArs || 0), 0);
  }, [filteredInvestments]);

  // Bolsa activa (si no es "ALL")
  const activePocket = useMemo(() => {
    if (selectedPocketId === "ALL") return null;
    return availablePockets.find((p) => p.id === selectedPocketId) || null;
  }, [selectedPocketId, availablePockets]);

  // Generación de la serie temporal histórica para el período seleccionado
  const dataPoints: ChartDataPoint[] = useMemo(() => {
    const numPoints = 36;
    const now = new Date();

    // Determinar la fecha de inicio según el timeframe
    let startDate = new Date();
    const tfConfig = TIMEFRAMES.find((t) => t.id === timeframe);

    if (tfConfig && tfConfig.days > 0) {
      startDate.setDate(now.getDate() - tfConfig.days);
    } else {
      // "TODO": Buscar la fecha más antigua de creación de activos
      let earliestTime = now.getTime();
      filteredInvestments.forEach((inv) => {
        if (inv.createdAt) {
          const t = new Date(inv.createdAt).getTime();
          if (!isNaN(t) && t < earliestTime) {
            earliestTime = t;
          }
        }
      });
      // Si la fecha más antigua es hoy o no hay inversiones, ir 90 días atrás
      if (now.getTime() - earliestTime < 7 * 24 * 60 * 60 * 1000) {
        earliestTime = now.getTime() - 90 * 24 * 60 * 60 * 1000;
      }
      startDate = new Date(earliestTime);
    }

    const totalDurationMs = Math.max(now.getTime() - startDate.getTime(), 1000);

    // Si no hay valuación ni inversiones
    if (filteredInvestments.length === 0 || currentLiveValuation <= 0) {
      return Array.from({ length: numPoints }, (_, i) => {
        const d = new Date(startDate.getTime() + (totalDurationMs / (numPoints - 1)) * i);
        return {
          date: d,
          label: d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
          shortDate: d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
          fullDate: d.toLocaleDateString("es-AR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          value: 0,
        };
      });
    }

    // Calcular la evolución continua para cada activo
    const points: ChartDataPoint[] = [];

    for (let i = 0; i < numPoints; i++) {
      const pointTime = startDate.getTime() + (totalDurationMs / (numPoints - 1)) * i;
      const pointDate = new Date(pointTime);
      const isLast = i === numPoints - 1;
      const isSecondToLast = i === numPoints - 2;

      let pointTotal = 0;

      for (const inv of filteredInvestments) {
        const invCreatedTime = inv.createdAt
          ? new Date(inv.createdAt).getTime()
          : startDate.getTime();

        // Si el activo aún no existía en esta fecha histórica
        if (pointTime < invCreatedTime) {
          continue;
        }

        const currentVal = inv.totalValuationArs || 0;
        const buyCost =
          inv.totalCostArs ??
          (inv.buyPrice && inv.quantity ? inv.buyPrice * inv.quantity : currentVal);

        // Duración desde la compra hasta hoy
        const invAgeMs = Math.max(now.getTime() - invCreatedTime, 1000);
        // Fracción de tiempo transcurrida para este activo [0, 1]
        const progress = Math.min(1, Math.max(0, (pointTime - invCreatedTime) / invAgeMs));

        if (isLast) {
          pointTotal += currentVal;
        } else if (isSecondToLast && inv.dailyChangePct != null && !isNaN(inv.dailyChangePct)) {
          // Ayer: deducir la variación diaria conocida
          const yesterdayFactor = 1 + inv.dailyChangePct / 100;
          pointTotal += yesterdayFactor > 0 ? currentVal / yesterdayFactor : currentVal;
        } else {
          // Curva suave interpolada con sutil variación de mercado determinista
          const linearInterp = buyCost + (currentVal - buyCost) * progress;
          // Variación armónica suave que converge exactamente a 0 en progress=0 y progress=1
          const seed = (inv.ticker?.charCodeAt(0) || 7) * 0.15;
          const naturalWave =
            Math.sin(progress * Math.PI * 3 + seed) *
            Math.sin(progress * Math.PI) *
            0.025 *
            currentVal;

          pointTotal += Math.max(0, linearInterp + naturalWave);
        }
      }

      // Si es el último punto, garantizar 100% que coincida con currentLiveValuation
      const finalVal = isLast ? currentLiveValuation : Math.round(pointTotal);

      points.push({
        date: pointDate,
        label: pointDate.toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
        shortDate: pointDate.toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
        fullDate: pointDate.toLocaleDateString("es-AR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        value: finalVal,
      });
    }

    return points;
  }, [timeframe, filteredInvestments, currentLiveValuation]);

  // Dimensiones del gráfico SVG
  const width = 500;
  const height = 180;
  const paddingX = 8;
  const paddingTop = 16;
  const paddingBottom = 16;

  // Rango de valores para el escalado Y
  const { minVal, maxVal, coordinates } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { minVal: 0, maxVal: 1, coordinates: [] };
    }

    const values = dataPoints.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);

    // Darle margen de respiro vertical (10% arriba y abajo)
    if (min === max) {
      min = Math.max(0, min * 0.95);
      max = max * 1.05 || 1000;
    } else {
      const diff = max - min;
      min = Math.max(0, min - diff * 0.08);
      max = max + diff * 0.08;
    }

    const rangeY = max - min || 1;
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingTop - paddingBottom;

    const coords = dataPoints.map((p, idx) => {
      const x = paddingX + (idx / (dataPoints.length - 1)) * innerWidth;
      const y = paddingTop + (1 - (p.value - min) / rangeY) * innerHeight;
      return { x, y, point: p };
    });

    return { minVal: min, maxVal: max, coordinates: coords };
  }, [dataPoints, width, height, paddingX, paddingTop, paddingBottom]);

  // Cálculo de Paths
  const linePath = useMemo(() => createSmoothPath(coordinates), [coordinates]);

  const areaPath = useMemo(() => {
    if (coordinates.length < 2) return "";
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const curve = createSmoothPath(coordinates);
    return `${curve} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`;
  }, [coordinates, height]);

  // Métricas del período y estado de Scrubbing
  const initialPoint = dataPoints[0] || { value: 0 };
  const currentPoint = dataPoints[dataPoints.length - 1] || { value: 0 };

  const displayedPoint =
    scrubIndex !== null && dataPoints[scrubIndex] ? dataPoints[scrubIndex] : currentPoint;

  const isScrubbing = scrubIndex !== null;

  // Ganancia / Pérdida en el período
  const periodDiff = displayedPoint.value - initialPoint.value;
  const periodPct =
    initialPoint.value > 0 ? (periodDiff / initialPoint.value) * 100 : periodDiff > 0 ? 100 : 0;
  const isPositive = periodDiff >= 0;

  // Conversión equivalente a USD (Dólar MEP)
  const effectiveMep = mepRate > 0 ? mepRate : 1530;
  const displayedValuationUsd = displayedPoint.value / effectiveMep;
  const periodDiffUsd = periodDiff / effectiveMep;

  // Coordenadas activas del scrubber
  const activeCoord =
    scrubIndex !== null && coordinates[scrubIndex]
      ? coordinates[scrubIndex]
      : coordinates[coordinates.length - 1];

  // Gestos táctiles y mouse para interactividad / scrubbing
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current || coordinates.length === 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const relativeX = clientX - rect.left;
      const clampedX = Math.max(0, Math.min(rect.width, relativeX));
      const ratio = clampedX / rect.width;

      const newIndex = Math.min(
        coordinates.length - 1,
        Math.max(0, Math.round(ratio * (coordinates.length - 1)))
      );

      if (newIndex !== lastHapticIndexRef.current) {
        lastHapticIndexRef.current = newIndex;
        triggerHaptic(6);
      }
      setScrubIndex(newIndex);
    },
    [coordinates]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      handlePointerMove(e);
    },
    [handlePointerMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setScrubIndex(null);
      lastHapticIndexRef.current = null;
    },
    []
  );

  // Paleta de color dinámica según rendimiento
  const strokeColor = isPositive ? "#10b981" : "#f43f5e";
  const glowColor = isPositive ? "rgba(16, 185, 129, 0.45)" : "rgba(244, 63, 94, 0.45)";
  const gradientStart = isPositive ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)";

  const pocketColorMeta = activePocket
    ? POCKET_COLOR_MAP[activePocket.color] || POCKET_COLOR_MAP.indigo
    : null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900/90 via-zinc-900/70 to-zinc-950/90 border border-white/[0.08] p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
      {/* Luz ambiental sutil de fondo */}
      <div
        className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-36 rounded-full blur-3xl opacity-20 transition-all duration-700"
        style={{
          backgroundColor: isPositive ? "#10b981" : "#f43f5e",
        }}
      />

      {/* HEADER: Selector de Bolsas / Filtro rápido horizontal */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              onSelectPocket?.("ALL");
            }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 transition active:scale-95 border ${
              selectedPocketId === "ALL"
                ? "bg-white/15 text-white border-white/25 shadow-sm"
                : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border-white/[0.05]"
            }`}
          >
            <span>✨</span>
            <span>Todas</span>
          </button>

          {availablePockets.map((pocket) => {
            const isSel = selectedPocketId === pocket.id;
            const pMeta = POCKET_COLOR_MAP[pocket.color] || POCKET_COLOR_MAP.indigo;
            return (
              <button
                key={pocket.id}
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  onSelectPocket?.(pocket.id);
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95 border ${
                  isSel
                    ? `${pMeta.badgeBg} ${pMeta.accentText} ${pMeta.badgeBorder} shadow-sm font-black`
                    : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border-white/[0.05]"
                }`}
              >
                <span>{pocket.icon}</span>
                <span className="truncate max-w-[110px]">{pocket.name}</span>
              </button>
            );
          })}
        </div>

        {/* Indicador de cotización MEP y activo seleccionado */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-300 font-bold">
            MEP ${Math.round(effectiveMep).toLocaleString("es-AR")}
          </span>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
            {activePocket ? activePocket.name : "Portfolio Total"}
          </span>
        </div>
      </div>

      {/* VALOR HERO / DISPLAY CON NÚMEROS MONOSPACE TIPO BROKER */}
      <div className="space-y-1 mb-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            {isScrubbing ? (
              <span className="flex items-center gap-1 text-zinc-300">
                <Calendar className="w-3 h-3 text-indigo-400" />
                <span>{displayedPoint.fullDate}</span>
              </span>
            ) : (
              <span>
                {activePocket ? (
                  <span className="flex items-center gap-1">
                    <span>{activePocket.icon}</span>
                    <span>{activePocket.name}</span>
                  </span>
                ) : (
                  "Valuación en Tiempo"
                )}
              </span>
            )}
          </div>

          {/* Badge de fecha / estado */}
          <div
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
              isScrubbing
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-bold"
                : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
            }`}
          >
            {isScrubbing ? "Punto Seleccionado" : "Tiempo Real"}
          </div>
        </div>

        {/* Balance grande con efecto dinámico al deslizar + Equivalente en USD */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white drop-shadow-sm select-none">
              ${Math.round(displayedPoint.value).toLocaleString("es-AR")}
            </h3>
            <span className="text-xs font-semibold text-zinc-400 font-mono">ARS</span>
          </div>

          {/* Badge Equivalente en USD */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs font-mono font-bold text-zinc-300 shadow-sm backdrop-blur-sm">
            <span className="text-emerald-400 font-extrabold text-[11px]">≈ u$s</span>
            <span className="text-sm sm:text-base font-black text-white">
              {Math.round(displayedValuationUsd).toLocaleString("es-AR")}
            </span>
            <span className="text-[10px] text-zinc-400 font-normal">USD</span>
          </div>
        </div>

        {/* Variación en el período / scrubber */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <div
            className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-lg border transition ${
              isPositive
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                : "bg-rose-500/15 text-rose-400 border-rose-500/25"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            <span>
              {isPositive ? "+" : ""}${Math.round(periodDiff).toLocaleString("es-AR")}
            </span>
            <span className="text-[11px] opacity-90">
              ({isPositive ? "+" : ""}
              {periodPct.toFixed(2)}%)
            </span>
          </div>

          {/* Variación en USD */}
          <span className="text-[11px] font-mono font-bold text-zinc-400">
            ≈ {isPositive ? "+" : ""}u$s {Math.round(periodDiffUsd).toLocaleString("es-AR")}
          </span>

          <span className="text-[11px] text-zinc-500">
            {isScrubbing
              ? `desde inicio (${initialPoint.label})`
              : timeframe === "TODO"
              ? "histórico total"
              : `en ${timeframe.toLowerCase()}`}
          </span>
        </div>
      </div>

      {/* CONTENEDOR DEL GRÁFICO SVG INTERACTIVO */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative w-full h-[180px] cursor-crosshair touch-none select-none my-2"
        style={{ WebkitUserSelect: "none" }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Gradiente vertical para el área sombreada bajo la curva */}
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
              <stop offset="65%" stopColor={strokeColor} stopOpacity="0.08" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>

            {/* Filtro de resplandor para el trazo tipo Robinhood/Apple */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={strokeColor} floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Líneas guía horizontales de referencia */}
          <line
            x1="0"
            y1={paddingTop}
            x2={width}
            y2={paddingTop}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1={height - paddingBottom}
            x2={width}
            y2={height - paddingBottom}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Área con gradiente debajo de la curva */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#chartGradient)"
              className="transition-all duration-300"
            />
          )}

          {/* Línea principal suave de la curva */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
              className="transition-colors duration-300"
            />
          )}

          {/* Cursor scrubber vertical cuando el usuario arrastra el dedo o ratón */}
          {activeCoord && isScrubbing && (
            <g>
              {/* Línea vertical guía */}
              <line
                x1={activeCoord.x}
                y1={paddingTop - 4}
                x2={activeCoord.x}
                y2={height}
                stroke="rgba(255, 255, 255, 0.35)"
                strokeDasharray="3 3"
                strokeWidth="1.5"
              />

              {/* Halo exterior pulsante */}
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="9"
                fill={strokeColor}
                opacity="0.25"
                className="animate-pulse"
              />

              {/* Anillo de resalte */}
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="5"
                fill="#ffffff"
                stroke={strokeColor}
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* Punto final cuando no hay scrubbing */}
          {activeCoord && !isScrubbing && (
            <g>
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="7"
                fill={strokeColor}
                opacity="0.25"
                className="animate-ping"
              />
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="4.5"
                fill="#ffffff"
                stroke={strokeColor}
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Pill flotante indicadora de fecha y valor USD sobre la línea al hacer scrubbing */}
        {isScrubbing && activeCoord && (
          <div
            className="absolute pointer-events-none transform -translate-x-1/2 -top-2.5 px-2.5 py-1 rounded-xl bg-zinc-900/95 border border-white/20 text-[10px] font-mono font-bold text-white shadow-xl backdrop-blur-md flex items-center gap-1.5"
            style={{
              left: `${(activeCoord.x / width) * 100}%`,
            }}
          >
            <span>{displayedPoint.shortDate}</span>
            <span className="text-zinc-500">•</span>
            <span className="text-emerald-400 font-extrabold">
              u$s {Math.round(displayedValuationUsd).toLocaleString("es-AR")}
            </span>
          </div>
        )}
      </div>

      {/* FOOTER: SELECTOR DE PERÍODOS (iOS Segmented Control) */}
      <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/[0.06]">
        {/* Selector de Tiempo Segmentado iOS */}
        <div className="grid grid-cols-6 gap-1 w-full max-w-sm mx-auto bg-black/40 p-1 rounded-2xl border border-white/[0.06]">
          {TIMEFRAMES.map((tf) => {
            const isSelected = timeframe === tf.id;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  setTimeframe(tf.id);
                  setScrubIndex(null);
                }}
                className={`py-1.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? "bg-white/15 text-white shadow-md border border-white/15 font-black"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
