"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, CategoryIcon, Check, Layers, AlertCircle } from "./ui/icons";
import { addPersonalExpenseAction } from "@/app/actions";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { addReviewFlag } from "@/lib/expense-review";
import { useSheetGesture } from "@/lib/use-sheet-gesture";
import { triggerHaptic } from "@/lib/haptics";

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  lastUsedAt?: Date | string | null;
}

interface PersonalExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  year: number;
  month: number;
  categories: Category[];
  onAddExpense?: (data: {
    userId: string;
    year: number;
    month: number;
    title: string;
    amount: number;
    categoryId?: string;
    date?: string;
    installmentNumber?: number;
    totalInstallments?: number;
    notes?: string;
  }) => void;
}

export function PersonalExpenseModal({
  isOpen,
  onClose,
  userId,
  userName,
  year,
  month,
  categories,
  onAddExpense,
}: PersonalExpenseModalProps) {
  const [displayAmount, setDisplayAmount] = useState<string>("0");
  const [title, setTitle] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories[0]?.id || ""
  );
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [totalInstallments, setTotalInstallments] = useState("3");
  const [markForReview, setMarkForReview] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const {
    scrollContainerRef,
    toggleDetent,
    sheetStyle,
    handleHeaderTouchStart,
    handleBodyTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSheetGesture({ onClose });

  if (!isOpen) return null;

  // Manejo del teclado numérico táctil (idéntico a Hogar)
  const handleNumClick = (val: string) => {
    triggerHaptic(10);
    if (displayAmount === "0") {
      setDisplayAmount(val);
    } else if (displayAmount.length < 9) {
      setDisplayAmount(displayAmount + val);
    }
  };

  const handleBackspace = () => {
    triggerHaptic(10);
    if (displayAmount.length <= 1) {
      setDisplayAmount("0");
    } else {
      setDisplayAmount(displayAmount.slice(0, -1));
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numericAmount = parseFloat(displayAmount);
    if (numericAmount <= 0) return;
    triggerHaptic(18);

    const finalTitle =
      title.trim() ||
      localCategories.find((c) => c.id === selectedCategoryId)?.name ||
      "Gasto Personal";

    const finalNotes = markForReview ? addReviewFlag(undefined) : undefined;

    const payload = {
      userId,
      year,
      month,
      title: finalTitle,
      amount: numericAmount,
      categoryId: selectedCategoryId || undefined,
      date: new Date().toISOString().split("T")[0],
      installmentNumber: isInstallment ? parseInt(installmentNumber) : undefined,
      totalInstallments: isInstallment ? parseInt(totalInstallments) : undefined,
      notes: finalNotes,
    };

    // 1. Limpiar inputs y cerrar modal DE INMEDIATO ("al toque", 0ms de latencia)
    setDisplayAmount("0");
    setTitle("");
    setIsInstallment(false);
    setMarkForReview(false);
    onClose();

    // 2. Disparar agregado optimista y conciliación en segundo plano
    if (onAddExpense) {
      onAddExpense(payload);
    } else {
      addPersonalExpenseAction(payload).catch((err) => {
        console.error("Error al guardar gasto personal:", err);
      });
    }
  };

  const formattedAmount = Number(displayAmount).toLocaleString("es-AR");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nuevo Gasto Personal"
      onClick={() => {
        if (!isCategoryModalOpen) onClose();
      }}
      className={`fixed inset-0 z-50 flex items-end justify-center transition-colors duration-150 ${
        isCategoryModalOpen
          ? "bg-transparent pointer-events-none"
          : "bg-black/45 backdrop-blur-sm animate-fade-in"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={sheetStyle}
        className={`w-full max-w-md apple-glass-sheet rounded-t-[32px] pt-2 px-5 pb-safe flex flex-col overflow-hidden ${
          isCategoryModalOpen ? "hidden" : ""
        }`}
      >
        {/* Cabecera del Sheet con Grabber iOS (Arrastrar para cerrar o tocar para cambiar tamaño) */}
        <div
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="pb-3 border-b border-white/[0.08] shrink-0 select-none touch-none cursor-grab active:cursor-grabbing"
        >
          <button
            type="button"
            onClick={toggleDetent}
            aria-label="Cambiar tamaño de pestaña"
            className="w-full py-1.5 flex justify-center focus:outline-none"
          >
            <span className="w-11 h-1.5 bg-white/30 hover:bg-white/50 rounded-full transition-colors" />
          </button>
          <div className="flex items-center justify-between pt-0.5">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Nuevo Gasto Personal
              </h2>
              <p className="text-[11px] text-indigo-300/90 font-medium">
                Espacio privado de {userName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cuerpo Scrollable Fluido con soporte de swipe-down al estar en el tope */}
        <div
          ref={scrollContainerRef}
          onTouchStart={handleBodyTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto overscroll-contain touch-pan-y no-scrollbar pt-2 pb-1"
        >
          {/* Display del Monto (Suizo Fintech / Monospace Tabular) */}
          <div className="py-3.5 text-center">
            <span className="text-zinc-400 text-2xl font-light mr-1">$</span>
            <span className="text-4xl font-extrabold tracking-tight text-white font-mono tabular-nums">
              {formattedAmount}
            </span>
          </div>

          {/* Descripción rápida con placeholder centrado y alto contraste */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="¿En qué gastaste? (ej. Café, Ropa, Gym, Salida)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="w-full bg-white/[0.06] border border-white/[0.14] rounded-2xl px-4 py-2.5 text-white text-center placeholder:text-center placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-400 transition text-sm font-medium shadow-inner"
            />
          </div>

          {/* Opciones rápidas compactas (En Cuotas / Por Revisar con Hogar) */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setIsInstallment(!isInstallment);
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border text-xs font-semibold transition active:scale-[0.97] ${
                isInstallment
                  ? "bg-purple-600/30 border-purple-400 text-purple-200 shadow-md ring-1 ring-purple-400/50"
                  : "bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isInstallment ? "En Cuotas ✓" : "¿En Cuotas?"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setMarkForReview(!markForReview);
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border text-xs font-semibold transition active:scale-[0.97] ${
                markForReview
                  ? "bg-amber-500/25 border-amber-400 text-amber-200 shadow-md ring-1 ring-amber-400/50"
                  : "bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08]"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>{markForReview ? "Por revisar ✓" : "¿Revisar Hogar?"}</span>
            </button>
          </div>

          {/* Selector de cuotas desplegable solo si se activa */}
          {isInstallment && (
            <div className="grid grid-cols-2 gap-3 p-3 mb-3 bg-white/[0.04] border border-purple-400/25 rounded-2xl animate-fade-in">
              <div>
                <label className="text-[10px] font-bold text-zinc-300 uppercase block mb-1 text-center">
                  Cuota Nº
                </label>
                <input
                  type="number"
                  min="1"
                  value={installmentNumber}
                  onChange={(e) => setInstallmentNumber(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.12] rounded-xl py-1.5 px-3 text-white text-xs font-mono text-center"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-300 uppercase block mb-1 text-center">
                  Total Cuotas
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalInstallments}
                  onChange={(e) => setTotalInstallments(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.12] rounded-xl py-1.5 px-3 text-white text-xs font-mono text-center"
                />
              </div>
            </div>
          )}

          {/* Selector de Categorías (Chips con Scroll Horizontal y botón + Nueva, igual que Hogar) */}
          <div className="mb-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                CATEGORÍA
              </label>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setIsCategoryModalOpen(true);
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 active:scale-95 transition"
              >
                <Plus className="w-3 h-3" />
                <span>Gestionar</span>
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto touch-pan-x no-scrollbar py-1">
              {/* Botón rápido "+ Nueva" al frente */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setIsCategoryModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border border-dashed border-white/20 bg-white/[0.03] text-zinc-300 hover:text-white hover:border-white/40 active:scale-95 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>+ Nueva</span>
              </button>

              {localCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setSelectedCategoryId(cat.id);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition active:scale-95 shrink-0 ${
                      isSelected
                        ? "bg-white text-zinc-950 border-white shadow-md font-bold"
                        : "bg-white/[0.05] text-zinc-200 border-white/[0.1] hover:bg-white/[0.1] hover:text-white"
                    }`}
                  >
                    <CategoryIcon name={cat.name} icon={cat.icon} className="w-3.5 h-3.5" />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Teclado Numérico Táctil Ergonómico (Idéntico a Hogar) */}
          <div className="grid grid-cols-3 gap-2 mb-3.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "C"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === "C") handleBackspace();
                  else if (key === "00") handleNumClick("00");
                  else handleNumClick(key);
                }}
                className="h-12 bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] rounded-2xl text-xl font-bold text-white transition active:scale-95 flex items-center justify-center border border-white/[0.1] shadow-sm font-mono"
              >
                {key === "C" ? "⌫" : key}
              </button>
            ))}
          </div>

          {/* Botón de Confirmación Grande */}
          <button
            type="button"
            disabled={displayAmount === "0"}
            onClick={() => handleSubmit()}
            className="w-full py-3.5 rounded-2xl apple-segment-active-personal hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-indigo-400/30"
          >
            <Check className="w-5 h-5" />
            <span>Guardar Gasto (${formattedAmount})</span>
          </button>
        </div>
      </div>

      {/* Modal de Gestión de Categorías */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={localCategories}
        selectedCategoryId={selectedCategoryId}
        onCategoriesChange={setLocalCategories}
        onSelectCategory={(newCat) => {
          setLocalCategories((prev) => [
            newCat,
            ...prev.filter((c) => c.id !== newCat.id),
          ]);
          setSelectedCategoryId(newCat.id);
          setIsCategoryModalOpen(false);
        }}
      />
    </div>
  );
}
