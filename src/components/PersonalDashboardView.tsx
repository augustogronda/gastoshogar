"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Plus,
  Trash2,
  Settings,
  Sparkles,
  CreditCard,
  BarChart3,
  CategoryIcon,
  Layers,
  Lock,
  Unlock,
  Check,
  X,
  PieChart,
  Repeat,
  Tag,
  TrendingUp,
  Search,
  AlertCircle,
  Users,
  ChevronRight,
  Copy,
  CheckSquare,
  ArrowLeftRight,
} from "./ui/icons";
import { ConfirmDialog, ToastBanner, useToast } from "./ui/ConfirmDialog";
import { PersonalIncomeModal } from "./PersonalIncomeModal";
import { PersonalExpenseModal } from "./PersonalExpenseModal";
import { PersonalRecurringModal } from "./PersonalRecurringModal";
import { ExpenseDetailModal, EditableExpense } from "./ExpenseDetailModal";
import { ExpenseContextMenu, ContextMenuExpense } from "./ExpenseContextMenu";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { triggerHaptic } from "@/lib/haptics";
import { useLongPress } from "@/lib/use-long-press";
import { PersonalInvestmentsView } from "./PersonalInvestmentsView";
import { PersonalCardsView } from "./PersonalCardsView";
import { CardShoppingAdvisorBanner } from "./CardShoppingAdvisorBanner";
import {
  addPersonalExpenseAction,
  deletePersonalExpenseAction,
  deletePersonalRecurringExpenseAction,
  applyPersonalRecurringExpenseAction,
  unapplyPersonalRecurringExpenseAction,
  closePersonalMonthAction,
  reopenPersonalMonthAction,
  duplicatePersonalToSharedExpenseAction,
  markPersonalExpenseAsReviewedAction,
  markAllPersonalExpensesAsReviewedAction,
  batchDeleteExpensesAction,
  batchCopyExpensesAction,
  batchMoveExpensesAction,
} from "@/app/actions";
import {
  hasReviewFlag,
  getCleanNotes,
  getCardSourceTag,
  removeReviewFlag,
} from "@/lib/expense-review";

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

interface PersonalExpenseItem {
  id: string;
  title: string;
  amount: number;
  date: Date | string;
  categoryId?: string | null;
  category?: Category | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  personalRecurringId?: string | null;
  notes?: string | null;
}

interface PersonalRecurringItem {
  id: string;
  title: string;
  installmentAmount: number;
  totalInstallments?: number | null;
  startYear: number;
  startMonth: number;
  categoryId?: string | null;
  category?: Category | null;
  creditCardId?: string | null;
  creditCard?: {
    id: string;
    bank: string;
    brand: string;
  } | null;
  installmentNumber: number;
  isApplicableThisMonth: boolean;
  alreadyApplied: boolean;
  appliedExpenseId?: string;
}

interface PersonalDashboardViewProps {
  currentUser: { id: string; name: string; avatarColor: string };
  currentYear: number;
  currentMonth: number;
  monthName: string;
  categories: Category[];
  personalData: {
    incomeRecord: any;
    hogarSalary: number;
    contributionPct: number;
    personalRate: number;
    basePersonalSalary: number;
    extraIncome: number;
    carriedOverPersonal: number;
    totalPersonalAvailable: number;
    totalPersonalExpenses: number;
    remainingPersonalPool: number;
    personalBurnRatePct: number;
    expenses: PersonalExpenseItem[];
    recurringExpenses: PersonalRecurringItem[];
    investments?: any[];
    investmentsSummary?: any;
    cardsData?: any;
    isClosed: boolean;
  };
  activeTab?: "gastos" | "analisis" | "cuotas" | "tarjetas" | "inversiones";
  onTabChange?: (tab: "gastos" | "analisis" | "cuotas" | "tarjetas" | "inversiones") => void;
  externalMenuAction?: { type: "income" | "expense" | "closeOrReopen"; seq: number } | null;
  onResetExternalMenuAction?: () => void;
  onSyncPersonalExpenses?: (expenses: PersonalExpenseItem[]) => void;
}

const SHORT_MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"
];

