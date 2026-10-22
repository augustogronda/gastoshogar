"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Trash2,
  Calendar,
  CategoryIcon,
  Check,
  User,
  Users,
  Repeat,
  Copy,
  Layers,
  Plus,
  AlertCircle,
  ChevronDown,
} from "./ui/icons";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { useToast, ToastBanner } from "./ui/ConfirmDialog";
import {
  updateExpenseAction,
  duplicateSharedToPersonalExpenseAction,
  deleteExpenseAction,
  updatePersonalExpenseAction,
  duplicatePersonalToSharedExpenseAction,
  markPersonalExpenseAsReviewedAction,
  togglePersonalExpenseReviewAction,
  deletePersonalExpenseAction,
} from "@/app/actions";
import {
  hasReviewFlag,
  getCleanNotes,
  getCardSourceTag,
  removeReviewFlag,
  addReviewFlag,
} from "@/lib/expense-review";
import { triggerHaptic } from "@/lib/haptics";

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

const EMPTY_USERS: HouseholdUserItem[] = [];

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
  onMoveExpense?: (expenseId: string) => Promise<void> | void;
  onCopyExpense?: (expenseId: string) => Promise<void> | void;
  onUpdateExpense?: (updated: EditableExpense) => void;
}

export function ExpenseDetailModal({
  isOpen,
  onClose,
  expense,
  users = EMPTY_USERS,
  categories,
  isPersonal = false,
  onDeleteExpense,
  onMoveExpense,
  onCopyExpense,
  onUpdateExpense,
}: ExpenseDetailModalProps) {
  const { toast, showToast } = useToast();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paidById, setPaidById] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMovingAcross, setIsMovingAcross] = useState(false);
  const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<
    | "delete"
    | "moveToShared"
    | "moveToPersonal"
    | "copyToShared"
    | "copyToPersonal"
    | "duplicateToShared"
    | "markReviewed"
    | null
  >(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [localCategories, setLocalCategories] = useState<CategoryItem[]>(categories);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const isReviewPending = isPersonal && hasReviewFlag(expense?.notes);
  const cardSource = getCardSourceTag(expense?.notes);

  useEffect(() => {
    if (expense && isOpen) {
      setTitle(expense.title || "");
      setAmount(expense.amount ? expense.amount.toString() : "");
      setCategoryId(expense.categoryId || expense.category?.id || categories[0]?.id || "");
      setPaidById(expense.paidById || expense.paidBy?.id || users[0]?.id || "");

      const d = expense.date ? new Date(expense.date) : new Date();
      setDate(d.toISOString().split("T")[0]);

      setNotes(getCleanNotes(expense.notes) || "");
      setPendingConfirm(null);
      setIsCategoryPickerOpen(false);
    }
    // Solo reinicializar el formulario al abrir el modal o cambiar de gasto (nunca en re-renders internos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense?.id, isOpen]);

  const initialDateStr = useMemo(() => {
    if (!expense?.date) return "";
    return new Date(expense.date).toISOString().split("T")[0];
  }, [expense?.date]);

  const initialCleanNotes = useMemo(() => getCleanNotes(expense?.notes) || "", [expense?.notes]);

  const hasChanges = useMemo(() => {
    if (!expense) return false;
    const initialCatId = expense.categoryId || expense.category?.id || categories[0]?.id || "";
    const initialPayerId = expense.paidById || expense.paidBy?.id || users[0]?.id || "";
    return (
      title.trim() !== (expense.title || "").trim() ||
      Number(amount) !== Number(expense.amount) ||
      categoryId !== initialCatId ||
      (!isPersonal && paidById !== initialPayerId) ||
      date !== initialDateStr ||
      notes.trim() !== initialCleanNotes.trim()
    );
  }, [
    expense,
    title,
    amount,
    categoryId,
    paidById,
    date,
    notes,
    isPersonal,
    categories,
    users,
    initialDateStr,
    initialCleanNotes,
  ]);

  if (!isOpen || !expense) return null;

  const selectedCategoryObj =
    localCategories.find((c) => c.id === categoryId) ||
    expense.category || { id: "", name: "Sin categoría", icon: null };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title || !parsedAmount || parsedAmount <= 0) {
      showToast("Completá el título y un monto válido.", "error");
      return;
    }

    triggerHaptic(15);
    setIsSubmitting(true);
    const selectedCategory =
      localCategories.find((c) => c.id === categoryId) || expense.category || null;
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

  const handleDuplicateToShared = async () => {
    triggerHaptic(10);
    if (pendingConfirm !== "duplicateToShared") {
      setPendingConfirm("duplicateToShared");
      return;
    }
    setPendingConfirm(null);
    setIsMovingAcross(true);

    const prevNotes = notes;
    const cleanNotes = removeReviewFlag(notes) || null;
    setNotes(cleanNotes || "");
    if (onUpdateExpense && expense) {
      onUpdateExpense({
        ...expense,
        notes: cleanNotes,
      });
    }

    onClose();
    showToast("✓ Gasto enviado a Fondo Compartido (Hogar)");
    try {
      await duplicatePersonalToSharedExpenseAction({
        personalExpenseId: expense.id,
        markAsReviewed: true,
      });
    } catch (err: unknown) {
      console.error(err);
      if (onUpdateExpense && expense) {
        onUpdateExpense({ ...expense, notes: prevNotes });
      }
      showToast(err instanceof Error ? err.message : "Error al enviar a compartidos", "error");
    } finally {
      setIsMovingAcross(false);
    }
  };

  const handleCopyToShared = async () => {
    triggerHaptic(10);
    if (pendingConfirm !== "copyToShared") {
      setPendingConfirm("copyToShared");
      return;
    }
    const targetId = expense.id;
    setPendingConfirm(null);
    setIsMovingAcross(true);
    onClose();

    if (onCopyExpense) {
      await onCopyExpense(targetId);
      setIsMovingAcross(false);
      return;
    }

    try {
      await duplicatePersonalToSharedExpenseAction({
        personalExpenseId: targetId,
        move: false,
      });
      showToast("✓ Gasto copiado a Fondo Compartido (Hogar)");
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al copiar a Hogar", "error");
    } finally {
      setIsMovingAcross(false);
    }
  };

  const handleCopyToPersonal = async () => {
    triggerHaptic(10);
    if (pendingConfirm !== "copyToPersonal") {
      setPendingConfirm("copyToPersonal");
      return;
    }
    const targetId = expense.id;
    setPendingConfirm(null);
    setIsMovingAcross(true);
    onClose();

    if (onCopyExpense) {
      await onCopyExpense(targetId);
      setIsMovingAcross(false);
      return;
    }

    try {
      await duplicateSharedToPersonalExpenseAction({
        expenseId: targetId,
        targetUserId: paidById || users[0]?.id,
        move: false,
      });
      showToast("✓ Gasto copiado a Gastos Personales");
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al copiar a personales", "error");
    } finally {
      setIsMovingAcross(false);
    }
  };

  const handleMoveToShared = async () => {
    triggerHaptic(10);
    if (pendingConfirm !== "moveToShared") {
      setPendingConfirm("moveToShared");
      return;
    }
    const targetId = expense.id;
    setPendingConfirm(null);
    setIsMovingAcross(true);
    onClose();

    if (onMoveExpense) {
      await onMoveExpense(targetId);
      setIsMovingAcross(false);
      return;
    }

    try {
      await duplicatePersonalToSharedExpenseAction({
        personalExpenseId: targetId,
        move: true,
      });
      showToast("✓ Gasto movido a Hogar");
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al mover a Hogar", "error");
    } finally {
      setIsMovingAcross(false);
    }
  };

  const handleMoveToPersonal = async () => {
    triggerHaptic(10);
    if (pendingConfirm !== "moveToPersonal") {
      setPendingConfirm("moveToPersonal");
      return;
    }
    const targetId = expense.id;
    setPendingConfirm(null);
    setIsMovingAcross(true);
    onClose();

    if (onMoveExpense) {
      await onMoveExpense(targetId);
      setIsMovingAcross(false);
      return;
    }

    try {
      await duplicateSharedToPersonalExpenseAction({
        expenseId: targetId,
        targetUserId: paidById || users[0]?.id,
        move: true,
      });
      showToast("✓ Gasto movido a Gastos Personales");
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al mover a personales", "error");
    } finally {
      setIsMovingAcross(false);
    }
  };

  const handleMarkAsReviewed = async () => {
    triggerHaptic(12);
    if (pendingConfirm !== "markReviewed") {
      setPendingConfirm("markReviewed");
      return;
    }
    setPendingConfirm(null);
    setIsMarkingReviewed(true);

    const prevNotes = notes;
    const cleanNotes = removeReviewFlag(notes) || null;
    setNotes(cleanNotes || "");
    if (onUpdateExpense && expense) {
      onUpdateExpense({
        ...expense,
        notes: cleanNotes,
      });
    }

    onClose();
    showToast("✓ Gasto confirmado como Personal");
    try {
      await markPersonalExpenseAsReviewedAction(expense.id);
    } catch (err: unknown) {
      console.error(err);
      if (onUpdateExpense && expense) {
        onUpdateExpense({ ...expense, notes: prevNotes });
      }
      showToast(err instanceof Error ? err.message : "Error al confirmar gasto", "error");
    } finally {
      setIsMarkingReviewed(false);
    }
  };

  const handleToggleReview = async () => {
    triggerHaptic(12);
    const currentlyMarked = hasReviewFlag(notes);
    const newNotes = currentlyMarked
      ? removeReviewFlag(notes) || null
      : addReviewFlag(notes);

    const prevNotes = notes;
    setNotes(newNotes || "");
    if (onUpdateExpense && expense) {
      onUpdateExpense({
        ...expense,
        notes: newNotes,
      });
    }

    showToast(
      !currentlyMarked
        ? "🔍 Marcado para revisar si es compartido"
        : "✓ Marca de revisión quitada"
    );

    try {
      await togglePersonalExpenseReviewAction(expense.id);
    } catch (err: unknown) {
      console.error(err);
      setNotes(prevNotes);
      if (onUpdateExpense && expense) {
        onUpdateExpense({ ...expense, notes: prevNotes });
      }
      showToast("Error al cambiar marca de revisión", "error");
    }
  };

  const handleDelete = async () => {
    triggerHaptic(15);
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
      onClick={() => {
        if (!isCategoryModalOpen) onClose();
      }}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-colors duration-150 ${
        isCategoryModalOpen
          ? "bg-transparent pointer-events-none"
          : "bg-black/45 backdrop-blur-sm animate-fade-in"
      }`}
    >
      <ToastBanner toast={toast} />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md apple-glass-sheet rounded-t-[30px] sm:rounded-[28px] px-5 pt-3 pb-6 flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar ${
          isCategoryModalOpen ? "hidden" : "animate-scale-up"
        }`}
      >
        {/* Grabber estilo iOS Sheet (sheets.md › Mobile) */}
        <div className="w-9 h-1 rounded-full bg-white/25 mx-auto mb-2.5 shrink-0" />

        {/* Barra de Navegación Superior del Sheet (Cerrar | Contexto | Guardar) */}
        <div className="flex items-center justify-between gap-2 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[32px] px-3 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-zinc-300 hover:text-white active:scale-95 transition flex items-center gap-1"
          >
            <span>Cerrar</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                isPersonal
                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-400/25"
                  : "bg-blue-500/15 text-blue-300 border-blue-400/25"
              }`}
            >
              {isPersonal ? "Personal" : "Hogar"}
            </span>

            {isPersonal && (
              <button
                type="button"
                onClick={handleToggleReview}
                disabled={isMarkingReviewed}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 transition active:scale-95 border ${
                  isReviewPending
                    ? "bg-amber-500/25 text-amber-200 border-amber-400/50"
                    : "bg-white/[0.05] text-zinc-400 hover:text-amber-200 border-white/[0.08]"
                }`}
                title={
                  isReviewPending
                    ? "Quitar marca de revisión"
                    : "Marcar para revisar si es compartido"
                }
              >
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span>{isReviewPending ? "Por revisar" : "Revisión"}</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            form="expense-detail-form"
            disabled={isSubmitting || isMovingAcross || isDeleting}
            className={`min-h-[32px] px-3.5 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${
              hasChanges
                ? isPersonal
                  ? "bg-[#5E5CE6] text-white shadow-md shadow-indigo-500/30"
                  : "bg-[#0A84FF] text-white shadow-md shadow-blue-500/30"
                : "bg-white/[0.07] text-zinc-300 hover:text-white"
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "..." : "Guardar"}</span>
          </button>
        </div>

        <form id="expense-detail-form" onSubmit={handleSave} className="space-y-3.5 mt-1">
          {/* Banner de Revisión Pendiente (Gasto de Tarjeta) */}
          {isReviewPending && (
            <div className="card-review-pending rounded-2xl p-3.5 space-y-2.5 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-amber-500/25 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold text-amber-200 uppercase tracking-wider truncate">
                      {cardSource ? `Tarjeta ${cardSource}` : "Resumen de Tarjeta"}
                    </span>
                    <span className="text-[10px] bg-amber-500/25 text-amber-200 px-2 py-0.5 rounded-full font-bold border border-amber-400/40 shrink-0">
                      Por revisar
                    </span>
                  </div>
                  <p className="text-xs text-amber-100/90 leading-snug mt-0.5">
                    ¿Corresponde también al fondo común del hogar?
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDuplicateToShared}
                  disabled={isSubmitting || isDeleting || isMovingAcross}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border ${
                    pendingConfirm === "duplicateToShared"
                      ? "bg-blue-600 text-white border-sky-300"
                      : "bg-blue-600/80 hover:bg-blue-500 text-white border-sky-400/40"
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
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border ${
                    pendingConfirm === "markReviewed"
                      ? "bg-emerald-600 text-white border-emerald-300 shadow-md"
                      : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40"
                  }`}
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {pendingConfirm === "markReviewed"
                      ? "¿Confirmar Personal?"
                      : "Solo Personal"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Cabecera Hero Tipo Apple Wallet (Monto + Concepto editables en el lugar) */}
          <div className="pt-2 pb-1 text-center flex flex-col items-center">
            <div className="inline-flex items-baseline justify-center gap-1 px-3 py-1 rounded-2xl hover:bg-white/[0.03] focus-within:bg-white/[0.05] focus-within:ring-1 focus-within:ring-white/15 transition">
              <span className="text-2xl font-bold font-mono text-zinc-400 select-none">$</span>
              <input
                type="number"
                step="any"
                required
                aria-label="Monto del gasto"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: `${Math.max(3, (amount || "0").length + 1)}ch` }}
                className="bg-transparent text-4xl font-extrabold text-white font-mono tabular-nums text-center focus:outline-none max-w-[240px]"
              />
            </div>

            <input
              type="text"
              required
              aria-label="Nombre o concepto del gasto"
              placeholder="Nombre del gasto..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full max-w-[300px] bg-transparent hover:bg-white/[0.03] focus:bg-white/[0.06] border border-transparent focus:border-white/[0.14] rounded-xl py-1.5 px-3 text-center text-[16px] font-semibold text-zinc-100 placeholder:text-zinc-500 focus:outline-none transition tracking-[-0.015em]"
            />

            {expense.totalInstallments && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[11px] font-semibold text-purple-200">
                <Layers className="w-3 h-3 text-purple-400 shrink-0" />
                <span>
                  Cuota <strong className="text-white">{expense.installmentNumber}</strong> de{" "}
                  <strong className="text-white">{expense.totalInstallments}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Lista Agrupada Estilo iOS (Inset Grouped List) */}
          <div className="super-card-subtle rounded-2xl divide-y divide-white/[0.07] overflow-hidden">
            {/* Fila 1: Categoría (Desplegable bajo demanda) */}
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-zinc-400">Categoría</span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(8);
                    setIsCategoryPickerOpen((prev) => !prev);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-semibold text-white transition active:scale-95"
                >
                  <CategoryIcon
                    name={selectedCategoryObj.name}
                    icon={selectedCategoryObj.icon}
                    className="w-3.5 h-3.5 text-blue-400"
                  />
                  <span>{selectedCategoryObj.name}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                      isCategoryPickerOpen ? "rotate-180 text-white" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Grilla de Categorías Desplegable (Progressive Disclosure) */}
              {isCategoryPickerOpen && (
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] animate-fade-in">
                  <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto no-scrollbar">
                    {localCategories.map((cat) => {
                      const isSelected = categoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic(10);
                            setCategoryId(cat.id);
                            setIsCategoryPickerOpen(false);
                          }}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all active:scale-95 ${
                            isSelected
                              ? "bg-blue-600/30 border-blue-400 text-white shadow-sm"
                              : "bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          <div className="w-6 h-6 rounded-lg bg-white/[0.07] flex items-center justify-center mb-1">
                            <CategoryIcon name={cat.name} icon={cat.icon} className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-semibold truncate w-full">
                            {cat.name}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setIsCategoryModalOpen(true);
                      }}
                      className="flex flex-col items-center justify-center p-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-zinc-300 hover:text-white hover:border-white/40 transition active:scale-95 text-center"
                    >
                      <div className="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center mb-1">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-semibold truncate w-full">Gestionar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fila 2: Pagador (solo en Hogar) */}
            {!isPersonal && users.length > 0 && (
              <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-zinc-400">Pagó</span>
                <div className="inline-flex p-0.5 rounded-xl bg-white/[0.05] border border-white/[0.08] gap-1">
                  {users.map((u) => {
                    const isSelected = paidById === u.id;
                    const isAugusto = u.name.toLowerCase().includes("augusto");
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic(10);
                          setPaidById(u.id);
                        }}
                        className={`px-3 py-1 rounded-[9px] text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
                          isSelected
                            ? isAugusto
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-rose-600 text-white shadow-sm"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: u.avatarColor }}
                        />
                        <span>{u.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fila 3: Fecha */}
            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-zinc-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>Fecha</span>
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white/[0.05] border border-white/[0.08] rounded-xl py-1 px-2.5 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Fila 4: Notas */}
            <div className="p-3">
              <textarea
                rows={notes.length > 45 ? 2 : 1}
                placeholder="Agregar nota o detalle (opcional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-transparent text-white text-xs placeholder:text-zinc-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Botón Guardar prominente cuando el usuario editó algún campo */}
          {hasChanges && (
            <button
              type="submit"
              disabled={isSubmitting || isMovingAcross || isDeleting}
              className={`w-full py-3 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all animate-fade-in ${
                isPersonal
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/30"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/30"
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Guardando..." : "Guardar Cambios"}</span>
            </button>
          )}

          {/* Barra de Acciones Secundarias en 3 Columnas (Copiar | Mover | Eliminar) */}
          <div className="grid grid-cols-3 gap-2 pt-0.5">
            {/* Botón 1: Copiar a otro espacio */}
            {isPersonal ? (
              <button
                type="button"
                onClick={handleCopyToShared}
                disabled={isSubmitting || isDeleting || isMovingAcross}
                className={`py-2.5 px-2 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1 transition active:scale-95 border ${
                  pendingConfirm === "copyToShared"
                    ? "bg-cyan-600 text-white border-cyan-300 shadow-md"
                    : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 border-cyan-400/25"
                }`}
                title="Copiar este gasto al fondo común del hogar manteniendo el personal"
              >
                <Copy className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {isMovingAcross
                    ? "Copiando..."
                    : pendingConfirm === "copyToShared"
                    ? "¿Confirmar?"
                    : "Copiar"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopyToPersonal}
                disabled={isSubmitting || isDeleting || isMovingAcross}
                className={`py-2.5 px-2 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1 transition active:scale-95 border ${
                  pendingConfirm === "copyToPersonal"
                    ? "bg-cyan-600 text-white border-cyan-300 shadow-md"
                    : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 border-cyan-400/25"
                }`}
                title="Copiar este gasto a tus gastos personales manteniendo el compartido"
              >
                <Copy className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {isMovingAcross
                    ? "Copiando..."
                    : pendingConfirm === "copyToPersonal"
                    ? "¿Confirmar?"
                    : "Copiar"}
                </span>
              </button>
            )}

            {/* Botón 2: Mover de espacio */}
            {isPersonal ? (
              <button
                type="button"
                onClick={handleMoveToShared}
                disabled={isSubmitting || isDeleting || isMovingAcross}
                className={`py-2.5 px-2 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1 transition active:scale-95 border ${
                  pendingConfirm === "moveToShared"
                    ? "bg-blue-600 text-white border-sky-300 shadow-md"
                    : "bg-blue-500/10 hover:bg-blue-500/20 text-sky-200 border-sky-400/25"
                }`}
                title="Mover este gasto al fondo común del hogar"
              >
                <Repeat className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">
                  {isMovingAcross
                    ? "Moviendo..."
                    : pendingConfirm === "moveToShared"
                    ? "¿Confirmar?"
                    : "Mover"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleMoveToPersonal}
                disabled={isSubmitting || isDeleting || isMovingAcross}
                className={`py-2.5 px-2 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1 transition active:scale-95 border ${
                  pendingConfirm === "moveToPersonal"
                    ? "bg-indigo-600 text-white border-indigo-300 shadow-md"
                    : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 border-indigo-400/25"
                }`}
                title="Mover este gasto a tus gastos personales"
              >
                <Repeat className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">
                  {isMovingAcross
                    ? "Moviendo..."
                    : pendingConfirm === "moveToPersonal"
                    ? "¿Confirmar?"
                    : "Mover"}
                </span>
              </button>
            )}

            {/* Botón 3: Eliminar */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting || isMovingAcross || isDeleting}
              className={`py-2.5 px-2 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1 transition active:scale-95 border ${
                pendingConfirm === "delete"
                  ? "bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-600/35"
                  : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/20"
              }`}
              title="Eliminar este gasto"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {isDeleting
                  ? "Borrando..."
                  : pendingConfirm === "delete"
                  ? "¿Borrar?"
                  : "Eliminar"}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Gestión de Categorías */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={localCategories}
        selectedCategoryId={categoryId}
        onCategoriesChange={setLocalCategories}
        onSelectCategory={(newCat) => {
          setLocalCategories((prev) => [
            newCat,
            ...prev.filter((c) => c.id !== newCat.id),
          ]);
          setCategoryId(newCat.id);
          setIsCategoryPickerOpen(false);
          setIsCategoryModalOpen(false);
        }}
      />
    </div>
  );
}
