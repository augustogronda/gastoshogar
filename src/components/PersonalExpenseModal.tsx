"use client";

import React, { useState } from "react";
import { X, Plus, CategoryIcon, Calendar, Layers } from "./ui/icons";
import { addPersonalExpenseAction } from "@/app/actions";

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

interface PersonalExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  year: number;
  month: number;
  categories: Category[];
}

export function PersonalExpenseModal({
  isOpen,
  onClose,
  userId,
  userName,
  year,
  month,
  categories,
}: PersonalExpenseModalProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [totalInstallments, setTotalInstallments] = useState("3");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title || !parsedAmount || parsedAmount <= 0) {
      alert("Completá el título y un monto válido");
      return;
    }

    setIsSubmitting(true);
    try {
      await addPersonalExpenseAction({
        userId,
        year,
        month,
        title,
        amount: parsedAmount,
        categoryId: categoryId || undefined,
        date,
        installmentNumber: isInstallment ? parseInt(installmentNumber) : undefined,
        totalInstallments: isInstallment ? parseInt(totalInstallments) : undefined,
        notes: notes || undefined,
      });

      // Reset y cerrar
      setTitle("");
      setAmount("");
      setNotes("");
      setIsInstallment(false);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al registrar gasto personal");
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
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Gasto Personal
              </h2>
              <p className="text-xs text-zinc-400">Espacio privado de {userName}</p>
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
          {/* Monto principal */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              Monto ($)
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-3 pl-9 pr-4 text-white text-2xl font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner"
                autoFocus
              />
            </div>
          </div>

          {/* Título / Descripción */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              ¿En qué gastaste?
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Ropa, café, gym, juego, salida personal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-3 px-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Selector de Categoría */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-2">
              Categoría
            </label>
            <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto no-scrollbar p-1">
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? "bg-indigo-600/30 border-indigo-400 text-white shadow-md shadow-indigo-600/20"
                        : "bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-xl bg-white/[0.08] flex items-center justify-center mb-1">
                      <CategoryIcon name={cat.name} className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold truncate w-full">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fecha y Toggle Cuotas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-2.5 px-3 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => setIsInstallment(!isInstallment)}
                className={`w-full py-2.5 px-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  isInstallment
                    ? "bg-purple-600/30 border-purple-400/40 text-purple-200"
                    : "bg-white/[0.04] border-white/[0.1] text-zinc-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isInstallment ? "En Cuotas ✓" : "En Cuotas?"}</span>
              </button>
            </div>
          </div>

          {/* Campos de cuotas si está activo */}
          {isInstallment && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl animate-fade-in">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Cuota Nº
                </label>
                <input
                  type="number"
                  min="1"
                  value={installmentNumber}
                  onChange={(e) => setInstallmentNumber(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.1] rounded-xl py-2 px-3 text-white text-xs font-mono text-center"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Total Cuotas
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalInstallments}
                  onChange={(e) => setTotalInstallments(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.1] rounded-xl py-2 px-3 text-white text-xs font-mono text-center"
                />
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-indigo-400/20"
            >
              <span>{isSubmitting ? "Guardando..." : "Guardar Gasto Personal"}</span>
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
