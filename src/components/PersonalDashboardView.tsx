"use client";

import React, { useState } from "react";
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
} from "./ui/icons";
import { ConfirmDialog, ToastBanner, useToast } from "./ui/ConfirmDialog";
import { PersonalIncomeModal } from "./PersonalIncomeModal";
import { PersonalExpenseModal } from "./PersonalExpenseModal";
import { PersonalRecurringModal } from "./PersonalRecurringModal";
import { ExpenseDetailModal, EditableExpense } from "./ExpenseDetailModal";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { PersonalInvestmentsView } from "./PersonalInvestmentsView";
import { PersonalCardsView } from "./PersonalCardsView";
import {
  deletePersonalExpenseAction,
  deletePersonalRecurringExpenseAction,
  applyPersonalRecurringExpenseAction,
  unapplyPersonalRecurringExpenseAction,
  closePersonalMonthAction,
  reopenPersonalMonthAction,
} from "@/app/actions";

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
}

const SHORT_MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"
];

export function PersonalDashboardView({
  currentUser,
  currentYear,
  currentMonth,
  monthName,
  categories,
  personalData,
  activeTab = "gastos",
}: PersonalDashboardViewProps) {
  const personalTab = activeTab;
  const { toast, showToast } = useToast();
  const [personalCategoryFilter, setPersonalCategoryFilter] = useState<string>("ALL");
  const [personalSearchQuery, setPersonalSearchQuery] = useState<string>("");
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedPersonalExpense, setSelectedPersonalExpense] = useState<EditableExpense | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    type: "deleteExpense" | "deleteRecurring" | "reopenMonth";
    id?: string;
    title?: string;
  } | null>(null);

  const {
    basePersonalSalary,
    extraIncome,
    carriedOverPersonal,
    totalPersonalAvailable,
    totalPersonalExpenses,
    remainingPersonalPool,
    personalBurnRatePct,
    expenses,
    recurringExpenses,
    investments = [],
    investmentsSummary = null,
    cardsData = null,
    isClosed,
  } = personalData;

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
      setDeletingId(current.id);
      try {
        await deletePersonalExpenseAction(current.id);
        showToast("✓ Gasto personal eliminado");
      } catch (err) {
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

  // Cálculo de análisis por categoría
  const categoryTotals: Record<string, { name: string; amount: number; count: number }> = {};
  for (const exp of expenses) {
    const catName = exp.category?.name || "Varios";
    if (!categoryTotals[catName]) {
      categoryTotals[catName] = { name: catName, amount: 0, count: 0 };
    }
    categoryTotals[catName].amount += exp.amount;
    categoryTotals[catName].count += 1;
  }
  const sortedCategories = Object.values(categoryTotals).sort((a, b) => b.amount - a.amount);
  const averagePersonalExpense = expenses.length > 0 ? Math.round(totalPersonalExpenses / expenses.length) : 0;

  const normalizedQuery = personalSearchQuery.trim().toLowerCase();
  const filteredPersonalExpenses = expenses.filter((e) => {
    const catName = e.category?.name || "Varios";
    const matchesCategory = personalCategoryFilter === "ALL" || catName === personalCategoryFilter;
    const matchesSearch =
      !normalizedQuery ||
      e.title.toLowerCase().includes(normalizedQuery) ||
      catName.toLowerCase().includes(normalizedQuery) ||
      (e.notes && e.notes.toLowerCase().includes(normalizedQuery));
    return matchesCategory && matchesSearch;
  });

  const isFilteringPersonal = personalCategoryFilter !== "ALL" || normalizedQuery.length > 0;
  const filteredPersonalSubtotal = filteredPersonalExpenses.reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="space-y-4 animate-fade-in">
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

      {/* PESTAÑA 1: GASTOS PERSONALES */}
      {personalTab === "gastos" && (
        <div className="space-y-4">
          {/* Tarjeta Principal Personal (Obsidian Glass) */}
          <section className="super-card rounded-3xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                Presupuesto Personal (40% + Extras)
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

            <div className="flex items-baseline justify-between mb-2">
              <div>
                <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">Gastado:</span>
                <span className="text-3xl font-extrabold text-white tracking-tight font-mono tabular-nums">
                  ${Math.round(totalPersonalExpenses).toLocaleString("es-AR")}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">Total Disponible:</span>
                <span className="text-base font-bold text-zinc-100 font-mono tabular-nums">
                  ${Math.round(totalPersonalAvailable).toLocaleString("es-AR")}
                </span>
              </div>
            </div>

            {/* Sub-desglose del ingreso personal */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] font-medium">
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono tabular-nums">
                Base 40%: ${Math.round(basePersonalSalary).toLocaleString("es-AR")}
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
            <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden mb-4 p-0.5 border border-white/[0.08]">
              <div
                className={`h-full transition-all duration-500 rounded-full ${burnColor}`}
                style={{ width: `${Math.min(100, personalBurnRatePct)}%` }}
              />
            </div>

            {/* Acciones de la Tarjeta */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
              <button
                onClick={() => setIsIncomeModalOpen(true)}
                className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition active:scale-95 border border-white/[0.08]"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Editar Ingreso/Bono</span>
              </button>

              {isClosed ? (
                <button
                  onClick={handleReopenPersonalMonth}
                  disabled={isProcessing}
                  className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition active:scale-95 border border-amber-500/30"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Reabrir Mes</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsCloseModalOpen(true)}
                  className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition active:scale-95 border border-white/[0.08]"
                >
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Cerrar Mes</span>
                </button>
              )}
            </div>
          </section>

          {/* Banner Remanente Personal */}
          <div className="super-card rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Remanente Personal Libre
                </span>
                <span className="text-lg font-bold text-white font-mono tabular-nums">
                  ${Math.round(remainingPersonalPool).toLocaleString("es-AR")}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md active:scale-95 transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gasto</span>
            </button>
          </div>

          {/* Lista de Gastos Personales con Buscador y Filtro por Categoría */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Gastos Personales de {monthName} ({expenses.length})
              </h2>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 active:scale-95 flex items-center gap-1 transition"
                title="Gestionar categorías"
              >
                <Tag className="w-3.5 h-3.5 text-zinc-500" />
                <span>Categorías</span>
              </button>
            </div>

            {/* Buscador instantáneo + Chips de Categoría */}
            {expenses.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={personalSearchQuery}
                    onChange={(e) => setPersonalSearchQuery(e.target.value)}
                    placeholder="Buscar gasto por nombre, categoría o nota..."
                    className="w-full bg-zinc-900/90 border border-white/[0.08] rounded-2xl py-2 pl-9 pr-8 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition"
                  />
                  {personalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPersonalSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-white bg-white/[0.06]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {sortedCategories.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    <button
                      type="button"
                      onClick={() => setPersonalCategoryFilter("ALL")}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                        personalCategoryFilter === "ALL"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                      }`}
                    >
                      Todos ({expenses.length})
                    </button>
                    {sortedCategories.map((cat) => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() =>
                          setPersonalCategoryFilter(
                            personalCategoryFilter === cat.name ? "ALL" : cat.name
                          )
                        }
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                          personalCategoryFilter === cat.name
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                        }`}
                      >
                        <CategoryIcon name={cat.name} className="w-3 h-3" />
                        <span>{cat.name}</span>
                        <span className="text-[10px] opacity-75">({cat.count})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Barra de Subtotal cuando hay búsqueda o filtro activo */}
                {isFilteringPersonal && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-[11px]">
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
                      }}
                      className="text-indigo-300 hover:text-white font-bold underline ml-2"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>
            )}

            {filteredPersonalExpenses.length === 0 ? (
              <div className="super-card rounded-2xl p-8 text-center">
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
              <div className="space-y-2">
                {filteredPersonalExpenses.map((exp) => {
                  const dateObj = new Date(exp.date);
                  const dateStr = `${dateObj.getDate()} ${SHORT_MONTHS[dateObj.getMonth()] || ""}`;

                  return (
                    <div
                      key={exp.id}
                      onClick={() => {
                        setSelectedPersonalExpense({
                          id: exp.id,
                          title: exp.title,
                          amount: exp.amount,
                          date: exp.date,
                          categoryId: exp.categoryId || exp.category?.id,
                          category: exp.category,
                          notes: exp.notes,
                          installmentNumber: exp.installmentNumber,
                          totalInstallments: exp.totalInstallments,
                          isPersonal: true,
                        });
                        setIsDetailModalOpen(true);
                      }}
                      className="super-card-subtle rounded-2xl p-3.5 flex items-center justify-between hover:bg-white/[0.05] active:scale-[0.99] transition duration-150 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-white/[0.08] flex items-center justify-center text-zinc-300 shadow-sm shrink-0">
                          <CategoryIcon name={exp.category?.name || "Varios"} className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-white block group-hover:text-indigo-300 transition-colors">
                            {exp.title}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-400 font-medium">
                            <span>{dateStr}</span>
                            {exp.category && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-300 font-sans">{exp.category.name}</span>
                              </>
                            )}
                            {exp.totalInstallments && (
                              <>
                                <span>•</span>
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30 text-[10px] font-bold">
                                  Cuota {exp.installmentNumber}/{exp.totalInstallments}
                                </span>
                              </>
                            )}
                          </div>
                          {exp.notes && (
                            <p className="text-[11px] text-zinc-400 italic mt-1 line-clamp-1 flex items-center gap-1">
                              <span>💬</span>
                              <span>{exp.notes}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-white font-mono tabular-nums">
                          ${Math.round(exp.amount).toLocaleString("es-AR")}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExpense(exp.id, exp.title);
                          }}
                          disabled={deletingId === exp.id}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 active:scale-90 transition"
                          title="Eliminar gasto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                {expenses.length} gastos
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-zinc-300 block">Total Gastado</span>
                <span className="text-xl font-bold text-white mt-1 block font-mono tabular-nums">
                  ${Math.round(totalPersonalExpenses).toLocaleString("es-AR")}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium block mt-0.5 tabular-nums">
                  {Math.round(personalBurnRatePct)}% de tu 40% + extras
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
                    <strong className="text-rose-300">Atención:</strong> Superaste tu presupuesto del 40% + bonos este mes.
                  </p>
                )}
              </div>
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

      {/* Botón de Acción Rápida Flotante (+) en Personal (ergonómico para el pulgar) */}
      {(personalTab === "gastos" || personalTab === "analisis" || personalTab === "cuotas") && (
        <div
          className="fixed left-0 right-0 z-40 pointer-events-none"
          style={{ bottom: "calc(68px + max(8px, env(safe-area-inset-bottom, 0px)))" }}
        >
          <div className="w-full max-w-md mx-auto px-4 flex justify-end">
            <button
              type="button"
              onClick={() =>
                personalTab === "cuotas"
                  ? setIsRecurringModalOpen(true)
                  : setIsExpenseModalOpen(true)
              }
              className="pointer-events-auto h-12 px-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-[0_10px_30px_rgba(79,70,229,0.55)] border border-white/25 flex items-center gap-2 active:scale-95 transition"
            >
              <Plus className="w-4 h-4 stroke-[2.8]" />
              <span>{personalTab === "cuotas" ? "Nueva Cuota" : "Nuevo Gasto"}</span>
            </button>
          </div>
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

      {/* Modales Personales */}
      <PersonalIncomeModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
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
        onClose={() => setIsExpenseModalOpen(false)}
        userId={currentUser.id}
        userName={currentUser.name}
        year={currentYear}
        month={currentMonth}
        categories={categories}
      />

      <PersonalRecurringModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
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
                onClick={() => setIsCloseModalOpen(false)}
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
                  Utilizaste la totalidad de tu presupuesto del mes. El próximo mes iniciará con el 40% de tu sueldo nuevo.
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
      />

      {/* Modal de Gestión de Categorías */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
      />
    </div>
  );
}
