"use client";

import React from "react";
import { Check, Clock, Calendar, AlertCircle } from "./ui/icons";
import { BANK_THEMES } from "@/lib/cards-service";

const SHORT_MONTHS_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

interface CreditCardVisualProps {
  bank: string;
  brand: string;
  lastDigits?: string | null;
  cardholderName: string;
  statementAmount: number;
  statementAmountUsd?: number;
  closingDate?: Date | string | null;
  dueDate?: Date | string | null;
  periodMonth?: number;
  isPaid: boolean;
  onEdit?: () => void;
  onTogglePaid?: () => void;
  isProcessing?: boolean;
}

export function CreditCardVisual({
  bank,
  brand,
  lastDigits,
  cardholderName,
  statementAmount,
  statementAmountUsd,
  closingDate,
  dueDate,
  periodMonth,
  isPaid,
  onEdit,
  onTogglePaid,
  isProcessing = false,
}: CreditCardVisualProps) {
  const bankTheme = BANK_THEMES[bank] || BANK_THEMES.Otro;
  const upperBrand = (brand || "VISA").toUpperCase();

  // Fechas formateadas sin desfasajes de huso horario
  const formatShortDate = (dateVal?: Date | string | null) => {
    if (!dateVal) return "--/--";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "--/--";
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  };

  const closingStr = formatShortDate(closingDate);
  const dueStr = formatShortDate(dueDate);

  // Detectar si vence en el mes siguiente al del resumen
  const dueDateObj = dueDate ? new Date(dueDate) : null;
  const closeDateObj = closingDate ? new Date(closingDate) : null;
  const dueMonthIdx =
    dueDateObj && !isNaN(dueDateObj.getTime()) ? dueDateObj.getUTCMonth() : null;
  const baseMonthIdx = periodMonth
    ? periodMonth - 1
    : closeDateObj && !isNaN(closeDateObj.getTime())
    ? closeDateObj.getUTCMonth()
    : null;

  const isDueNextMonth =
    dueMonthIdx !== null && baseMonthIdx !== null && dueMonthIdx !== baseMonthIdx;

  const dueMonthLabel = dueMonthIdx !== null ? SHORT_MONTHS_ES[dueMonthIdx] : "";

  // Calcular si está vencida (comparando fin del día de vencimiento)
  const isOverdue =
    !isPaid &&
    dueDateObj &&
    !isNaN(dueDateObj.getTime()) &&
    dueDateObj.getTime() + 12 * 3600 * 1000 < Date.now();

  return (
    <div className="relative group w-full select-none">
      {/* Tarjeta Visual de Crédito */}
      <div
        className={`w-full rounded-3xl p-5 bg-gradient-to-br ${bankTheme.gradient} text-white shadow-xl border border-white/[0.15] relative overflow-hidden transition-all duration-300 hover:scale-[1.01]`}
        style={{
          boxShadow: isPaid
            ? "0 12px 30px -8px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
            : "0 12px 30px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Glow & Patrones de fondo */}
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-white/[0.08] blur-2xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-44 h-44 rounded-full bg-black/40 blur-2xl pointer-events-none" />

        {/* Fila Superior: Banco + Logo de Marca */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight drop-shadow-md">
              {bank}
            </span>
            {upperBrand === "VISA" && bank !== "Mercado Pago" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/15 text-white/90 font-bold uppercase tracking-wider">
                Principal
              </span>
            )}
          </div>

          {/* Logo de Marca (VISA / MASTERCARD / AMEX) */}
          <div className="h-6 flex items-center">
            {upperBrand === "VISA" && (
              <span className="font-extrabold italic text-lg tracking-wider text-white drop-shadow">
                VISA
              </span>
            )}
            {upperBrand === "MASTERCARD" && (
              <div className="flex items-center -space-x-2">
                <span className="w-5 h-5 rounded-full bg-red-500/90 shadow-sm block" />
                <span className="w-5 h-5 rounded-full bg-amber-400/90 shadow-sm block" />
              </div>
            )}
            {upperBrand === "AMEX" && (
              <span className="px-2 py-0.5 rounded bg-blue-600 text-[10px] font-black tracking-tighter text-white border border-blue-400 shadow-sm">
                AMEX
              </span>
            )}
            {upperBrand !== "VISA" && upperBrand !== "MASTERCARD" && upperBrand !== "AMEX" && (
              <span className="text-xs font-bold font-mono tracking-wider">
                {upperBrand}
              </span>
            )}
          </div>
        </div>

        {/* Fila Central: Chip Dorado EMV + Contactless Waves + Estado */}
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2">
            {/* Chip EMV Dorado */}
            <div className="w-9 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-amber-400 to-yellow-600 border border-yellow-200/80 shadow-inner flex items-center justify-center p-0.5">
              <div className="w-full h-full border border-amber-600/40 rounded-sm grid grid-cols-2 grid-rows-2 opacity-60" />
            </div>

            {/* Ondas Contactless / NFC */}
            <svg
              className="w-5 h-5 text-white/70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M8.5 16.5a5 5 0 0 1 0-7" />
              <path d="M12 19a8.5 8.5 0 0 0 0-12" />
              <path d="M15.5 21.5a12 12 0 0 0 0-17" />
            </svg>
          </div>

          {/* Badge de Estado: Pagada / Vencida / Vence Próx. Mes / Pendiente */}
          <div>
            {isPaid ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 shadow-sm backdrop-blur-md">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>PAGADA</span>
              </span>
            ) : isOverdue ? (
              <span className="px-2.5 py-1 rounded-full bg-rose-500/40 text-rose-200 border border-rose-400/60 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 shadow-sm backdrop-blur-md animate-pulse">
                <AlertCircle className="w-3 h-3" />
                <span>VENCIDA</span>
              </span>
            ) : isDueNextMonth ? (
              <span className="px-2.5 py-1 rounded-full bg-purple-500/35 text-purple-100 border border-purple-300/50 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 shadow-sm backdrop-blur-md">
                <Calendar className="w-3 h-3 text-purple-200" />
                <span>VENCE EN {dueMonthLabel.toUpperCase()}</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-black/40 text-zinc-300 border border-white/20 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 shadow-sm backdrop-blur-md">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>PENDIENTE</span>
              </span>
            )}
          </div>
        </div>

        {/* Número de Tarjeta (Últimos 4 dígitos) */}
        <div className="mb-4 relative z-10">
          <span className="font-mono text-sm tracking-[0.25em] text-white/90 drop-shadow">
            •••• •••• •••• {lastDigits || "••••"}
          </span>
        </div>

        {/* Fila Inferior: Titular + Fechas (Cierre / Vence) */}
        <div className="flex items-end justify-between relative z-10 pt-1 border-t border-white/[0.12]">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-white/60 block">
              Titular
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-white truncate max-w-[130px] block">
              {cardholderName}
            </span>
          </div>

          {/* Fechas de Cierre y Vencimiento */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/60 block">
                Cierre
              </span>
              <span className="text-xs font-mono font-bold text-white/90">
                {closingStr}
              </span>
            </div>

            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/60 block">
                {isDueNextMonth ? `Vence (${dueMonthLabel})` : "Vence"}
              </span>
              <div className="flex items-center justify-end gap-1">
                <span
                  className={`text-xs font-mono font-bold ${
                    isOverdue
                      ? "text-rose-300 underline"
                      : isDueNextMonth
                      ? "text-purple-100"
                      : "text-white"
                  }`}
                >
                  {dueStr}
                </span>
                {isDueNextMonth && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/40 text-purple-100 font-bold border border-purple-300/40">
                    Próx. mes
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Franja de Resumen y Monto */}
        <div className="mt-3.5 pt-2.5 border-t border-white/[0.1] flex items-center justify-between relative z-10">
          <div>
            <span className="text-[10px] text-white/70 block font-medium">
              Resumen del Mes:
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black font-mono tracking-tight tabular-nums text-white">
                ${Math.round(statementAmount).toLocaleString("es-AR")}
              </span>
              {statementAmountUsd && statementAmountUsd > 0 ? (
                <span className="text-[11px] font-mono font-bold text-emerald-300">
                  +u$s {statementAmountUsd.toLocaleString("es-AR")}
                </span>
              ) : null}
            </div>
          </div>

          {/* Botones de acción rápida en la tarjeta */}
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-[11px] font-semibold text-white backdrop-blur-md transition border border-white/20"
              >
                Editar
              </button>
            )}

            {onTogglePaid && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePaid();
                }}
                disabled={isProcessing}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 shadow-md flex items-center gap-1 ${
                  isPaid
                    ? "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-white/20"
                    : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30"
                }`}
              >
                {isPaid ? (
                  <span>Desmarcar</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Pagar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
