"use client";

import React, { useState } from "react";
import { X, Sparkles, Wallet, Check } from "./ui/icons";
import { updatePersonalExtraIncomeAction } from "@/app/actions";
import { triggerHaptic } from "@/lib/haptics";

interface PersonalIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  year: number;
  month: number;
  monthName: string;
  hogarSalary: number;
  contributionPct: number;
  basePersonalSalary: number;
  currentExtraAmount: number;
  carriedOverPersonal: number;
  currentNotes?: string | null;
}

export function PersonalIncomeModal({
  isOpen,
  onClose,
  userId,
  userName,
  year,
  month,
  monthName,
  hogarSalary,
  contributionPct,
  basePersonalSalary,
  currentExtraAmount,
  carriedOverPersonal,
  currentNotes,
}: PersonalIncomeModalProps) {
  const [extraAmountInput, setExtraAmountInput] = useState<string>(
    currentExtraAmount ? currentExtraAmount.toString() : ""
  );
  const [notesInput, setNotesInput] = useState<string>(currentNotes || "");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const extraVal = parseFloat(extraAmountInput) || 0;
  const totalProjected = basePersonalSalary + extraVal + carriedOverPersonal;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updatePersonalExtraIncomeAction(
        userId,
        year,
        month,
        extraVal,
        notesInput
      );
      triggerHaptic("success");
      onClose();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al guardar ingreso personal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md super-card rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Ingreso Personal • {userName}
              </h2>
              <p className="text-xs text-zinc-400">
                {monthName} {year}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic(6);
              onClose();
            }}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Tarjeta de cálculo base desde el Hogar */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-medium">Sueldo Neto declarado en Hogar:</span>
              <span className="font-bold text-white font-mono tabular-nums">
                ${Math.round(hogarSalary).toLocaleString("es-AR")}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-medium">
                Aporte Fondo Hogar ({Math.round(contributionPct * 100)}%):
              </span>
              <span className="font-bold text-rose-300 font-mono tabular-nums">
                -${Math.round(hogarSalary * contributionPct).toLocaleString("es-AR")}
              </span>
            </div>

            <div className="border-t border-white/[0.08] pt-2 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-indigo-300">
                  Base {Math.max(0, Math.round((1 - contributionPct) * 100))}% para gastos personales:
                </span>
              </div>
              <span className="text-sm font-extrabold text-white font-mono tabular-nums">
                ${Math.round(basePersonalSalary).toLocaleString("es-AR")}
              </span>
            </div>

            {carriedOverPersonal > 0 && (
              <div className="flex justify-between items-center text-xs text-blue-300">
                <span>+ Remanente personal mes anterior:</span>
                <span className="font-bold font-mono tabular-nums">
                  +${Math.round(carriedOverPersonal).toLocaleString("es-AR")}
                </span>
              </div>
            )}
          </div>

          {/* Campo de Ingreso Extra / Bonos */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
              Ingresos Extra o Bonos ($)
            </label>
            <p className="text-[11px] text-zinc-400 mb-1">
              Bono laboral, aguinaldo, trabajos freelance, cobros extra personales.
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-base font-bold">
                $
              </span>
              <input
                type="number"
                placeholder="0"
                value={extraAmountInput}
                onChange={(e) => setExtraAmountInput(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-3 pl-8 pr-4 text-white text-lg font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner"
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
              Detalle / Motivo del extra (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Bono trimestral de la empresa"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-3 px-4 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Resumen Total Proyectado */}
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                Total Disponible Personal del Mes
              </span>
              <span className="text-xl font-extrabold text-white font-mono tabular-nums">
                ${Math.round(totalProjected).toLocaleString("es-AR")}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <Check className="w-5 h-5" />
            </div>
          </div>

          {/* Botones */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-indigo-400/20"
            >
              <span>{isSubmitting ? "Guardando..." : "Guardar Ingreso Personal"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 font-medium text-xs active:scale-[0.98] transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
