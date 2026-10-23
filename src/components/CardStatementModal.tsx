"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CreditCard, X, Check, Calendar, AlertCircle } from "./ui/icons";
import { updateCardStatementAction } from "@/app/actions";
import { triggerHaptic } from "@/lib/haptics";

interface CardStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardData: {
    id: string;
    bank: string;
    brand: string;
    lastDigits?: string | null;
    period: {
      id: string;
      year: number;
      month: number;
      statementAmount: number;
      statementAmountUsd?: number;
      closingDate?: Date | string | null;
      dueDate?: Date | string | null;
      notes?: string | null;
      isPaid: boolean;
    };
  } | null;
  onOptimisticSave?: (
    cardId: string,
    updatedFields: {
      statementAmount: number;
      statementAmountUsd: number;
      closingDate: string | null;
      dueDate: string | null;
      notes: string | null;
    }
  ) => void;
  onSaved?: () => void;
}

export function CardStatementModal({
  isOpen,
  onClose,
  cardData,
  onOptimisticSave,
  onSaved,
}: CardStatementModalProps) {
  const [statementAmount, setStatementAmount] = useState("");
  const [statementAmountUsd, setStatementAmountUsd] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (cardData) {
      setStatementAmount(
        cardData.period.statementAmount ? String(cardData.period.statementAmount) : ""
      );
      setStatementAmountUsd(
        cardData.period.statementAmountUsd ? String(cardData.period.statementAmountUsd) : ""
      );

      // Formatear fechas a YYYY-MM-DD para input date sin desfasajes de zona horaria
      const toIsoDate = (d?: Date | string | null) => {
        if (!d) return "";
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return "";
        const y = dateObj.getUTCFullYear();
        const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      setClosingDate(toIsoDate(cardData.period.closingDate));
      setDueDate(toIsoDate(cardData.period.dueDate));
      setNotes(cardData.period.notes || "");
      setErrorMsg(null);
    }
  }, [cardData, isOpen]);

  if (!isOpen || !cardData || !mounted) return null;

  // Verificar si el vencimiento seleccionado cae en el mes siguiente
  const isDueInFollowingMonth = (() => {
    if (!dueDate) return false;
    const parts = dueDate.split("-");
    if (parts.length !== 3) return false;
    const dueMonthNum = parseInt(parts[1], 10);
    return dueMonthNum !== cardData.period.month;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardData) return;

    setErrorMsg(null);
    const cleanAmount = parseFloat(statementAmount.replace(",", ".")) || 0;
    const cleanAmountUsd = parseFloat(statementAmountUsd.replace(",", ".")) || 0;

    // Convertir YYYY-MM-DD a ISO UTC mediodía para que la vista optimista sea inmediata y exacta
    const toMiddayIso = (val: string) => {
      if (!val) return null;
      const parts = val.split("-");
      if (parts.length === 3) {
        return new Date(
          Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
        ).toISOString();
      }
      return val;
    };

    // 1. Actualización optimista instantánea (0ms)
    triggerHaptic("success");
    if (onOptimisticSave) {
      onOptimisticSave(cardData.id, {
        statementAmount: cleanAmount,
        statementAmountUsd: cleanAmountUsd,
        closingDate: toMiddayIso(closingDate),
        dueDate: toMiddayIso(dueDate),
        notes: notes.trim() || null,
      });
    }

    // Cerrar modal de inmediato para máxima fluidez visual
    onClose();

    // 2. Persistir en segundo plano en el servidor
    try {
      await updateCardStatementAction({
        cardMonthlyPeriodId: cardData.period.id,
        statementAmount: cleanAmount,
        statementAmountUsd: cleanAmountUsd,
        closingDate: closingDate || null,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
      });
      if (onSaved) onSaved();
    } catch (err: unknown) {
      console.error("Error guardando resumen de tarjeta:", err);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      style={{ minHeight: "100vh", minWidth: "100vw" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          triggerHaptic(6);
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md super-card rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar border border-white/[0.12]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {cardData.bank} {cardData.brand}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Resumen del mes {cardData.period.month}/{cardData.period.year}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              onClose();
            }}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Montos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                Total a Pagar ($ ARS)
              </label>
              <input
                type="number"
                step="any"
                value={statementAmount}
                onChange={(e) => setStatementAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Consumos en USD (u$s)
              </label>
              <input
                type="number"
                step="any"
                value={statementAmountUsd}
                onChange={(e) => setStatementAmountUsd(e.target.value)}
                placeholder="0 (opcional)"
                className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Fechas de Cierre y Vencimiento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                Fecha de Cierre
              </label>
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                Fecha de Vencimiento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Indicador si vence el próximo mes */}
          {isDueInFollowingMonth && (
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0 text-purple-300" />
              <span>
                Esta tarjeta cierra este mes pero <strong>vence el próximo mes</strong>.
              </span>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Notas / Recordatorio (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Débito automático en cuenta, pagar el día 3..."
              className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {cardData.period.isPaid && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Esta tarjeta ya figura como pagada e imputada a los gastos del mes.</span>
            </div>
          )}

          {/* Botones de acción */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 active:scale-95 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-600/30 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Resumen</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