interface PersonalExpenseRowProps {
  exp: any;
  deletingId: string | null;
  actioningId: string | null;
  onOpenDetail: (exp: any) => void;
  onLongPress: (exp: any) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  handleQuickDuplicateToShared: (id: string) => void;
  handleQuickMarkReviewed: (id: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function PersonalExpenseRow({
  exp,
  deletingId,
  actioningId,
  onOpenDetail,
  onLongPress,
  showToast,
  handleQuickDuplicateToShared,
  handleQuickMarkReviewed,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: PersonalExpenseRowProps) {
  const [confirmAction, setConfirmAction] = useState<"duplicate" | "reviewed" | null>(null);
  const confirmTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const dateObj = new Date(exp.date);
  const dateStr = `${dateObj.getDate()} ${SHORT_MONTHS[dateObj.getMonth()] || ""}`;
  const isPendingSync = exp.id.startsWith("temp-");
  const isReview = hasReviewFlag(exp.notes);
  const cardTag = getCardSourceTag(exp.notes);
  const cleanNotes = getCleanNotes(exp.notes);
  const isBusy = actioningId === exp.id || deletingId === exp.id;

  const handlePressDuplicate = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    if (confirmAction !== "duplicate") {
      triggerHaptic(10);
      setConfirmAction("duplicate");
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmAction(null), 4000);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmAction(null);
    triggerHaptic(15);
    handleQuickDuplicateToShared(exp.id);
  };

  const handlePressReviewed = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    triggerHaptic(15);
    handleQuickMarkReviewed(exp.id);
  };

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (isPendingSync) return;
      triggerHaptic(15);
      onLongPress(exp);
    },
    onClick: () => {
      if (isPendingSync) {
        showToast("Sincronizando gasto con la base de datos...", "info");
        return;
      }
      triggerHaptic(8);
      onOpenDetail(exp);
    },
  });

  const handleRowClick = () => {
    if (isSelectionMode) {
      triggerHaptic(8);
      onToggleSelect?.(exp.id);
    }
  };

  const handlers = isSelectionMode ? { onClick: handleRowClick } : longPressHandlers;

  return (
    <div
      {...handlers}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
      className={`rounded-2xl p-3.5 transition-all duration-200 cursor-pointer group select-none ${
        deletingId === exp.id
          ? "opacity-0 -translate-x-6 scale-95 pointer-events-none"
          : actioningId === exp.id
            ? "opacity-60 scale-[0.99] pointer-events-none"
            : "opacity-100 hover:-translate-y-[1px]"
      } ${
        isSelectionMode && isSelected
          ? "ring-2 ring-indigo-500/70 bg-indigo-500/[0.12] border-indigo-500/40"
          : isReview
            ? "card-review-pending"
            : "super-card-subtle hover:bg-white/[0.05] hover:border-white/[0.14]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {isSelectionMode && (
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                isSelected
                  ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-500/40 scale-105"
                  : "border-white/30 bg-white/[0.04] hover:border-white/50"
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          )}
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105 ${
              isReview
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-950/40"
                : "bg-zinc-800/80 border-white/[0.08] text-zinc-300"
            }`}
          >
            {isReview ? (
              <AlertCircle className="w-5 h-5 text-amber-400" />
            ) : (
              <CategoryIcon name={exp.category?.name || "Varios"} className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-white block group-hover:text-indigo-300 transition-colors truncate tracking-[-0.015em]">
                {exp.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-400 font-medium min-w-0">
              <span className="shrink-0">{dateStr}</span>
              {exp.category && (
                <>
                  <span className="shrink-0">•</span>
                  <span className="text-zinc-300 font-sans truncate">
                    {exp.category.name}
                  </span>
                </>
              )}
              {exp.totalInstallments && (
                <>
                  <span className="shrink-0">•</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30 text-[10px] font-bold shrink-0">
                    Cuota {exp.installmentNumber}/{exp.totalInstallments}
                  </span>
                </>
              )}
              {isReview && (
                <>
                  <span className="shrink-0">•</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/35 text-[10px] font-bold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>Por revisar</span>
                    {cardTag && <span className="opacity-85 font-mono">({cardTag})</span>}
                  </span>
                </>
              )}
              {isPendingSync && (
                <span className="text-[10px] text-amber-300 font-medium animate-pulse flex items-center gap-1 ml-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-ping" />
                  Sincronizando...
                </span>
              )}
            </div>
            {cleanNotes && (
              <p className="text-[11px] text-zinc-400 italic mt-1 line-clamp-1 flex items-center gap-1">
                <span>💬</span>
                <span>{cleanNotes}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-[15px] font-bold text-white font-mono tabular-nums tracking-[-0.02em]">
            ${Math.round(exp.amount).toLocaleString("es-AR")}
          </span>
          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        </div>
      </div>

      {/* Barra inferior de acciones rápidas cuando el gasto está marcado para revisar con confirmación elegante */}
      {isReview && !isPendingSync && !isSelectionMode && (
        <div
          className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {confirmAction === "duplicate" ? (
            <div className="flex-1 flex items-center gap-1.5 animate-fade-in">
              <button
                type="button"
                disabled={isBusy}
                onClick={handlePressDuplicate}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className="flex-1 min-h-[38px] py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white border border-blue-400 shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
              >
                <Users className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="truncate">¿Confirmar Duplicar?</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmAction(null);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className="min-h-[38px] px-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-zinc-300 text-xs transition"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              onClick={handlePressDuplicate}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="flex-1 min-h-[38px] py-2 px-3 rounded-xl btn-hogar-gradient font-semibold text-xs tracking-[-0.01em] text-blue-100 flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98]"
            >
              <Users className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="truncate">Duplicar a Hogar</span>
            </button>
          )}

          <button
            type="button"
            disabled={isBusy}
            onClick={handlePressReviewed}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="flex-1 min-h-[38px] py-2 px-3 rounded-xl bg-[#30D158]/20 hover:bg-[#30D158]/35 text-emerald-100 border border-[#30D158]/45 hover:border-[#30D158]/70 font-bold text-xs tracking-[-0.01em] flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] shadow-sm"
          >
            <Check className="w-3.5 h-3.5 text-[#30D158] shrink-0" />
            <span className="truncate">Confirmar Personal</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function PersonalDashboardView({
  currentUser,
  currentYear,
  currentMonth,
  monthName,
  categories,
  personalData,
  activeTab = "gastos",
  onTabChange,
  externalMenuAction,
  onResetExternalMenuAction,
  onSyncPersonalExpenses,
}: PersonalDashboardViewProps) {
  const personalTab = activeTab;
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [personalCategoryFilter, setPersonalCategoryFilter] = useState<string>("ALL");
  const [personalSearchQuery, setPersonalSearchQuery] = useState<string>("");
  const [onlyPendingReview, setOnlyPendingReview] = useState(false);
  const [isBatchConfirming, setIsBatchConfirming] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedPersonalExpense, setSelectedPersonalExpense] = useState<EditableExpense | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [contextMenuExpense, setContextMenuExpense] = useState<ContextMenuExpense | null>(null);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const lastProcessedSeqRef = React.useRef<number | null>(null);
  const [confirmState, setConfirmState] = useState<{
    type: "deleteExpense" | "deleteRecurring" | "reopenMonth";
    id?: string;
    title?: string;
  } | null>(null);

  // Modo Selección Múltiple (Personal)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);

  const {
    personalRate = 0.40,
    basePersonalSalary,
    extraIncome,
    carriedOverPersonal,
    totalPersonalAvailable,
    totalPersonalExpenses: initialTotalPersonalExpenses,
    remainingPersonalPool: initialRemainingPersonalPool,
    personalBurnRatePct: initialPersonalBurnRatePct,
    expenses: serverExpenses,
    recurringExpenses,
    investments = [],
    investmentsSummary = null,
    cardsData = null,
    isClosed,
  } = personalData;

  const [localExpenses, setLocalExpenses] = useState<PersonalExpenseItem[]>(serverExpenses || []);

  useEffect(() => {
    if (serverExpenses) {
      setLocalExpenses(serverExpenses);
    }
  }, [serverExpenses]);

  const totalPersonalExpenses = localExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingPersonalPool = Math.max(0, totalPersonalAvailable - totalPersonalExpenses);
  const personalBurnRatePct = totalPersonalAvailable > 0 ? (totalPersonalExpenses / totalPersonalAvailable) * 100 : 0;

  const burnColor =
    personalBurnRatePct > 90
      ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]"
      : personalBurnRatePct > 70
      ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
      : "bg-indigo-500 shadow-[0_0_12px_rgba(99,91,255,0.5)]";

  const nextMonthNum = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  const handleDeleteExpense = (id: string, expTitle?: string) => {
    setConfirmState({ type: "deleteExpense", id, title: expTitle });
  };

  const handleExecuteConfirm = async () => {
    if (!confirmState) return;
    const current = confirmState;
    setConfirmState(null);

    if (current.type === "deleteExpense" && current.id) {
      const id = current.id;
      setDeletingId(id);
      const previousList = [...localExpenses];
      const updatedList = localExpenses.filter((e) => e.id !== id);

      // 1. IMPACTO INMEDIATO EN UI (0ms de latencia)
      setLocalExpenses(updatedList);
      onSyncPersonalExpenses?.(updatedList);
      showToast("✓ Gasto personal eliminado");

      // 2. Persistencia en segundo plano en la base de datos
      try {
        await deletePersonalExpenseAction(id);
      } catch (err) {
        setLocalExpenses(previousList);
        onSyncPersonalExpenses?.(previousList);
        showToast("Error al eliminar gasto", "error");
      } finally {
        setDeletingId(null);
      }
    } else if (current.type === "deleteRecurring" && current.id) {
      setIsProcessing(true);
      try {
        await deletePersonalRecurringExpenseAction(current.id);
        showToast("✓ Cuota / fijo eliminado");
      } catch (err) {
        showToast("Error al eliminar cuota", "error");
      } finally {
        setIsProcessing(false);
      }
    } else if (current.type === "reopenMonth") {
      setIsProcessing(true);
      try {
        await reopenPersonalMonthAction(currentUser.id, currentYear, currentMonth);
        showToast("✓ Mes personal reabierto");
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Error al reabrir", "error");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const [actioningId, setActioningId] = useState<string | null>(null);

  const pendingReviewExpenses = useMemo(
    () => localExpenses.filter((e) => hasReviewFlag(e.notes)),
    [localExpenses]
  );
  const pendingReviewCount = pendingReviewExpenses.length;

  const handleQuickDuplicateToShared = async (expId: string) => {
    if (actioningId === expId) return;
    setActioningId(expId);
    const prevExpenses = [...localExpenses];
    const updated = localExpenses.map((e) =>
      e.id === expId ? { ...e, notes: removeReviewFlag(e.notes) || null } : e
    );
    setLocalExpenses(updated);
    onSyncPersonalExpenses?.(updated);
    showToast("✓ Duplicado en Fondo Compartido (Hogar)");
    try {
      await duplicatePersonalToSharedExpenseAction({ personalExpenseId: expId, markAsReviewed: true });
    } catch (err: unknown) {
      console.error(err);
      setLocalExpenses(prevExpenses);
      onSyncPersonalExpenses?.(prevExpenses);
      showToast(err instanceof Error ? err.message : "Error al duplicar a compartidos", "error");
    } finally {
      setActioningId(null);
    }
  };

  const handleQuickMarkReviewed = async (expId: string) => {
    if (actioningId === expId) return;
    setActioningId(expId);
    const prevExpenses = [...localExpenses];
    const updated = localExpenses.map((e) =>
      e.id === expId ? { ...e, notes: removeReviewFlag(e.notes) || null } : e
    );
    setLocalExpenses(updated);
    onSyncPersonalExpenses?.(updated);
    showToast("✓ Gasto confirmado como Personal");
    try {
      await markPersonalExpenseAsReviewedAction(expId);
    } catch (err: unknown) {
      console.error(err);
      setLocalExpenses(prevExpenses);
      onSyncPersonalExpenses?.(prevExpenses);
      showToast(err instanceof Error ? err.message : "Error al confirmar gasto", "error");
    } finally {
      setActioningId(null);
    }
  };

  const handleConfirmAllReviewed = async () => {
    if (isBatchConfirming || pendingReviewCount === 0) return;
    triggerHaptic(15);
    setIsBatchConfirming(true);

    const prevExpenses = [...localExpenses];
    const updated = localExpenses.map((e) =>
      hasReviewFlag(e.notes) ? { ...e, notes: removeReviewFlag(e.notes) || null } : e
    );

    setLocalExpenses(updated);
    onSyncPersonalExpenses?.(updated);
    showToast(`✓ ${pendingReviewCount} gastos confirmados como personales`);

    try {
      await markAllPersonalExpensesAsReviewedAction({
        userId: currentUser.id,
        year: currentYear,
        month: currentMonth,
      });
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      setLocalExpenses(prevExpenses);
      onSyncPersonalExpenses?.(prevExpenses);
      showToast(err instanceof Error ? err.message : "Error al confirmar gastos", "error");
    } finally {
      setIsBatchConfirming(false);
    }
  };

  const handleDeletePersonalExpense = async (id: string) => {
    const previousList = [...localExpenses];
    const updatedList = localExpenses.filter((e) => e.id !== id);
    setDeletingId(id);
    setLocalExpenses(updatedList);
    onSyncPersonalExpenses?.(updatedList);
    showToast("✓ Gasto personal eliminado");
    try {
      await deletePersonalExpenseAction(id);
    } catch (err) {
      setLocalExpenses(previousList);
      onSyncPersonalExpenses?.(previousList);
      showToast("Error al eliminar gasto", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleMovePersonalExpenseToHogar = async (id: string) => {
    const previousList = [...localExpenses];
    const updatedList = localExpenses.filter((e) => e.id !== id);
    setDeletingId(id);
    setLocalExpenses(updatedList);
    onSyncPersonalExpenses?.(updatedList);
    showToast("✓ Gasto movido a Hogar");
    try {
      await duplicatePersonalToSharedExpenseAction({
        personalExpenseId: id,
        move: true,
      });
    } catch (err) {
      setLocalExpenses(previousList);
      onSyncPersonalExpenses?.(previousList);
      showToast("Error al mover gasto a Hogar", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyPersonalExpenseToHogar = async (id: string) => {
    triggerHaptic(12);
    showToast("✓ Copiando a Fondo Compartido (Hogar)...", "info");
    try {
      await duplicatePersonalToSharedExpenseAction({
        personalExpenseId: id,
        move: false,
      });
      showToast("✓ Gasto copiado a Fondo Compartido (Hogar)");
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error al copiar gasto a Hogar", "error");
    }
  };

  const handleAddPersonalExpense = async (data: {
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
  }) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const category = categories.find((c) => c.id === data.categoryId);

    const optimisticExpense: PersonalExpenseItem = {
      id: tempId,
      title: data.title,
      amount: data.amount,
      date: data.date || new Date().toISOString(),
      categoryId: data.categoryId,
      category: category || null,
      installmentNumber: data.installmentNumber,
      totalInstallments: data.totalInstallments,
      notes: data.notes,
    };

    const previousExpenses = [...localExpenses];
    const optimisticList = [optimisticExpense, ...localExpenses];

    // 1. IMPACTO INMEDIATO EN UI (0ms de latencia)
    setLocalExpenses(optimisticList);
    onSyncPersonalExpenses?.(optimisticList);
    showToast(`✓ Gasto de $${Math.round(data.amount).toLocaleString("es-AR")} agregado`, "success");

    // 2. Conciliación en segundo plano en la base de datos
    try {
      const res = await addPersonalExpenseAction(data);
      if (res?.expense) {
        const reconciledList = optimisticList.map((e) =>
          e.id === tempId
            ? {
                ...e,
                id: res.expense.id,
                date: res.expense.date ? new Date(res.expense.date).toISOString() : e.date,
                category: res.expense.category || e.category,
              }
            : e
        );
        setLocalExpenses(reconciledList);
        onSyncPersonalExpenses?.(reconciledList);
      }
    } catch (err: unknown) {
      console.error("Error al guardar gasto personal:", err);
      setLocalExpenses(previousExpenses);
      onSyncPersonalExpenses?.(previousExpenses);
      showToast(err instanceof Error ? err.message : "Error al guardar el gasto personal", "error");
    }
  };

  const handleApplyRecurring = async (rec: PersonalRecurringItem) => {
    setIsProcessing(true);
    try {
      await applyPersonalRecurringExpenseAction({
        userId: currentUser.id,
        year: currentYear,
        month: currentMonth,
        recurringId: rec.id,
        title: rec.title,
        amount: rec.installmentAmount,
        categoryId: rec.categoryId || undefined,
        installmentNumber: rec.installmentNumber,
        totalInstallments: rec.totalInstallments,
      });
      showToast(`✓ "${rec.title}" imputada al mes`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al imputar cuota", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnapplyRecurring = async (expenseId: string) => {
    setIsProcessing(true);
    try {
      await unapplyPersonalRecurringExpenseAction(expenseId);
      showToast("✓ Cuota desmarcada del mes", "info");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al desmarcar cuota", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClosePersonalMonth = async () => {
    setIsProcessing(true);
    try {
      await closePersonalMonthAction(currentUser.id, currentYear, currentMonth);
      setIsCloseModalOpen(false);
      showToast("✓ Mes personal cerrado");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al cerrar mes personal", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReopenPersonalMonth = () => {
    setConfirmState({ type: "reopenMonth" });
  };

  useEffect(() => {
    if (!externalMenuAction) return;
    if (lastProcessedSeqRef.current === externalMenuAction.seq) return;
    lastProcessedSeqRef.current = externalMenuAction.seq;

    if (externalMenuAction.type === "income") {
      setIsIncomeModalOpen(true);
    } else if (externalMenuAction.type === "expense") {
      setIsExpenseModalOpen(true);
    } else if (externalMenuAction.type === "closeOrReopen") {
      if (isClosed) {
        handleReopenPersonalMonth();
      } else {
        setIsCloseModalOpen(true);
      }
    }
    onResetExternalMenuAction?.();
  }, [externalMenuAction, isClosed, onResetExternalMenuAction]);

  // Cálculo de análisis por categoría memoizado
  const sortedCategories = useMemo(() => {
    const categoryTotals: Record<string, { name: string; amount: number; count: number }> = {};
    for (const exp of localExpenses) {
      const catName = exp.category?.name || "Varios";
      if (!categoryTotals[catName]) {
        categoryTotals[catName] = { name: catName, amount: 0, count: 0 };
      }
      categoryTotals[catName].amount += exp.amount;
      categoryTotals[catName].count += 1;
    }
    return Object.values(categoryTotals).sort((a, b) => b.amount - a.amount);
  }, [localExpenses]);

  const averagePersonalExpense = localExpenses.length > 0 ? Math.round(totalPersonalExpenses / localExpenses.length) : 0;

  const normalizedQuery = personalSearchQuery.trim().toLowerCase();
  const filteredPersonalExpenses = useMemo(() => {
    return localExpenses.filter((e) => {
      if (onlyPendingReview && !hasReviewFlag(e.notes)) {
        return false;
      }
      const catName = e.category?.name || "Varios";
      const matchesCategory = personalCategoryFilter === "ALL" || catName === personalCategoryFilter;
      const matchesSearch =
        !normalizedQuery ||
        e.title.toLowerCase().includes(normalizedQuery) ||
        catName.toLowerCase().includes(normalizedQuery) ||
        (e.notes && e.notes.toLowerCase().includes(normalizedQuery));
      return matchesCategory && matchesSearch;
    });
  }, [localExpenses, onlyPendingReview, personalCategoryFilter, normalizedQuery]);

  const isFilteringPersonal =
    personalCategoryFilter !== "ALL" || normalizedQuery.length > 0 || onlyPendingReview;
  const filteredPersonalSubtotal = useMemo(
    () => filteredPersonalExpenses.reduce((acc, e) => acc + e.amount, 0),
    [filteredPersonalExpenses]
  );

  const selectedPersonalSubtotal = useMemo(() => {
    return localExpenses
      .filter((e) => selectedExpenseIds.includes(e.id))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [localExpenses, selectedExpenseIds]);

  const handleToggleSelectExpense = (id: string) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllExpenses = () => {
    triggerHaptic(10);
    const visibleIds = filteredPersonalExpenses.map((e) => e.id);
    const areAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedExpenseIds.includes(id));
    if (areAllSelected) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(visibleIds);
    }
  };

  const handleBatchCopyPersonalToHogar = async () => {
    if (selectedExpenseIds.length === 0 || isBatchProcessing) return;
    setIsBatchProcessing(true);
    triggerHaptic(15);
    try {
      const res = await batchCopyExpensesAction({
        expenseIds: selectedExpenseIds,
        fromScope: "personal",
      });
      triggerHaptic(20);
      showToast(`¡${res.count} gasto(s) copiado(s) al Hogar!`, "success");
      setIsSelectionMode(false);
      setSelectedExpenseIds([]);
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast("Error al copiar los gastos seleccionados", "error");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchMovePersonalToHogar = async () => {
    if (selectedExpenseIds.length === 0 || isBatchProcessing) return;
    setIsBatchProcessing(true);
    triggerHaptic(15);
    const idsToMove = [...selectedExpenseIds];
    try {
      setLocalExpenses((prev) => prev.filter((e) => !idsToMove.includes(e.id)));
      const res = await batchMoveExpensesAction({
        expenseIds: idsToMove,
        fromScope: "personal",
      });
      triggerHaptic(20);
      showToast(`¡${res.count} gasto(s) movido(s) al Hogar!`, "success");
      setIsSelectionMode(false);
      setSelectedExpenseIds([]);
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast("Error al mover los gastos seleccionados", "error");
      if (serverExpenses) setLocalExpenses(serverExpenses);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDeletePersonal = async () => {
    if (selectedExpenseIds.length === 0 || isBatchProcessing) return;
    setIsBatchProcessing(true);
    triggerHaptic(15);
    const idsToDelete = [...selectedExpenseIds];
    try {
      setLocalExpenses((prev) => prev.filter((e) => !idsToDelete.includes(e.id)));
      const res = await batchDeleteExpensesAction({
        expenseIds: idsToDelete,
        isPersonal: true,
      });
      triggerHaptic(20);
      showToast(`¡${res.count} gasto(s) eliminado(s)!`, "success");
      setIsSelectionMode(false);
      setSelectedExpenseIds([]);
      setIsBatchDeleteModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar los gastos seleccionados", "error");
      if (serverExpenses) setLocalExpenses(serverExpenses);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <>
      <ToastBanner toast={toast} />
      <ConfirmDialog
        isOpen={!!confirmState}
        title={
          confirmState?.type === "reopenMonth"
            ? "¿Reabrir tu mes personal?"
            : confirmState?.type === "deleteRecurring"
            ? `¿Eliminar "${confirmState?.title || "cuota/fijo"}"?`
            : `¿Eliminar "${confirmState?.title || "este gasto"}"?`
        }
        description={
          confirmState?.type === "reopenMonth"
            ? "Se volverá a habilitar el mes y se recalculará el saldo disponible."
            : confirmState?.type === "deleteRecurring"
            ? "Se quitará este plan de cuotas o suscripción fija de tu lista activa."
            : "Esta acción descontará el monto de tus gastos personales del mes."
        }
        confirmLabel={confirmState?.type === "reopenMonth" ? "Sí, reabrir" : "Sí, eliminar"}
        variant={confirmState?.type === "reopenMonth" ? "warning" : "danger"}
        isLoading={isProcessing || !!deletingId}
        onConfirm={handleExecuteConfirm}
        onCancel={() => setConfirmState(null)}
      />

      <div className="space-y-4 animate-fade-in">

      {/* PESTAÑA 1: GASTOS PERSONALES */}
      {personalTab === "gastos" && (
        <div className="space-y-4">
          {/* Tarjeta Principal Personal Unificada (Apple Card Summary Style) */}
          <section className="super-card rounded-3xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                Presupuesto Personal ({Math.round(personalRate * 100)}% + Extras)
              </span>
              <div className="flex items-center gap-2">
                {isClosed && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    Cerrado
                  </span>
                )}
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white font-bold border border-white/[0.12] tabular-nums">
                  {Math.round(personalBurnRatePct)}% gastado
                </span>
              </div>
            </div>

            {/* Métricas principales unificadas: Gastado + Remanente Libre */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">
                  Gastado del Mes
                </span>
                <span className="text-[28px] leading-tight font-extrabold text-white tracking-[-0.03em] font-mono tabular-nums block">
                  ${Math.round(totalPersonalExpenses).toLocaleString("es-AR")}
                </span>
              </div>
              <div className="text-right bg-indigo-500/[0.08] border border-indigo-400/20 rounded-2xl px-3.5 py-2 flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block mb-0.5">
                  Remanente Libre
                </span>
                <span
                  className={`text-lg leading-tight font-extrabold font-mono tabular-nums tracking-[-0.02em] ${
                    remainingPersonalPool < 0 ? "text-rose-400" : "text-white"
                  }`}
                >
                  ${Math.round(remainingPersonalPool).toLocaleString("es-AR")}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono tabular-nums mt-0.5">
                  de ${Math.round(totalPersonalAvailable).toLocaleString("es-AR")} disp.
                </span>
              </div>
            </div>

            {/* Sub-desglose del ingreso personal */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] font-medium">
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono tabular-nums">
                Base {Math.round(personalRate * 100)}%: ${Math.round(basePersonalSalary).toLocaleString("es-AR")}
              </span>
              {extraIncome > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono tabular-nums">
                  +${Math.round(extraIncome).toLocaleString("es-AR")} bonos extra
                </span>
              )}
              {carriedOverPersonal > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono tabular-nums">
                  +${Math.round(carriedOverPersonal).toLocaleString("es-AR")} mes anterior
                </span>
              )}
            </div>

            {/* Barra de Progreso SuperDesign */}
            <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
              <div
                className={`h-full transition-all duration-500 rounded-full ${burnColor}`}
                style={{ width: `${Math.min(100, personalBurnRatePct)}%` }}
              />
            </div>
          </section>

          {/* Consejo Inteligente de Compras Hoy (Acceso Rápido desde Gastos) */}
          {cardsData?.cards && cardsData.cards.length > 0 && (
            <CardShoppingAdvisorBanner
              cards={cardsData.cards}
              compact={true}
              onNavigateToCards={() => onTabChange?.("tarjetas")}
            />
          )}

          {/* Lista de Gastos Personales con Buscador estilo iOS y Filtro por Categoría */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-white tracking-[-0.015em]">
                  Gastos de {monthName}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.07] border border-white/[0.08] text-[11px] font-semibold text-zinc-300 tabular-nums">
                  {localExpenses.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {localExpenses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      const next = !isSelectionMode;
                      setIsSelectionMode(next);
                      if (!next) setSelectedExpenseIds([]);
                    }}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-xl transition flex items-center gap-1 active:scale-95 cursor-pointer ${
                      isSelectionMode
                        ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/40"
                        : "text-zinc-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08]"
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{isSelectionMode ? "Listo" : "Seleccionar"}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-xs font-semibold text-indigo-300/90 hover:text-indigo-200 active:scale-95 flex items-center gap-1 transition cursor-pointer"
                  title="Gestionar categorías"
                >
                  <Tag className="w-3.5 h-3.5 text-indigo-400/80" />
                  <span>Categorías</span>
                </button>
              </div>
            </div>

            {/* Barra de control de Selección Múltiple */}
            {isSelectionMode && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs animate-fade-in shadow-inner">
                <span className="text-zinc-200 font-medium">
                  <strong className="text-white font-mono">{selectedExpenseIds.length}</strong> de{" "}
                  {filteredPersonalExpenses.length} seleccionado{selectedExpenseIds.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllExpenses}
                  className="text-xs font-bold text-indigo-300 hover:text-indigo-200 underline transition cursor-pointer"
                >
                  {selectedExpenseIds.length === filteredPersonalExpenses.length &&
                  filteredPersonalExpenses.length > 0
                    ? "Deseleccionar todos"
                    : "Seleccionar todos"}
                </button>
              </div>
            )}

            {/* Buscador instantáneo UISearchTextField + Chips de Categoría */}
            {localExpenses.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={personalSearchQuery}
                    onChange={(e) => setPersonalSearchQuery(e.target.value)}
                    placeholder="Buscar por comercio, categoría o nota..."
                    className="w-full bg-[rgba(118,118,128,0.24)] border border-white/[0.07] rounded-xl py-2 pl-9 pr-8 text-[13px] text-white placeholder:text-zinc-400 focus:outline-none focus:bg-[rgba(118,118,128,0.32)] focus:border-indigo-400/50 transition"
                  />
                  {personalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPersonalSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-300 hover:text-white bg-white/[0.12]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {(sortedCategories.length > 1 || pendingReviewCount > 0) && (
                  <div
                    className="flex items-center gap-1.5 overflow-x-auto touch-pan-x overscroll-x-contain no-scrollbar py-1 -mx-1 px-1 scroll-smooth"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(8);
                        setPersonalCategoryFilter("ALL");
                        setOnlyPendingReview(false);
                      }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all duration-200 select-none ${
                        personalCategoryFilter === "ALL" && !onlyPendingReview
                          ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/60 border border-indigo-400/30 font-bold"
                          : "bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-white/[0.08]"
                      }`}
                    >
                      Todos ({localExpenses.length})
                    </button>
                    {pendingReviewCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(8);
                          setOnlyPendingReview(!onlyPendingReview);
                        }}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 transition-all duration-200 flex items-center gap-1.5 select-none ${
                          onlyPendingReview
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 shadow-md shadow-amber-950/60 border border-amber-300/60 scale-[1.02]"
                            : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/35"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            onlyPendingReview ? "bg-zinc-950" : "bg-amber-400 animate-ping"
                          }`}
                        />
                        <span>Por revisar ({pendingReviewCount})</span>
                      </button>
                    )}
                    {sortedCategories.map((cat) => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => {
                          triggerHaptic(8);
                          setPersonalCategoryFilter(
                            personalCategoryFilter === cat.name ? "ALL" : cat.name
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all duration-200 select-none flex items-center gap-1.5 ${
                          personalCategoryFilter === cat.name
                            ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/60 border border-indigo-400/30 font-bold"
                            : "bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-white/[0.08]"
                        }`}
                      >
                        <CategoryIcon name={cat.name} className="w-3.5 h-3.5" />
                        <span>{cat.name}</span>
                        <span className="text-[10px] opacity-75">({cat.count})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Barra de Subtotal cuando hay búsqueda o filtro activo */}
                {isFilteringPersonal && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-[11px] animate-fade-in">
                    <span className="text-indigo-200 font-medium">
                      Mostrando <strong>{filteredPersonalExpenses.length}</strong> gasto(s) • Subtotal:{" "}
                      <strong className="font-mono text-white">
                        ${Math.round(filteredPersonalSubtotal).toLocaleString("es-AR")}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalCategoryFilter("ALL");
                        setPersonalSearchQuery("");
                        setOnlyPendingReview(false);
                      }}
                      className="text-indigo-300 hover:text-white font-bold underline ml-2 transition-colors"
                    >
                      Limpiar
                    </button>
                  </div>
                )}

                {/* Banner de aviso cuando hay gastos de tarjeta pendientes de revisar */}
                {pendingReviewCount > 0 && (
                  <div className="card-review-pending rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-inner">
                        <AlertCircle className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-amber-100 block truncate">
                          {pendingReviewCount} gasto{pendingReviewCount > 1 ? "s" : ""} de tarjeta para revisar
                        </span>
                        <span className="text-[11px] text-amber-200/75 block truncate">
                          Confirmalos como personales o duplicalos a compartidos del hogar.
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={handleConfirmAllReviewed}
                        disabled={isBatchConfirming}
                        className="px-3.5 py-1.5 rounded-xl font-bold text-[11px] bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-100 border border-emerald-400/50 shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-300 stroke-[3]" />
                        <span>Confirmar todos ({pendingReviewCount})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOnlyPendingReview(!onlyPendingReview)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[11px] shrink-0 border transition-all duration-200 active:scale-95 cursor-pointer ${
                          onlyPendingReview
                            ? "bg-zinc-900/90 hover:bg-zinc-800 text-amber-200 border-amber-400/35"
                            : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 border-amber-300/60 shadow-sm shadow-amber-950/60"
                        }`}
                      >
                        {onlyPendingReview ? "Ver todos" : "Filtrar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {filteredPersonalExpenses.length === 0 ? (
              <div className="super-card rounded-2xl p-8 text-center animate-fade-in">
                <Wallet className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
                <p className="text-sm font-medium text-zinc-300">
                  {isFilteringPersonal
                    ? "No se encontraron gastos con ese filtro"
                    : "Sin gastos personales registrados"}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {isFilteringPersonal ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalCategoryFilter("ALL");
                        setPersonalSearchQuery("");
                        setOnlyPendingReview(false);
                      }}
                      className="text-indigo-400 font-semibold underline"
                    >
                      Ver todos los gastos del mes
                    </button>
                  ) : (
                    <>
                      Tocá el botón <span className="text-indigo-400 font-semibold">+ Gasto</span> para anotar compras propias.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredPersonalExpenses.map((exp) => (
                  <PersonalExpenseRow
                    key={exp.id}
                    exp={exp}
                    deletingId={deletingId}
                    actioningId={actioningId}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedExpenseIds.includes(exp.id)}
                    onToggleSelect={handleToggleSelectExpense}
                    onOpenDetail={(targetExp) => {
                      setSelectedPersonalExpense({
                        id: targetExp.id,
                        title: targetExp.title,
                        amount: targetExp.amount,
                        date: targetExp.date,
                        categoryId: targetExp.categoryId || targetExp.category?.id,
                        category: targetExp.category,
                        notes: targetExp.notes,
                        installmentNumber: targetExp.installmentNumber,
                        totalInstallments: targetExp.totalInstallments,
                        isPersonal: true,
                      });
                      setIsDetailModalOpen(true);
                    }}
                    onLongPress={(targetExp) => {
                      setContextMenuExpense({
                        id: targetExp.id,
                        title: targetExp.title,
                        amount: targetExp.amount,
                        date: targetExp.date,
                        category: targetExp.category,
                        notes: targetExp.notes,
                        installmentNumber: targetExp.installmentNumber,
                        totalInstallments: targetExp.totalInstallments,
                        isPersonal: true,
                      });
                      setIsContextMenuOpen(true);
                    }}
                    showToast={showToast}
                    handleQuickDuplicateToShared={handleQuickDuplicateToShared}
                    handleQuickMarkReviewed={handleQuickMarkReviewed}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* PESTAÑA 2: ANÁLISIS PERSONAL */}
      {personalTab === "analisis" && (
        <div className="space-y-4">
          <div className="super-card rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-purple-400" />
                Diagnóstico Personal • {monthName} {currentYear}
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white font-bold border border-white/[0.12] tabular-nums">
                {localExpenses.length} gastos
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-zinc-300 block">Total Gastado</span>
                <span className="text-xl font-bold text-white mt-1 block font-mono tabular-nums">
                  ${Math.round(totalPersonalExpenses).toLocaleString("es-AR")}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium block mt-0.5 tabular-nums">
                  {Math.round(personalBurnRatePct)}% de tu presupuesto + extras
                </span>
              </div>

              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-zinc-300 block">Ticket Promedio</span>
                <span className="text-xl font-bold text-white mt-1 block font-mono tabular-nums">
                  ${averagePersonalExpense.toLocaleString("es-AR")}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium block mt-0.5">
                  por compra personal
                </span>
              </div>
            </div>

            {/* Diagnóstico */}
            <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-3.5 flex items-start gap-2.5 shadow-sm">
              <Sparkles className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-200 leading-relaxed">
                {totalPersonalExpenses === 0 ? (
                  <p>Todavía no registraste gastos personales este mes.</p>
                ) : remainingPersonalPool > 0 ? (
                  <p>
                    <strong className="text-purple-300">¡Muy bien administrado!</strong> Te quedan{" "}
                    <span className="text-emerald-400 font-bold font-mono tabular-nums">
                      ${Math.round(remainingPersonalPool).toLocaleString("es-AR")}
                    </span>{" "}
                    disponibles para ahorro o pasar al mes siguiente.
                  </p>
                ) : (
                  <p>
                    <strong className="text-rose-300">Atención:</strong> Superaste tu presupuesto personal + bonos este mes.
                  </p>
                )}
              </div>
            </div>

            {/* Acciones del Período Personal (en Análisis) */}
            <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3.5 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setIsIncomeModalOpen(true)}
                className="py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition active:scale-95 border border-white/[0.08]"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Editar Ingreso/Bono</span>
              </button>

              {isClosed ? (
                <button
                  type="button"
                  onClick={handleReopenPersonalMonth}
                  disabled={isProcessing}
                  className="py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition active:scale-95 border border-amber-500/30"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Reabrir Mes</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(true)}
                  className="py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition active:scale-95 border border-white/[0.08]"
                >
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Cerrar Mes</span>
                </button>
              )}
            </div>
          </div>

          {/* Categorías Personales */}
          <div className="super-card rounded-3xl p-5">
            <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-4">
              Gastos por Categoría
            </h3>

            {sortedCategories.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-2">Sin gastos personales registrados.</p>
            ) : (
              <div className="space-y-3.5">
                {sortedCategories.map((cat) => {
                  const pct = totalPersonalExpenses > 0 ? (cat.amount / totalPersonalExpenses) * 100 : 0;
                  return (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-zinc-200">
                            <CategoryIcon name={cat.name} className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-semibold text-white">{cat.name}</span>
                          <span className="text-zinc-400 text-[10px]">({cat.count})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-white mr-2 font-mono tabular-nums">
                            ${Math.round(cat.amount).toLocaleString("es-AR")}
                          </span>
                          <span className="text-zinc-300 font-bold tabular-nums">{Math.round(pct)}%</span>
                        </div>
                      </div>

                      <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: CUOTAS & RECURRENTES PERSONALES */}
      {personalTab === "cuotas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-xs font-bold text-white">Tarjetas & Fijos Personales</h2>
              <p className="text-[10px] text-zinc-400">
                Asocialas a una tarjeta para que se incluyan al abrir un nuevo resumen
              </p>
            </div>
            <button
              onClick={() => setIsRecurringModalOpen(true)}
              className="px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-md active:scale-95 transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Cuota</span>
            </button>
          </div>

          {recurringExpenses.length === 0 ? (
            <div className="super-card rounded-2xl p-8 text-center">
              <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-zinc-300">Sin cuotas personales registradas</p>
              <p className="text-xs text-zinc-500 mt-1">
                Agregá compras con tarjeta en cuotas o servicios que pagás individualmente.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recurringExpenses.map((rec) => (
                <div
                  key={rec.id}
                  className="super-card-subtle rounded-2xl p-3.5 flex items-center justify-between border border-white/[0.08]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">
                        {rec.title}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-zinc-400 font-medium">
                        {rec.totalInstallments ? (
                          <span className="font-mono text-purple-300 font-bold">
                            Cuota {rec.installmentNumber}/{rec.totalInstallments}
                          </span>
                        ) : (
                          <span className="text-zinc-400">Mensual fijo</span>
                        )}
                        <span>•</span>
                        <span className="font-mono tabular-nums font-bold text-white">
                          ${Math.round(rec.installmentAmount).toLocaleString("es-AR")}
                        </span>
                        {rec.creditCard && (
                          <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-200 border border-pink-500/30 text-[10px] font-bold">
                            💳 {rec.creditCard.bank} {rec.creditCard.brand}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {rec.creditCard ? (
                      <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/30 text-[10px] font-bold">
                        En Tarjeta
                      </span>
                    ) : rec.alreadyApplied ? (
                      <button
                        onClick={() => rec.appliedExpenseId && handleUnapplyRecurring(rec.appliedExpenseId)}
                        disabled={isProcessing}
                        className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Imputada</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApplyRecurring(rec)}
                        disabled={isProcessing}
                        className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 border border-white/[0.1] text-xs font-semibold active:scale-95 transition"
                      >
                        Imputar Mes
                      </button>
                    )}

                    <button
                      onClick={() =>
                        setConfirmState({
                          type: "deleteRecurring",
                          id: rec.id,
                          title: rec.title,
                        })
                      }
                      disabled={isProcessing}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 active:scale-90 transition"
                      title="Eliminar cuota/fijo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 4: TARJETAS DE CRÉDITO PERSONALES */}
      {personalTab === "tarjetas" && (
        <PersonalCardsView
          userId={currentUser.id}
          userName={currentUser.name}
          year={currentYear}
          month={currentMonth}
          monthName={monthName}
          categories={categories}
          cardsData={cardsData}
          onOpenNewRecurring={() => setIsRecurringModalOpen(true)}
        />
      )}

      {/* PESTAÑA 5: INVERSIONES PERSONALES */}
      {personalTab === "inversiones" && (
        <PersonalInvestmentsView
          userId={currentUser.id}
          userName={currentUser.name}
          investments={investments}
          summary={investmentsSummary}
        />
      )}
      </div>

      {/* Botón de Acción Rápida Flotante (+) en Personal (fuera del contenedor animado para mantener position: fixed real) */}
      {(personalTab === "gastos" || personalTab === "analisis" || personalTab === "cuotas") && (
        <div
          className="fixed left-0 right-0 z-40 pointer-events-none"
          style={{ bottom: "calc(68px + max(8px, env(safe-area-inset-bottom, 0px)))" }}
        >
          <div className="w-full max-w-md md:max-w-4xl lg:max-w-6xl mx-auto px-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                if (personalTab === "cuotas") {
                  setIsRecurringModalOpen(true);
                } else {
                  setIsExpenseModalOpen(true);
                }
              }}
              aria-label={personalTab === "cuotas" ? "Cargar nueva cuota" : "Cargar nuevo gasto personal"}
              className="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-full apple-segment-active-personal hover:brightness-110 text-white font-bold text-xs shadow-[0_10px_30px_rgba(94,92,230,0.6)] border border-indigo-400/40 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.8]" />
              <span>{personalTab === "cuotas" ? "Nueva Cuota" : "Nuevo Gasto"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modales Personales */}
      <PersonalIncomeModal
        isOpen={isIncomeModalOpen}
        onClose={() => {
          setIsIncomeModalOpen(false);
          onResetExternalMenuAction?.();
        }}
        userId={currentUser.id}
        userName={currentUser.name}
        year={currentYear}
        month={currentMonth}
        monthName={monthName}
        hogarSalary={personalData.hogarSalary}
        contributionPct={personalData.contributionPct}
        basePersonalSalary={basePersonalSalary}
        currentExtraAmount={extraIncome}
        carriedOverPersonal={carriedOverPersonal}
        currentNotes={personalData.incomeRecord?.notes}
      />

      <PersonalExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          onResetExternalMenuAction?.();
        }}
        userId={currentUser.id}
        userName={currentUser.name}
        year={currentYear}
        month={currentMonth}
        categories={categories}
        onAddExpense={handleAddPersonalExpense}
      />

      <PersonalRecurringModal
        isOpen={isRecurringModalOpen}
        onClose={() => {
          setIsRecurringModalOpen(false);
          onResetExternalMenuAction?.();
        }}
        userId={currentUser.id}
        userName={currentUser.name}
        currentYear={currentYear}
        currentMonth={currentMonth}
        categories={categories}
        cards={cardsData?.cards || []}
      />

      {/* Modal de Cierre Mensual Personal */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md super-card rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Cierre Personal</h2>
                  <p className="text-xs text-zinc-400">{currentUser.name} • {monthName} {currentYear}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCloseModalOpen(false);
                  onResetExternalMenuAction?.();
                }}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Presupuesto Personal:</span>
                  <span className="font-bold text-white font-mono tabular-nums">
                    ${Math.round(totalPersonalAvailable).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Gastado Personal:</span>
                  <span className="font-bold text-rose-300 font-mono tabular-nums">
                    -${Math.round(totalPersonalExpenses).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="border-t border-white/[0.08] pt-2 flex justify-between">
                  <span className="font-bold text-zinc-200">Remanente no gastado:</span>
                  <span className="font-bold text-white font-mono tabular-nums text-sm">
                    ${Math.round(remainingPersonalPool).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {remainingPersonalPool > 0 ? (
                <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 text-xs text-indigo-100 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Al cerrar tu mes personal, los{" "}
                    <strong className="text-white font-mono tabular-nums">
                      ${Math.round(remainingPersonalPool).toLocaleString("es-AR")}
                    </strong>{" "}
                    sobrantes se trasladarán automáticamente a tu saldo de{" "}
                    <strong className="text-indigo-300">próximo mes</strong>.
                  </p>
                </div>
              ) : (
                <div className="bg-zinc-900/60 border border-white/[0.08] rounded-2xl p-4 text-xs text-zinc-400">
                  Utilizaste la totalidad de tu presupuesto del mes. El próximo mes iniciará con el {Math.round(personalRate * 100)}% de tu sueldo nuevo.
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={handleClosePersonalMonth}
                disabled={isProcessing}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <Lock className="w-4 h-4" />
                <span>Confirmar Cierre Personal</span>
              </button>
              <button
                onClick={() => setIsCloseModalOpen(false)}
                disabled={isProcessing}
                className="w-full py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 font-medium text-xs active:scale-[0.98] transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle / Edición de Gasto Personal */}
      <ExpenseDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedPersonalExpense(null);
        }}
        expense={selectedPersonalExpense}
        categories={categories}
        isPersonal={true}
        onDeleteExpense={handleDeletePersonalExpense}
        onMoveExpense={handleMovePersonalExpenseToHogar}
        onCopyExpense={handleCopyPersonalExpenseToHogar}
        onUpdateExpense={(updated) => {
          const updatedList = localExpenses.map((e) =>
            e.id === updated.id
              ? {
                  ...e,
                  title: updated.title,
                  amount: updated.amount,
                  date: updated.date,
                  categoryId: updated.categoryId,
                  category: updated.category,
                  notes: updated.notes,
                }
              : e
          );
          setLocalExpenses(updatedList);
          onSyncPersonalExpenses?.(updatedList);
          showToast("✓ Gasto actualizado");
        }}
      />

      {/* Menú Contextual iOS (Long Press) para Gastos Personales */}
      <ExpenseContextMenu
        isOpen={isContextMenuOpen}
        onClose={() => {
          setIsContextMenuOpen(false);
          setContextMenuExpense(null);
        }}
        expense={contextMenuExpense}
        isPersonal={true}
        onOpenDetail={(exp) => {
          setSelectedPersonalExpense({
            id: exp.id,
            title: exp.title,
            amount: exp.amount,
            date: exp.date,
            categoryId: exp.category?.id,
            category: exp.category as any,
            notes: exp.notes,
            installmentNumber: exp.installmentNumber,
            totalInstallments: exp.totalInstallments,
            isPersonal: true,
          });
          setIsDetailModalOpen(true);
        }}
        onCopyExpense={handleCopyPersonalExpenseToHogar}
        onMoveExpense={handleMovePersonalExpenseToHogar}
        onDeleteExpense={handleDeletePersonalExpense}
      />

      {/* Modal de Gestión de Categorías */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
      />

      {/* Diálogo de Confirmación para Eliminación en Lote (Personal) */}
      <ConfirmDialog
        isOpen={isBatchDeleteModalOpen}
        title={`¿Eliminar ${selectedExpenseIds.length} gasto${selectedExpenseIds.length > 1 ? "s" : ""}?`}
        description={`Esta acción eliminará de forma permanente los ${selectedExpenseIds.length} gastos seleccionados de tu espacio personal.`}
        confirmLabel={`Eliminar (${selectedExpenseIds.length})`}
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isBatchProcessing}
        onConfirm={handleBatchDeletePersonal}
        onCancel={() => setIsBatchDeleteModalOpen(false)}
      />

      {/* Barra de Acciones Flotante por Lote (Personal -> Hogar / Eliminar) */}
      {isSelectionMode && personalTab === "gastos" && (
        <div className="fixed bottom-20 inset-x-3 max-w-lg mx-auto sm:bottom-6 z-50 animate-slide-up">
          <div className="rounded-2xl p-3 border border-white/[0.15] shadow-2xl bg-zinc-950/92 backdrop-blur-xl flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-zinc-300">
                <strong className="text-white font-mono">{selectedExpenseIds.length}</strong> seleccionado{selectedExpenseIds.length === 1 ? "" : "s"}
                {selectedPersonalSubtotal > 0 && (
                  <span className="text-indigo-300 font-mono font-bold ml-1.5">
                    • ${Math.round(selectedPersonalSubtotal).toLocaleString("es-AR")}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setIsSelectionMode(false);
                  setSelectedExpenseIds([]);
                }}
                className="text-[11px] font-semibold text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/[0.08] transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleBatchCopyPersonalToHogar}
                disabled={selectedExpenseIds.length === 0 || isBatchProcessing}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 border border-blue-500/30 text-xs font-semibold active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-blue-400" />
                <span className="truncate">Copiar a Hogar</span>
              </button>
              <button
                type="button"
                onClick={handleBatchMovePersonalToHogar}
                disabled={selectedExpenseIds.length === 0 || isBatchProcessing}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 text-xs font-semibold active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-300" />
                <span className="truncate">Mover a Hogar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(12);
                  setIsBatchDeleteModalOpen(true);
                }}
                disabled={selectedExpenseIds.length === 0 || isBatchProcessing}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="truncate">Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
