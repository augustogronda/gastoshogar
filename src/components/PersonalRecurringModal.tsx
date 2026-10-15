"use client";

import React, { useState } from "react";
import { X, CreditCard, Repeat, CategoryIcon } from "./ui/icons";
import { createPersonalRecurringExpenseAction } from "@/app/actions";

interface Category {
  id: string;
  name: string;
}

interface PersonalRecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentYear: number;
  currentMonth: number;
  categories: Category[];
}

export function PersonalRecurringModal({
  isOpen,
  onClose,
  userId,
  userName,
  currentYear,
  currentMonth,
  categories,
}: PersonalRecurringModalProps) {
  const [title, setTitle] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [isInstallmentPlan, setIsInstallmentPlan] = useState(true);
  const [totalInstallments, setTotalInstallments] = useState("6");
  const [startYear, setStartYear] = useState(currentYear.toString());
  const [startMonth, setStartMonth] = useState(currentMonth.toString());
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(installmentAmount);
    if (!title || !amountVal || amountVal <= 0) {
      alert("Completá el título y el monto de la cuota mensual.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPersonalRecurringExpenseAction({
        userId,
        title,
        installmentAmount: amountVal,
        totalInstallments: isInstallmentPlan ? parseInt(totalInstallments) : null,
        startYear: parseInt(startYear),
        startMonth: parseInt(startMonth),
        categoryId: categoryId || undefined,
        notes: notes || undefined,
      });

      setTitle("");
      setInstallmentAmount("");
      setNotes("");
      onClose();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al guardar cuota personal");
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
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <CreditCard className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Nueva Cuota / Fijo Personal
              </h2>
              <p className="text-xs text-zinc-400">Para {userName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Tipo: Cuotas vs Recurrente Fijo */}
          <div className="grid grid-cols-2 gap-2 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setIsInstallmentPlan(true)}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                isInstallmentPlan
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Tarjeta en Cuotas</span>
            </button>
            <button
              type="button"
              onClick={() => setIsInstallmentPlan(false)}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                !isInstallmentPlan
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Suscripción / Fijo</span>
            </button>
          </div>

          {/* Título */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              Nombre o Descripción
            </label>
            <input
              type="text"
              required
              placeholder={isInstallmentPlan ? "Ej. Zapatillas Adidas 3 cuotas" : "Ej. Gimnasio Megatlon"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-3 px-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Monto de la cuota */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              Monto mensual por cuota ($)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xl font-bold">
                $
              </span>
              <input
                type="number"
                step="any"
                required
                placeholder="0"
                value={installmentAmount}
                onChange={(e) => setInstallmentAmount(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-3 pl-9 pr-4 text-white text-xl font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Cantidad de cuotas si aplica */}
          {isInstallmentPlan && (
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                Cantidad total de cuotas
              </label>
              <input
                type="number"
                min="1"
                required
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-2.5 px-4 text-white text-sm font-mono"
              />
            </div>
          )}

          {/* Mes de inicio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                Mes de inicio
              </label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-2.5 px-3 text-white text-xs"
              >
                {[
                  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
                ].map((m, idx) => (
                  <option key={idx + 1} value={idx + 1} className="bg-zinc-900 text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                Año
              </label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-2.5 px-3 text-white text-xs font-mono"
              />
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              Categoría
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-2.5 px-3 text-white text-xs"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botones */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-purple-400/20"
            >
              <span>{isSubmitting ? "Guardando..." : "Guardar Cuota Personal"}</span>
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
