"use client";

import React, { useState } from "react";
import { CategoryIcon, X, Check, User } from "./ui/icons";
import { addExpenseAction } from "@/app/actions";

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

interface HouseholdUser {
  id: string;
  name: string;
  avatarColor: string;
}

interface QuickExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  users: HouseholdUser[];
  categories: Category[];
  defaultPayerId?: string;
}

export function QuickExpenseModal({
  isOpen,
  onClose,
  periodId,
  users,
  categories,
  defaultPayerId,
}: QuickExpenseModalProps) {
  const [displayAmount, setDisplayAmount] = useState<string>("0");
  const [title, setTitle] = useState<string>("");
  const [selectedPayerId, setSelectedPayerId] = useState<string>(
    defaultPayerId || users[0]?.id || ""
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories[0]?.id || ""
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  // Manejo del teclado numérico
  const handleNumClick = (val: string) => {
    if (displayAmount === "0") {
      setDisplayAmount(val);
    } else if (displayAmount.length < 9) {
      setDisplayAmount(displayAmount + val);
    }
  };

  const handleBackspace = () => {
    if (displayAmount.length <= 1) {
      setDisplayAmount("0");
    } else {
      setDisplayAmount(displayAmount.slice(0, -1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(displayAmount);
    if (numericAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await addExpenseAction({
        title: title.trim() || categories.find((c) => c.id === selectedCategoryId)?.name || "Gasto",
        amount: numericAmount,
        paidById: selectedPayerId,
        categoryId: selectedCategoryId,
        periodId,
        isFromPoolFund: false,
      });
      // Reset y cerrar
      setDisplayAmount("0");
      setTitle("");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al guardar el gasto");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedAmount = Number(displayAmount).toLocaleString("es-AR");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md super-card rounded-t-[32px] p-5 pb-safe shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar border-t border-white/[0.12]">
        {/* Cabecera del Sheet */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] relative">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-1" />
          <h2 className="text-base font-bold text-white pt-2 tracking-tight">Nuevo Gasto</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display del Monto (Suizo Fintech / Monospace Tabular) */}
        <div className="py-5 text-center">
          <span className="text-zinc-400 text-2xl font-light mr-1">$</span>
          <span className="text-4xl font-extrabold tracking-tight text-white font-mono tabular-nums">
            {formattedAmount}
          </span>
        </div>

        {/* Descripción rápida con placeholder centrado y alto contraste */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="¿Qué compraron? (ej. Coto, Nafta, Delivery)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/[0.14] rounded-2xl px-4 py-3 text-white text-center placeholder:text-center placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400 transition text-sm font-medium shadow-inner"
          />
        </div>

        {/* Selector de Pagador (Agus | Pareja) */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
            ¿QUIÉN PAGÓ DE SU BOLSILLO?
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {users.slice(0, 2).map((u, idx) => {
              const isSelected = selectedPayerId === u.id;
              const isFirst = idx === 0;

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedPayerId(u.id)}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border text-sm font-semibold transition active:scale-[0.97] ${
                    isSelected
                      ? isFirst
                        ? "bg-blue-600/30 border-blue-400 text-blue-200 shadow-md ring-1 ring-blue-400/60"
                        : "bg-rose-600/30 border-rose-400 text-rose-200 shadow-md ring-1 ring-rose-400/60"
                      : "bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08]"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="truncate">{u.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector de Categorías (Chips con Scroll Horizontal) */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
            CATEGORÍA
          </label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition active:scale-95 ${
                    isSelected
                      ? "bg-white text-zinc-950 border-white shadow-md font-bold"
                      : "bg-white/[0.05] text-zinc-200 border-white/[0.1] hover:bg-white/[0.1] hover:text-white"
                  }`}
                >
                  <CategoryIcon name={cat.name} className="w-3.5 h-3.5" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Teclado Numérico Táctil Ergonómico SuperDesign */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "C"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === "C") handleBackspace();
                else if (key === "00") handleNumClick("00");
                else handleNumClick(key);
              }}
              className="h-13 bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] rounded-2xl text-xl font-bold text-white transition active:scale-95 flex items-center justify-center border border-white/[0.1] shadow-sm font-mono"
            >
              {key === "C" ? "⌫" : key}
            </button>
          ))}
        </div>

        {/* Botón de Confirmación Grande */}
        <button
          type="button"
          disabled={displayAmount === "0" || isSubmitting}
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-blue-400/20"
        >
          {isSubmitting ? (
            <span>Guardando...</span>
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span>Guardar Gasto (${formattedAmount})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
