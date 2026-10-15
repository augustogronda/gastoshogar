"use client";

import React, { useState } from "react";
import { CategoryIcon, X, Check, Wallet, User } from "./ui/icons";
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
}

export function QuickExpenseModal({
  isOpen,
  onClose,
  periodId,
  users,
  categories,
}: QuickExpenseModalProps) {
  const [displayAmount, setDisplayAmount] = useState<string>("0");
  const [title, setTitle] = useState<string>("");
  const [selectedPayerId, setSelectedPayerId] = useState<string>(users[0]?.id || "");
  const [isFromPoolFund, setIsFromPoolFund] = useState<boolean>(false);
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

  const handleClear = () => {
    setDisplayAmount("0");
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
        isFromPoolFund,
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 pb-safe shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Cabecera del Sheet */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2.5" />
          <h2 className="text-lg font-semibold text-white pt-1">Nuevo Gasto</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-800/60 active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display del Monto (Grande tipo cajero) */}
        <div className="py-4 text-center">
          <span className="text-zinc-500 text-2xl font-light mr-1">$</span>
          <span className="text-4xl font-bold tracking-tight text-white">
            {formattedAmount}
          </span>
        </div>

        {/* Descripción rápida opcional */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="¿Qué compraron? (ej. Coto, Nafta, Delivery)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-base"
          />
        </div>

        {/* Selector de Pagador (Agus | Pareja | Fondo Común) */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-2">
            ¿QUIÉN PAGÓ?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {users.map((u) => {
              const isSelected = !isFromPoolFund && selectedPayerId === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setSelectedPayerId(u.id);
                    setIsFromPoolFund(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm font-medium transition active:scale-95 ${
                    isSelected
                      ? "bg-blue-600/20 border-blue-500 text-blue-400 shadow-sm"
                      : "bg-zinc-800/50 border-zinc-700/40 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="truncate">{u.name}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setIsFromPoolFund(true);
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-sm font-medium transition active:scale-95 ${
                isFromPoolFund
                  ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-sm"
                  : "bg-zinc-800/50 border-zinc-700/40 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span className="truncate">Fondo Común</span>
            </button>
          </div>
        </div>

        {/* Selector de Categorías (Chips con Scroll Horizontal) */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-2">
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition active:scale-95 ${
                    isSelected
                      ? "bg-zinc-100 text-zinc-950 border-zinc-100 shadow-md"
                      : "bg-zinc-800/60 text-zinc-300 border-zinc-700/40 hover:bg-zinc-800"
                  }`}
                >
                  <CategoryIcon name={cat.name} className="w-4 h-4" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Teclado Numérico Táctil Ergonómico (Thumb Zone para iPhone) */}
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
              className="h-13 bg-zinc-800/70 hover:bg-zinc-700/80 active:bg-zinc-700 rounded-2xl text-xl font-semibold text-white transition active:scale-95 flex items-center justify-center border border-zinc-700/30 shadow-sm"
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
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-98 transition"
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
