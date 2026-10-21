"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Trash2,
  Copy,
  Calendar,
  CategoryIcon,
  Check,
  User,
  Users,
  Sparkles,
  Layers,
  Edit3,
  Plus,
  AlertCircle,
} from "./ui/icons";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { useToast, ToastBanner } from "./ui/ConfirmDialog";
import {
  updateExpenseAction,
  duplicateExpenseAction,
  duplicateSharedToPersonalExpenseAction,
  deleteExpenseAction,
  updatePersonalExpenseAction,
  duplicatePersonalExpenseAction,
  duplicatePersonalToSharedExpenseAction,
  markPersonalExpenseAsReviewedAction,
  togglePersonalExpenseReviewAction,
  deletePersonalExpenseAction,
} from "@/app/actions";
import {
  hasReviewFlag,
  getCleanNotes,
  getCardSourceTag,
} from "@/lib/expense-review";

export interface CategoryItem {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  lastUsedAt?: Date | string | null;
}

export interface HouseholdUserItem {
  id: string;
  name: string;
  avatarColor: string;
}

export interface EditableExpense {
  id: string;
  title: string;
  amount: number;
  date: Date | string;
  categoryId?: string | null;
  category?: CategoryItem | null;
  paidById?: string;
  paidBy?: { id: string; name: string };
  isFromPoolFund?: boolean;
  notes?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  isPersonal?: boolean;
}

interface ExpenseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: EditableExpense | null;
  users?: HouseholdUserItem[];
  categories: CategoryItem[];
  isPersonal?: boolean;
  onDeleteExpense?: (expenseId: string) => Promise<void> | void;
  onUpdateExpense?: (updated: EditableExpense) => void;
}

