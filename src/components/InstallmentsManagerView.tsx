"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Repeat,
  Plus,
  Check,
  Trash2,
  CategoryIcon,
  X,
  Sparkles,
  Calendar,
  Layers,
  AlertCircle,
  TrendingUp,
} from "./ui/icons";
import {
  createRecurringExpenseAction,
  deleteRecurringExpenseAction,
  applyRecurringExpenseToMonthAction,
  applyAllRecurringExpensesAction,
  unapplyRecurringExpenseAction,
} from "@/app/actions";
import { ConfirmDialog, ToastBanner, useToast } from "./ui/ConfirmDialog";

interface Category {
  id: string;
  name: string;
  icon?: string | null;
}

interface HouseholdUser {
  id: string;
  name: string;
}

interface RecurringItem {
  id: string;
  title: string;
  installmentAmount: number;
  totalInstallments?: number | null;
  startYear: number;
  startMonth: number;
  paidById: string;
  paidBy: { id: string; name: string };
  isFromPoolFund: boolean;
  categoryId: string;
  category: { id: string; name: string };
  installmentNumber: number;
  isApplicableThisMonth: boolean;
  alreadyApplied: boolean;
  appliedExpenseId?: string;
}

interface InstallmentsManagerViewProps {
  periodId: string;
  currentYear: number;
  currentMonth: number;
  monthName: string;
  recurringExpenses: RecurringItem[];
  users: HouseholdUser[];
  categories: Category[];
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function InstallmentsManagerView({
  periodId,
  currentYear,
  currentMonth,
  monthName,
  recurringExpenses,
  users,
  categories,
}: InstallmentsManagerViewProps) {
  const { toast, showToast } = useToast();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "installments" | "fixed">("all");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [isInstallmentPlan, setIsInstallmentPlan] = useState(true);
  const [calculationMode, setCalculationMode] = useState<"per_installment" | "total_amount">("per_installment");
  const [rawAmountInput, setRawAmountInput] = useState("");
  const [selectedPresetInstallments, setSelectedPresetInstallments] = useState<string>("6");
  const [customInstallments, setCustomInstallments] = useState("");
  const [startYearInput, setStartYearInput] = useState<number>(currentYear);
  const [startMonthInput, setStartMonthInput] = useState<number>(currentMonth);
  const [selectedPayerId, setSelectedPayerId] = useState(users[0]?.id || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isBatchApplying, setIsBatchApplying] = useState(false);

  const effectiveTotalInstallments = isInstallmentPlan
    ? selectedPresetInstallments === "custom"
      ? parseInt(customInstallments) || 1
      : parseInt(selectedPresetInstallments) || 6
    : null;

  // Calculamos la cuota mensual según el modo de cálculo
  const calculatedInstallmentAmount = React.useMemo(() => {
    const val = parseFloat(rawAmountInput) || 0;
    if (val <= 0) return 0;
    if (!isInstallmentPlan || calculationMode === "per_installment") {
      return val;
    }
    // calculationMode === "total_amount"
    const cuotas = effectiveTotalInstallments || 1;
    return val / cuotas;
  }, [rawAmountInput, isInstallmentPlan, calculationMode, effectiveTotalInstallments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || calculatedInstallmentAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await createRecurringExpenseAction({
        title: title.trim(),
        installmentAmount: calculatedInstallmentAmount,
        totalInstallments: effectiveTotalInstallments,
        startYear: startYearInput,
        startMonth: startMonthInput,
        paidById: selectedPayerId,
        categoryId: selectedCategoryId,
        isFromPoolFund: false,
      });

      // Reset form
      setTitle("");
      setRawAmountInput("");
      setCustomInstallments("");
      setIsAddingNew(false);
      showToast("✓ Plan de cuotas / fijo creado");
    } catch (err) {
      console.error(err);
      showToast("Error al guardar la cuota/gasto recurrente", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyToMonth = async (item: RecurringItem) => {
    setActionLoadingId(item.id);
    try {
      await applyRecurringExpenseToMonthAction({
        recurringId: item.id,
        periodId,
        title: item.title,
        amount: item.installmentAmount,
        paidById: item.paidById,
        categoryId: item.categoryId,
        isFromPoolFund: false,
        installmentNumber: item.installmentNumber,
        totalInstallments: item.totalInstallments,
      });
      showToast(`✓ "${item.title}" imputada al mes`);
    } catch (err) {
      console.error(err);
      showToast("Error al imputar la cuota al mes", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnapplyFromMonth = async (item: RecurringItem) => {
    if (!item.appliedExpenseId) return;
    setActionLoadingId(item.id);
    try {
      await unapplyRecurringExpenseAction(item.appliedExpenseId);
      showToast(`✓ "${item.title}" desmarcada del mes`, "info");
    } catch (err) {
      console.error(err);
      showToast("Error al desimputar la cuota", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBatchApply = async () => {
    const pendingItems = applicableThisMonth.filter((r) => !r.alreadyApplied);
    if (pendingItems.length === 0) return;

    setIsBatchApplying(true);
    try {
      await applyAllRecurringExpensesAction(
        periodId,
        pendingItems.map((item) => ({
          recurringId: item.id,
          title: item.title,
          amount: item.installmentAmount,
          paidById: item.paidById,
          categoryId: item.categoryId,
          isFromPoolFund: false,
          installmentNumber: item.installmentNumber,
          totalInstallments: item.totalInstallments,
        }))
      );
      showToast(`✓ ${pendingItems.length} cuotas imputadas al mes`);
    } catch (err) {
      console.error(err);
      showToast("Error al imputar todas las cuotas", "error");
    } finally {
      setIsBatchApplying(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    try {
      await deleteRecurringExpenseAction(id);
      showToast("✓ Plan eliminado");
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar el plan", "error");
    }
  };

  const applicableThisMonth = recurringExpenses.filter((r) => r.isApplicableThisMonth);

  // Totales del mes
  const totalDueThisMonth = applicableThisMonth.reduce(
    (acc, item) => acc + item.installmentAmount,
    0
  );
  const alreadyAppliedThisMonth = applicableThisMonth
    .filter((r) => r.alreadyApplied)
    .reduce((acc, item) => acc + item.installmentAmount, 0);

  const pendingThisMonth = totalDueThisMonth - alreadyAppliedThisMonth;
  const pendingCount = applicableThisMonth.filter((r) => !r.alreadyApplied).length;

  const userA = users[0];
  const userB = users[1];

  const dueByUserA = applicableThisMonth
    .filter((r) => r.paidById === userA?.id)
    .reduce((acc, r) => acc + r.installmentAmount, 0);

  const dueByUserB = applicableThisMonth
    .filter((r) => r.paidById === userB?.id)
    .reduce((acc, r) => acc + r.installmentAmount, 0);

  // Proyección de deuda pendiente global en cuotas futuras
  const totalPendingInstallmentsDebt = recurringExpenses
    .filter((r) => r.totalInstallments && r.isApplicableThisMonth)
    .reduce((acc, r) => {
      const remainingCuotas = Math.max(0, (r.totalInstallments || 0) - r.installmentNumber + 1);
      return acc + remainingCuotas * r.installmentAmount;
    }, 0);

  // Filtrado de la lista activa
  const filteredApplicable = applicableThisMonth.filter((item) => {
    if (activeFilter === "installments") return !!item.totalInstallments;
    if (activeFilter === "fixed") return !item.totalInstallments;
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      <ToastBanner toast={toast} />
      <ConfirmDialog
        isOpen={!!deleteTargetId}
        title="¿Eliminar plan de cuotas / fijo?"
        description="Se eliminará el compromiso futuro pero se conservarán los gastos de meses ya registrados."
        confirmLabel="Sí, eliminar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
      {/* 1. Tarjeta Hero de Compromisos Fijos del Mes (Stripe Style) */}
      <section className="super-card rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        {/* Glow de fondo sutil */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
            Compromisos en {monthName} {currentYear}
          </span>
          <button
            onClick={() => setIsAddingNew(true)}
            className="flex items-center gap-1.5 bg-[#635BFF] hover:bg-[#533AFD] text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-md active:scale-95 transition border border-indigo-400/25"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nueva Cuota</span>
          </button>
        </div>

        <div className="flex items-baseline justify-between mb-4 relative z-10">
          <div>
            <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">Total en Cuotas & Fijos:</span>
            <span className="text-3xl font-extrabold text-white tracking-tight font-mono tabular-nums">
              ${Math.round(totalDueThisMonth).toLocaleString("es-AR")}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-medium text-zinc-400 block mb-1">
              {pendingCount > 0 ? "Pendiente:" : "Estado:"}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold font-mono tabular-nums px-2.5 py-0.5 rounded-full border ${
                pendingCount > 0
                  ? "text-amber-300 bg-amber-500/15 border-amber-500/30"
                  : "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
              }`}
            >
              {pendingCount > 0
                ? `$${Math.round(pendingThisMonth).toLocaleString("es-AR")}`
                : "100% Imputado"}
            </span>
          </div>
        </div>

        {/* Botón de 1-tap: Imputar todas las pendientes */}
        {pendingCount > 0 && (
          <div className="mb-4 pt-1">
            <button
              onClick={handleBatchApply}
              disabled={isBatchApplying}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#635BFF] to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition border border-indigo-400/30"
            >
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>
                {isBatchApplying
                  ? "Imputando cuotas..."
                  : `Imputar todas las cuotas de ${monthName} (${pendingCount} pendientes)`}
              </span>
            </button>
          </div>
        )}

        {/* Desglose por Tarjeta de Titular (Nested Cards SIN línea pegada) */}
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="bg-[#151e33] border border-blue-500/25 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                Tarjeta {userA?.name || "Agus"}
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
            </div>
            <span className="text-base font-extrabold text-white font-mono tabular-nums block mt-1.5">
              ${Math.round(dueByUserA).toLocaleString("es-AR")}
            </span>
          </div>

          <div className="bg-[#241724] border border-rose-500/25 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                Tarjeta {userB?.name || "Pareja"}
              </span>
              <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]" />
            </div>
            <span className="text-base font-extrabold text-white font-mono tabular-nums block mt-1.5">
              ${Math.round(dueByUserB).toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {/* Deuda remanente futura total si hay cuotas */}
        {totalPendingInstallmentsDebt > 0 && (
          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-300">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
              Deuda total remanente en cuotas:
            </span>
            <span className="font-bold text-white font-mono tabular-nums">
              ${Math.round(totalPendingInstallmentsDebt).toLocaleString("es-AR")}
            </span>
          </div>
        )}
      </section>

      {/* 2. Modal Flotante de Creación (iPhone Pro Optimized) */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md super-card rounded-t-[32px] sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar border-t sm:border border-white/10"
          >
            {/* Grabber visual para iOS */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-1 mb-2 sm:hidden" />

            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Nueva Compra o Gasto Fijo
                </h3>
                <span className="text-xs text-zinc-400">
                  Seguimiento automático mes a mes
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Toggle Tipo: Cuotas de Tarjeta vs Débito Fijo */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsInstallmentPlan(true)}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-semibold border transition active:scale-[0.98] ${
                  isInstallmentPlan
                    ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm ring-1 ring-indigo-500/50"
                    : "bg-white/[0.03] border-white/[0.06] text-zinc-400"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>En Cuotas (Tarjeta)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsInstallmentPlan(false)}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-semibold border transition active:scale-[0.98] ${
                  !isInstallmentPlan
                    ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm ring-1 ring-indigo-500/50"
                    : "bg-white/[0.03] border-white/[0.06] text-zinc-400"
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Fijo Mensual</span>
              </button>
            </div>

            {/* Concepto / Título */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 text-center">
                ¿Qué compraron o qué servicio es?
              </label>
              <input
                type="text"
                placeholder="ej: Pasajes, Lavarropas, Alquiler, Wifi"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black/50 border border-white/[0.14] rounded-2xl px-4 py-3 text-white text-sm text-center placeholder:text-center placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-400 focus:outline-none shadow-inner font-medium"
                required
              />
            </div>

            {/* Calculadora Total vs Por Cuota (Solo si es en cuotas) */}
            {isInstallmentPlan && (
              <div className="bg-white/[0.04] border border-white/[0.1] rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                    Modo de carga:
                  </span>
                  <div className="flex gap-1 bg-black/50 p-0.5 rounded-xl border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setCalculationMode("per_installment")}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                        calculationMode === "per_installment"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Por cuota
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalculationMode("total_amount")}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                        calculationMode === "total_amount"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Monto total
                    </button>
                  </div>
                </div>

                {/* Preset Chips de Cuotas */}
                <div>
                  <span className="text-[10px] font-semibold text-zinc-300 block mb-1.5">Cantidad de cuotas:</span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {["3", "6", "9", "12", "18", "custom"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSelectedPresetInstallments(preset)}
                        className={`py-2 rounded-xl text-xs font-bold font-mono transition border ${
                          selectedPresetInstallments === preset
                            ? "bg-indigo-600 text-white border-indigo-400 shadow-md ring-1 ring-indigo-400/50"
                            : "bg-white/[0.05] text-zinc-300 border-white/[0.1] hover:bg-white/[0.1] hover:text-white"
                        }`}
                      >
                        {preset === "custom" ? "Otro" : `${preset}c`}
                      </button>
                    ))}
                  </div>

                  {selectedPresetInstallments === "custom" && (
                    <div className="mt-2">
                      <input
                        type="number"
                        placeholder="Ej: 24 cuotas"
                        value={customInstallments}
                        onChange={(e) => setCustomInstallments(e.target.value)}
                        className="w-full bg-black/50 border border-white/[0.14] rounded-xl px-3 py-2 text-white text-xs font-mono text-center placeholder:text-center placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-500/60 focus:outline-none shadow-inner"
                        min="1"
                        max="120"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input de Monto Centrado con Alto Contraste */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                  {isInstallmentPlan && calculationMode === "total_amount"
                    ? "Monto total de la compra"
                    : "Monto de cada cuota / mes"}
                </label>
                {isInstallmentPlan && calculationMode === "total_amount" && calculatedInstallmentAmount > 0 && (
                  <span className="text-xs text-indigo-300 font-bold font-mono tabular-nums bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-500/30">
                    = ${Math.round(calculatedInstallmentAmount).toLocaleString("es-AR")}/cuota
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Monto en pesos ($)"
                  value={rawAmountInput}
                  onChange={(e) => setRawAmountInput(e.target.value)}
                  className="w-full bg-black/50 border border-white/[0.14] rounded-2xl px-4 py-3 text-white text-lg font-mono tabular-nums text-center placeholder:text-center placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-400 shadow-inner font-bold"
                  required
                />
              </div>
            </div>

            {/* Mes de Inicio */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Mes de inicio
                </label>
                <select
                  value={startMonthInput}
                  onChange={(e) => setStartMonthInput(parseInt(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/[0.14] rounded-xl px-3 py-2.5 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1} className="bg-zinc-900 text-white">
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Año
                </label>
                <select
                  value={startYearInput}
                  onChange={(e) => setStartYearInput(parseInt(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/[0.14] rounded-xl px-3 py-2.5 text-white text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                    <option key={yr} value={yr} className="bg-zinc-900 text-white">
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Titular de la tarjeta (Agus o Pareja) */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                ¿Con la tarjeta de quién?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {users.slice(0, 2).map((u, idx) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedPayerId(u.id)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border text-center truncate transition active:scale-[0.97] ${
                      selectedPayerId === u.id
                        ? idx === 0
                          ? "bg-blue-600/35 border-blue-400 text-blue-200 ring-1 ring-blue-400/60 shadow-md"
                          : "bg-rose-600/35 border-rose-400 text-rose-200 ring-1 ring-rose-400/60 shadow-md"
                        : "bg-white/[0.05] border-white/[0.1] text-zinc-300 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de Categoría */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Categoría
              </label>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition ${
                      selectedCategoryId === c.id
                        ? "bg-white text-zinc-950 border-white shadow-md font-bold"
                        : "bg-white/[0.05] text-zinc-200 border-white/[0.1] hover:bg-white/[0.1] hover:text-white"
                    }`}
                  >
                    <CategoryIcon name={c.name} className="w-3.5 h-3.5" />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition border border-indigo-400/20"
            >
              {isSubmitting ? "Guardando..." : "Guardar y Comenzar Seguimiento"}
            </button>
          </form>
        </div>
      )}

      {/* 3. Cuotas que tocan pagar en este mes */}
      <div className="super-card rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Cuotas de {monthName} {currentYear} ({applicableThisMonth.length})
          </h3>
          <span className="text-[11px] text-zinc-500 font-mono">
            {applicableThisMonth.filter((r) => r.alreadyApplied).length}/{applicableThisMonth.length} imputadas
          </span>
        </div>

        {/* Filtros visuales: Todas, Cuotas, Fijos */}
        {applicableThisMonth.length > 0 && (
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition border ${
                activeFilter === "all"
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              Todas ({applicableThisMonth.length})
            </button>
            <button
              onClick={() => setActiveFilter("installments")}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition border ${
                activeFilter === "installments"
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              Cuotas ({applicableThisMonth.filter((r) => !!r.totalInstallments).length})
            </button>
            <button
              onClick={() => setActiveFilter("fixed")}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition border ${
                activeFilter === "fixed"
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              Fijos ({applicableThisMonth.filter((r) => !r.totalInstallments).length})
            </button>
          </div>
        )}

        {applicableThisMonth.length === 0 ? (
          /* Empty State SuperDesign */
          <div className="super-card-subtle rounded-2xl p-6 text-center space-y-3 my-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">
                Sin cuotas programadas para {monthName}
              </p>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Anoten compras con tarjeta de crédito en 3, 6 o 12 cuotas, o débitos fijos como alquiler y wifi para que se computen automáticamente.
              </p>
            </div>
            <button
              onClick={() => setIsAddingNew(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-95 transition border border-indigo-400/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cargar Primera Cuota</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApplicable.map((item) => {
              const isAgus = item.paidById === userA?.id;
              const hasInstallments = !!item.totalInstallments;
              const progressPct = hasInstallments
                ? Math.min(100, Math.round((item.installmentNumber / (item.totalInstallments || 1)) * 100))
                : 100;
              const remainingCount = hasInstallments
                ? Math.max(0, (item.totalInstallments || 0) - item.installmentNumber)
                : 0;

              return (
                <div
                  key={item.id}
                  className="super-card-subtle rounded-2xl p-4 transition-all duration-150 hover:border-white/[0.12] space-y-3.5"
                >
                  {/* Top Row: Icon + Title & Subtitle + Amount */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-zinc-200 shrink-0 shadow-sm">
                        <CategoryIcon name={item.category.name} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{item.title}</span>
                          <span
                            className={`font-bold text-[10px] px-2.5 py-0.5 rounded-full border shrink-0 ${
                              isAgus
                                ? "bg-blue-500/15 text-blue-300 border-blue-400/30"
                                : "bg-rose-500/15 text-rose-300 border-rose-400/30"
                            }`}
                          >
                            {item.paidBy.name}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5 font-medium flex items-center gap-1.5 truncate">
                          <span className="text-indigo-300 font-semibold font-mono tabular-nums">
                            {hasInstallments
                              ? `Cuota ${item.installmentNumber} de ${item.totalInstallments}`
                              : "Débito mensual fijo"}
                          </span>
                          <span>•</span>
                          <span>{item.category.name}</span>
                          {hasInstallments && (
                            <>
                              <span>•</span>
                              <span>{remainingCount === 0 ? "¡Última cuota!" : `Faltan ${remainingCount}c`}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-extrabold text-white font-mono tabular-nums block">
                        ${Math.round(item.installmentAmount).toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progreso de la Cuota (Solo si son cuotas) */}
                  {hasInstallments && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="w-full bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                        <span>{progressPct}% pagado</span>
                        <span>
                          Total: $
                          {Math.round(
                            item.installmentAmount * (item.totalInstallments || 1)
                          ).toLocaleString("es-AR")}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Fila de Acción e Imputación: limpia, sin líneas pegadas */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      {item.alreadyApplied ? "Cargado al presupuesto del mes" : "Pendiente de cargar"}
                    </span>

                    <div className="flex items-center gap-2">
                      {item.alreadyApplied ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/30">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            Imputada al mes
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnapplyFromMonth(item)}
                            disabled={actionLoadingId === item.id}
                            className="text-xs text-zinc-400 hover:text-rose-400 transition ml-1 underline underline-offset-2"
                          >
                            Deshacer
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplyToMonth(item)}
                          disabled={actionLoadingId === item.id}
                          className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#533AFD] px-3.5 py-1.5 rounded-xl active:scale-95 transition shadow-sm border border-indigo-400/25"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{actionLoadingId === item.id ? "Cargando..." : "Imputar al mes"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Listado General de Cuotas y Planes Activos (Stripe Cards) */}
      <div className="super-card rounded-3xl p-5 shadow-lg space-y-3">
        <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
          Todos los Planes Activos Registrados ({recurringExpenses.length})
        </h3>

        {recurringExpenses.length === 0 ? (
          <p className="text-xs text-zinc-400 italic py-1">No hay planes registrados todavía.</p>
        ) : (
          <div className="space-y-2.5">
            {recurringExpenses.map((r) => {
              const isAgus = r.paidById === userA?.id;

              return (
                <div
                  key={r.id}
                  className="bg-[#151d30]/60 hover:bg-[#151d30] border border-white/[0.07] rounded-2xl p-3.5 flex items-center justify-between transition group"
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-100 font-bold text-xs truncate">{r.title}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          isAgus
                            ? "bg-blue-500/15 text-blue-300 border-blue-400/30"
                            : "bg-rose-500/15 text-rose-300 border-rose-400/30"
                        }`}
                      >
                        {r.paidBy.name}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-[11px] font-mono tabular-nums">
                      ${Math.round(r.installmentAmount).toLocaleString("es-AR")}/mes •{" "}
                      {r.totalInstallments ? `${r.totalInstallments} cuotas` : "Mensual fijo"} • Desde{" "}
                      {MONTH_NAMES[r.startMonth - 1]} {r.startYear}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-2 text-zinc-400 hover:text-rose-400 active:scale-90 transition rounded-xl hover:bg-rose-500/10 shrink-0"
                    title="Eliminar cuota"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