export function ExpenseDetailModal({
  isOpen,
  onClose,
  expense,
  users = [],
  categories,
  isPersonal = false,
  onDeleteExpense,
  onUpdateExpense,
}: ExpenseDetailModalProps) {
  const { toast, showToast } = useToast();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paidById, setPaidById] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDuplicatingAcross, setIsDuplicatingAcross] = useState(false);
  const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<
    "delete" | "duplicate" | "duplicateToShared" | "duplicateToPersonal" | null
  >(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const isReviewPending = isPersonal && hasReviewFlag(expense?.notes);
  const cardSource = getCardSourceTag(expense?.notes);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title || "");
      setAmount(expense.amount ? expense.amount.toString() : "");
      setCategoryId(expense.categoryId || expense.category?.id || categories[0]?.id || "");
      setPaidById(expense.paidById || expense.paidBy?.id || users[0]?.id || "");
      
      const d = expense.date ? new Date(expense.date) : new Date();
      setDate(d.toISOString().split("T")[0]);
      
      // Mostrar notas limpias en el textarea para una edición cómoda
      setNotes(getCleanNotes(expense.notes) || "");
      setPendingConfirm(null);
    }
  }, [expense, categories, users]);

  if (!isOpen || !expense) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title || !parsedAmount || parsedAmount <= 0) {
      showToast("Completá el título y un monto válido.", "error");
      return;
    }

    setIsSubmitting(true);
    const selectedCategory = categories.find((c) => c.id === categoryId) || expense.category || null;
    const selectedPayer = users.find((u) => u.id === paidById) || expense.paidBy;
    let finalNotesToSave = notes.trim() || undefined;
    if (isPersonal && isReviewPending) {
      const cardTag = cardSource ? `[Tarjeta ${cardSource}] ` : "";
      finalNotesToSave = `[POR_REVISAR] ${cardTag}${notes.trim()}`.trim();
    }

    onUpdateExpense?.({
      ...expense,
      title,
      amount: parsedAmount,
      categoryId: categoryId || undefined,
      category: selectedCategory,
      paidById: paidById || users[0]?.id,
      paidBy: selectedPayer ? { id: selectedPayer.id, name: selectedPayer.name } : expense.paidBy,
      date: date ? new Date(`${date}T12:00:00`).toISOString() : expense.date,
      notes: finalNotesToSave ?? null,
    });
    onClose();
    try {
      if (isPersonal) {
        await updatePersonalExpenseAction({
          id: expense.id,
          title,
          amount: parsedAmount,
          categoryId: categoryId || undefined,
          date,
          notes: finalNotesToSave,
        });
      } else {
        await updateExpenseAction({
          id: expense.id,
          title,
          amount: parsedAmount,
          paidById: paidById || users[0]?.id || "",
          categoryId: categoryId || categories[0]?.id || "",
          date,
          notes: notes || undefined,
          isFromPoolFund: expense.isFromPoolFund,
        });
      }
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al actualizar gasto", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = async () => {
    if (pendingConfirm !== "duplicate") {
      setPendingConfirm("duplicate");
      return;
    }
    setPendingConfirm(null);
    setIsDuplicating(true);
    onClose();
    try {
      if (isPersonal) {
        await duplicatePersonalExpenseAction(expense.id);
        showToast("✓ Copia creada en Gastos Personales");
      } else {
        await duplicateExpenseAction(expense.id);
        showToast("✓ Copia creada en Gastos Compartidos");
      }
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al duplicar gasto", "error");
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDuplicateToShared = async () => {
    if (pendingConfirm !== "duplicateToShared") {
      setPendingConfirm("duplicateToShared");
      return;
    }
    setPendingConfirm(null);
    setIsDuplicatingAcross(true);
    onClose();
    try {
      await duplicatePersonalToSharedExpenseAction({
        personalExpenseId: expense.id,
        markAsReviewed: true,
      });
      showToast("✓ Gasto duplicado en Fondo Compartido (Hogar)");
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al duplicar a compartidos", "error");
    } finally {
      setIsDuplicatingAcross(false);
    }
  };

  const handleDuplicateToPersonal = async () => {
    if (pendingConfirm !== "duplicateToPersonal") {
      setPendingConfirm("duplicateToPersonal");
      return;
    }
    setPendingConfirm(null);
    setIsDuplicatingAcross(true);
    onClose();
    try {
      await duplicateSharedToPersonalExpenseAction({
        expenseId: expense.id,
        targetUserId: paidById || users[0]?.id,
      });
      showToast("✓ Gasto duplicado en Gastos Personales");
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al duplicar a personales", "error");
    } finally {
      setIsDuplicatingAcross(false);
    }
  };

  const handleMarkAsReviewed = async () => {
    setIsMarkingReviewed(true);
    onClose();
    try {
      await markPersonalExpenseAsReviewedAction(expense.id);
      showToast("✓ Gasto confirmado como Personal");
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al confirmar gasto", "error");
    } finally {
      setIsMarkingReviewed(false);
    }
  };

  const handleToggleReview = async () => {
    setIsMarkingReviewed(true);
    onClose();
    try {
      const res = await togglePersonalExpenseReviewAction(expense.id);
      showToast(
        res.needsReview
          ? "🔍 Marcado para revisar si es compartido"
          : "✓ Marca de revisión quitada"
      );
    } catch (err: unknown) {
      console.error(err);
      showToast("Error al cambiar marca de revisión", "error");
    } finally {
      setIsMarkingReviewed(false);
    }
  };

  const handleDelete = async () => {
    if (pendingConfirm !== "delete") {
      setPendingConfirm("delete");
      return;
    }
    const targetId = expense.id;
    setPendingConfirm(null);
    setIsDeleting(true);
    onClose();

    if (onDeleteExpense) {
      await onDeleteExpense(targetId);
      setIsDeleting(false);
      return;
    }

    try {
      if (isPersonal) {
        await deletePersonalExpenseAction(targetId);
      } else {
        await deleteExpenseAction(targetId);
      }
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al eliminar gasto", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detalle del Gasto"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
    >
      <ToastBanner toast={toast} />
      <div className="w-full max-w-md apple-glass-sheet rounded-[28px] p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar animate-scale-up">
        {/* Grabber estilo iOS Sheet (sheets.md › Mobile) */}
        <div className="w-9 h-1 rounded-full bg-white/25 mx-auto mb-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-inner ${
                isPersonal
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/35"
                  : "bg-blue-500/20 text-blue-300 border border-blue-400/35"
              }`}
            >
              <Edit3 className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Detalle del Gasto
              </h2>
              <span
                className={`text-[10px] font-semibold block ${
                  isPersonal ? "text-indigo-300/90" : "text-blue-300/90"
                }`}
              >
                {isPersonal ? "Espacio Personal" : "Fondo Compartido Hogar"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isPersonal && (
              <button
                type="button"
                onClick={handleToggleReview}
                disabled={isMarkingReviewed}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all duration-200 active:scale-95 border ${
                  isReviewPending
                    ? "bg-amber-500/25 text-amber-200 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:bg-amber-500/35"
                    : "bg-white/[0.05] text-zinc-400 hover:text-amber-200 border-white/[0.1] hover:border-amber-500/35"
                }`}
                title={
                  isReviewPending
                    ? "Quitar marca de revisión"
                    : "Marcar para revisar si es compartido"
                }
              >
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span>{isReviewPending ? "Por revisar" : "Marcar revisión"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] active:scale-90 transition-all duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">

          {/* Banner de Revisión Pendiente (Gasto de Tarjeta) */}
          {isReviewPending && (
            <div className="card-review-pending rounded-2xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/25 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold text-amber-200 uppercase tracking-wider truncate">
                      {cardSource ? `Tarjeta ${cardSource}` : "Resumen de Tarjeta"}
                    </span>
                    <span className="text-[10px] bg-amber-500/25 text-amber-200 px-2 py-0.5 rounded-full font-bold border border-amber-400/40 shrink-0 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Revisión
                    </span>
                  </div>
                  <p className="text-xs text-amber-100/90 leading-relaxed mt-1">
                    ¿Este consumo también corresponde al fondo compartido del hogar?
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDuplicateToShared}
                  disabled={isSubmitting || isDuplicating || isDeleting || isDuplicatingAcross}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 border ${
                    pendingConfirm === "duplicateToShared"
                      ? "bg-blue-600 text-white border-sky-300 shadow-lg shadow-blue-600/40"
                      : "bg-gradient-to-r from-blue-600/80 to-sky-600/80 hover:from-blue-500 hover:to-sky-500 text-white border-sky-400/40 shadow-md shadow-blue-950/50"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    {pendingConfirm === "duplicateToShared"
                      ? "¿Confirmar envío?"
                      : "Duplicar a Hogar"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleMarkAsReviewed}
                  disabled={isMarkingReviewed || isSubmitting}
                  className="py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Solo Personal</span>
                </button>
              </div>
            </div>
          )}
          
          {/* Campo Monto Grande */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 text-center">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Monto del Gasto
            </label>
            <div className="relative inline-flex items-center justify-center">
              <span className="text-2xl font-bold font-mono text-zinc-400 mr-1">$</span>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-transparent text-3xl font-extrabold text-white font-mono tabular-nums text-center focus:outline-none w-44"
              />
            </div>
          </div>

          {/* Título o Concepto */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              Nombre / Concepto
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-3 px-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Selector de Pagador en Hogar (Augusto vs Agus) */}
          {!isPersonal && users.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                ¿Quién lo pagó?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {users.map((u) => {
                  const isSelected = paidById === u.id;
                  const isAugusto = u.name.toLowerCase().includes("augusto");

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setPaidById(u.id)}
                      className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        isSelected
                          ? isAugusto
                            ? "bg-blue-600/30 border-blue-400 text-blue-200 shadow-md shadow-blue-600/20"
                            : "bg-rose-600/30 border-rose-400 text-rose-200 shadow-md shadow-rose-600/20"
                          : "bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white"
                      }`}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: u.avatarColor }}
                      />
                      <span>Pagó {u.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selector de Categoría */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                Categoría
              </label>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 active:scale-95 transition"
              >
                <Plus className="w-3 h-3" />
                <span>Gestionar</span>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto no-scrollbar p-1">
              {/* Botón + Nueva */}
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex flex-col items-center justify-center p-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] text-zinc-400 hover:text-white hover:border-white/40 transition active:scale-95 text-center"
              >
                <div className="w-7 h-7 rounded-xl bg-white/[0.06] text-blue-400 flex items-center justify-center mb-1">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold truncate w-full text-zinc-300">
                  + Nueva
                </span>
              </button>

              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? "bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-600/20"
                        : "bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-xl bg-white/[0.08] flex items-center justify-center mb-1">
                      <CategoryIcon name={cat.name} icon={cat.icon} className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold truncate w-full">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Fecha del gasto
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-2.5 px-3 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notas / Descripción Enriquecida */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              Notas / Descripción Detallada
            </label>
            <textarea
              rows={3}
              placeholder="Ej. Asado del fin de semana, incluye cosas de limpieza para 2 meses..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl p-3 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none leading-relaxed"
            />
          </div>

          {/* Cuotas info si aplica */}
          {expense.totalInstallments && (
            <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-purple-200">
              <Layers className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                Este gasto forma parte de una compra en cuotas (Cuota{" "}
                <strong className="text-white">{expense.installmentNumber}</strong> de{" "}
                <strong className="text-white">{expense.totalInstallments}</strong>).
              </span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={isSubmitting || isDuplicating || isDeleting}
              className={`w-full py-3.5 rounded-2xl disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200 border-t border-white/25 ${
                isPersonal
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-600/30"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/30"
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Guardando cambios..." : "Guardar Cambios"}</span>
            </button>

            {/* Opción de Duplicar entre Espacios (Personal <-> Compartidos) */}
            {isPersonal ? (
              <button
                type="button"
                onClick={handleDuplicateToShared}
                disabled={isSubmitting || isDuplicating || isDeleting || isDuplicatingAcross}
                className={`w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-between transition-all duration-200 active:scale-[0.98] ${
                  pendingConfirm === "duplicateToShared"
                    ? "bg-blue-600 text-white border border-sky-300 shadow-lg shadow-blue-600/40 ring-2 ring-sky-400/30"
                    : "btn-hogar-gradient text-sky-100"
                }`}
                title="Copiar este gasto al fondo común del hogar"
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-sky-400/20 text-sky-300 flex items-center justify-center border border-sky-400/30">
                    <Users className="w-3.5 h-3.5" />
                  </span>
                  <span>
                    {isDuplicatingAcross
                      ? "Duplicando a Hogar..."
                      : pendingConfirm === "duplicateToShared"
                      ? "¿Confirmar envío a Compartidos?"
                      : "Duplicar en Gastos Compartidos"}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-200 border border-sky-400/30 text-[10px] font-extrabold tracking-wide">
                  Hogar
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDuplicateToPersonal}
                disabled={isSubmitting || isDuplicating || isDeleting || isDuplicatingAcross}
                className={`w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-between transition-all duration-200 active:scale-[0.98] ${
                  pendingConfirm === "duplicateToPersonal"
                    ? "bg-indigo-600 text-white border border-indigo-300 shadow-lg shadow-indigo-600/40 ring-2 ring-indigo-400/30"
                    : "btn-personal-gradient text-indigo-100"
                }`}
                title="Copiar este gasto a tus gastos personales"
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-400/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
                    <User className="w-3.5 h-3.5" />
                  </span>
                  <span>
                    {isDuplicatingAcross
                      ? "Duplicando a Personal..."
                      : pendingConfirm === "duplicateToPersonal"
                      ? "¿Confirmar envío a Personales?"
                      : "Duplicar en Gastos Personales"}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-200 border border-indigo-400/30 text-[10px] font-extrabold tracking-wide">
                  Personal
                </span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={isSubmitting || isDuplicating || isDeleting}
                className={`py-3 px-3 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] border ${
                  pendingConfirm === "duplicate"
                    ? "bg-zinc-700 text-white border-zinc-400 shadow-md"
                    : "bg-zinc-800/70 hover:bg-zinc-700/70 text-zinc-200 border-white/[0.1]"
                }`}
                title="Crear una copia exacta en este mismo listado"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  {isDuplicating
                    ? "Copiando..."
                    : pendingConfirm === "duplicate"
                    ? "¿Confirmar copia?"
                    : "Duplicar Copia"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting || isDuplicating || isDeleting}
                className={`py-3 px-3 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] border ${
                  pendingConfirm === "delete"
                    ? "bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-600/35"
                    : "bg-rose-500/12 hover:bg-rose-500/22 text-rose-300 border-rose-500/25"
                }`}
                title="Eliminar este gasto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isDeleting
                    ? "Eliminando..."
                    : pendingConfirm === "delete"
                    ? "¿Confirmar borrar?"
                    : "Eliminar"}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal de Gestión de Categorías */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onSelectCategory={(newCat) => {
          setCategoryId(newCat.id);
          setIsCategoryModalOpen(false);
        }}
      />
    </div>
  );
}
