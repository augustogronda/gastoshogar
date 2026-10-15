"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  Plus,
  Trash2,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Users,
  CreditCard,
  BarChart3,
  Repeat,
} from "./ui/icons";
import { CategoryIcon } from "./ui/icons";
import { QuickExpenseModal } from "./QuickExpenseModal";
import { SalaryConfigModal } from "./SalaryConfigModal";
import { FCIInvestModal } from "./FCIInvestModal";
import { MonthlyAnalyticsView } from "./MonthlyAnalyticsView";
import { InstallmentsManagerView } from "./InstallmentsManagerView";
import { deleteExpenseAction } from "@/app/actions";

interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  date: Date | string;
  paidBy: { id: string; name: string };
  category: { id: string; name: string; icon?: string | null; color?: string | null };
  isFromPoolFund: boolean;
  notes?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
}

interface DashboardClientProps {
  initialData: {
    household: { id: string; name: string; currency: string };
    users: Array<{ id: string; name: string; avatarColor: string }>;
    categories: Array<{ id: string; name: string; icon?: string | null; color?: string | null }>;
    period: {
      id: string;
      year: number;
      month: number;
      incomes: Array<{ userId: string; amount: number; contributionPct: number; targetPoolAmount: number }>;
      expenses: ExpenseItem[];
      investmentTransfer: { id: string; amount: number } | null;
    };
    poolSummary: {
      totalSalaries: number;
      totalCommittedPool: number;
      totalExpenses: number;
      remainingPool: number;
      burnRatePct: number;
      memberBalances: Array<{
        userId: string;
        name: string;
        committedAmount: number;
        outOfPocketPaid: number;
        netBalance: number;
        fciQuotaSharePct: number;
      }>;
      settlementSuggestion: {
        fromUserId?: string;
        fromUserName?: string;
        toUserId?: string;
        toUserName?: string;
        amount: number;
        explanation: string;
      };
    };
    investmentFund: {
      id: string;
      name: string;
      currentValue: number;
      contributions: Array<{ id: string; amount: number; investedAt: Date | string }>;
    } | null;
    recurringExpenses: Array<any>;
    currentYear: number;
    currentMonth: number;
  };
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const SHORT_MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"
];

type ActiveTab = "hogar" | "analisis" | "cuotas" | "fci";

export function DashboardClient({ initialData }: DashboardClientProps) {
  const router = useRouter();
  const {
    household,
    users,
    categories,
    period,
    poolSummary,
    investmentFund,
    recurringExpenses,
    currentYear,
    currentMonth,
  } = initialData;

  const [activeTab, setActiveTab] = useState<ActiveTab>("hogar");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isFCIModalOpen, setIsFCIModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Navegación de meses
  const handlePrevMonth = () => {
    const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
    router.push(`/?year=${prevY}&month=${prevM}`);
  };

  const handleNextMonth = () => {
    const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
    router.push(`/?year=${nextY}&month=${nextM}`);
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm("¿Eliminar este gasto?")) {
      setDeletingId(id);
      try {
        await deleteExpenseAction(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const burnRateColor =
    poolSummary.burnRatePct > 90
      ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]"
      : poolSummary.burnRatePct > 70
      ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
      : "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]";

  const userA = poolSummary.memberBalances[0] || {
    name: users[0]?.name || "Agus",
    outOfPocketPaid: 0,
    committedAmount: 0,
    fciQuotaSharePct: 50,
  };
  const userB = poolSummary.memberBalances[1] || {
    name: users[1]?.name || "Pareja",
    outOfPocketPaid: 0,
    committedAmount: 0,
    fciQuotaSharePct: 50,
  };

  const monthLabel = MONTH_NAMES[currentMonth - 1];

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col justify-between selection:bg-blue-600/30">
      {/* Contenedor mobile-first refinado */}
      <main className="w-full max-w-md mx-auto px-4 pt-safe pb-28 flex-1 flex flex-col gap-4">
        
        {/* Cabecera Superior: Selector de Mes Estilo Cápsula Dynamic Island */}
        <header className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-white/[0.08] px-2 py-1 rounded-full shadow-inner">
            <button
              onClick={handlePrevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-zinc-400 hover:text-white active:scale-90 transition duration-150"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold text-white px-1 tracking-tight">
              {monthLabel} {currentYear}
            </span>

            <button
              onClick={handleNextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-zinc-400 hover:text-white active:scale-90 transition duration-150"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 active:scale-95 transition duration-150 border border-blue-400/20"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Gasto</span>
            </button>

            <button
              onClick={() => setIsSalaryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition duration-150"
            >
              <Settings className="w-3.5 h-3.5 text-blue-400" />
              <span>Sueldos</span>
            </button>
          </div>
        </header>

        {/* CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}

        {/* TAB 1: HOGAR / GASTOS PRINCIPALES */}
        {activeTab === "hogar" && (
          <div className="space-y-4 animate-fade-in">
            {/* Tarjeta Principal: Termómetro del Fondo Común (Obsidian Glass) */}
            <section className="super-card rounded-3xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-blue-400" />
                  Presupuesto Común (60%)
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 font-semibold border border-white/[0.08] tabular-nums">
                  {Math.round(poolSummary.burnRatePct)}% gastado
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <span className="text-[11px] text-zinc-400 block mb-0.5">Gastado:</span>
                  <span className="text-3xl font-extrabold text-white tracking-tight font-mono tabular-nums">
                    ${Math.round(poolSummary.totalExpenses).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-zinc-400 block mb-0.5">Fondo (60%):</span>
                  <span className="text-base font-semibold text-zinc-400 font-mono tabular-nums">
                    ${Math.round(poolSummary.totalCommittedPool).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Barra de Progreso SuperDesign */}
              <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden mb-4 p-0.5 border border-white/[0.05]">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${burnRateColor}`}
                  style={{ width: `${Math.min(100, poolSummary.burnRatePct)}%` }}
                />
              </div>

              {/* Banner Remanente para Invertir en FCI */}
              <div
                onClick={() => setIsFCIModalOpen(true)}
                className="cursor-pointer bg-emerald-950/30 hover:bg-emerald-900/30 border border-emerald-500/20 rounded-2xl p-3.5 flex items-center justify-between transition-all duration-150 active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 block">
                      Remanente para FCI
                    </span>
                    <span className="text-lg font-bold text-white font-mono tabular-nums">
                      ${Math.round(poolSummary.remainingPool).toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                  <span>Invertir</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </section>

            {/* Balances de Bolsillo (Agus & Pareja) */}
            <section className="super-card rounded-3xl p-5">
              <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-rose-400" />
                Desembolsos de Bolsillo
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* User A (Agus) */}
                <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 truncate">
                      {userA.name}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                  </div>
                  <span className="text-xl font-extrabold text-white block mt-1.5 font-mono tabular-nums">
                    ${Math.round(userA.outOfPocketPaid).toLocaleString("es-AR")}
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5 font-mono tabular-nums">
                    Meta 60%: ${Math.round(userA.committedAmount).toLocaleString("es-AR")}
                  </span>
                </div>

                {/* User B (Pareja) */}
                <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-400 truncate">
                      {userB.name}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
                  </div>
                  <span className="text-xl font-extrabold text-white block mt-1.5 font-mono tabular-nums">
                    ${Math.round(userB.outOfPocketPaid).toLocaleString("es-AR")}
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5 font-mono tabular-nums">
                    Meta 60%: ${Math.round(userB.committedAmount).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Compensación Sugerida */}
              {poolSummary.settlementSuggestion.amount > 0 ? (
                <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-3.5 text-xs text-blue-200 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-blue-300">Nivelación sugerida:</span>
                    <p className="mt-0.5 text-zinc-300 leading-relaxed">
                      {poolSummary.settlementSuggestion.explanation}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-zinc-400 text-center py-1">
                  Gastos nivelados proporcionalmente al 60% este mes.
                </div>
              )}
            </section>

            {/* Lista de Gastos */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Gastos de {monthLabel} ({period.expenses.length})
                </h2>
                <button
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 active:scale-95 flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Anotar Gasto</span>
                </button>
              </div>

              {period.expenses.length === 0 ? (
                <div className="super-card rounded-2xl p-8 text-center">
                  <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-medium text-zinc-300">No hay gastos en este mes</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Tocá el botón <span className="text-blue-400 font-semibold">+ Gasto</span> para cargar el primero.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {period.expenses.map((exp) => {
                    const dateObj = new Date(exp.date);
                    const dateStr = `${dateObj.getDate()} ${SHORT_MONTHS[dateObj.getMonth()] || ""}`;
                    const isAgus = exp.paidBy.id === users[0]?.id;

                    return (
                      <div
                        key={exp.id}
                        className="super-card-subtle rounded-2xl p-3.5 flex items-center justify-between hover:bg-white/[0.03] transition duration-150"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-white/[0.08] flex items-center justify-center text-zinc-300 shadow-sm">
                            <CategoryIcon name={exp.category.name} className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-white block">
                              {exp.title}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-400">
                              <span>{dateStr}</span>
                              <span>•</span>
                              <span
                                className={`font-semibold px-2 py-0.5 rounded-full text-[10px] border ${
                                  isAgus
                                    ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                                    : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                                }`}
                              >
                                Pagó {exp.paidBy.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-white font-mono tabular-nums">
                            ${Math.round(exp.amount).toLocaleString("es-AR")}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            disabled={deletingId === exp.id}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 active:scale-90 transition"
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

        {/* TAB 2: ANÁLISIS MENSUAL */}
        {activeTab === "analisis" && (
          <MonthlyAnalyticsView
            monthName={monthLabel}
            year={currentYear}
            totalSpent={poolSummary.totalExpenses}
            totalCommittedPool={poolSummary.totalCommittedPool}
            remainingPool={poolSummary.remainingPool}
            burnRatePct={poolSummary.burnRatePct}
            expenses={period.expenses}
            users={users}
          />
        )}

        {/* TAB 3: CUOTAS & GASTOS RECURRENTES */}
        {activeTab === "cuotas" && (
          <InstallmentsManagerView
            periodId={period.id}
            currentYear={currentYear}
            currentMonth={currentMonth}
            monthName={monthLabel}
            recurringExpenses={recurringExpenses}
            users={users}
            categories={categories}
          />
        )}

        {/* TAB 4: FCI INVERSIÓN */}
        {activeTab === "fci" && (
          <div className="space-y-4 animate-fade-in">
            <div className="super-card rounded-3xl p-5 shadow-xl relative overflow-hidden">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                Fondo Común de Inversión Pareja
              </span>
              <span className="text-3xl font-extrabold text-white block mt-2 font-mono tabular-nums">
                ${Math.round(investmentFund?.currentValue || 0).toLocaleString("es-AR")}
              </span>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Patrimonio acumulado con los remanentes mensuales del 60%.
              </p>
              <button
                onClick={() => setIsFCIModalOpen(true)}
                className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-semibold shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition duration-150"
              >
                Gestionar Ahorro e Inversión
              </button>
            </div>

            {/* Historial de Aportes al FCI */}
            <div className="super-card rounded-3xl p-5">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Historial de Remanentes Invertidos
              </h3>
              {!investmentFund?.contributions || investmentFund.contributions.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">
                  Aún no se han transferido remanentes al FCI.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {investmentFund.contributions.map((c) => {
                    const d = new Date(c.investedAt);
                    return (
                      <div
                        key={c.id}
                        className="flex justify-between items-center text-xs py-2 border-b border-white/[0.06] last:border-0"
                      >
                        <span className="text-zinc-300 font-medium">
                          Traspaso {d.getDate()}/{d.getMonth() + 1}/{d.getFullYear()}
                        </span>
                        <span className="font-bold text-emerald-400 font-mono tabular-nums">
                          +${Math.round(c.amount).toLocaleString("es-AR")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Barra de Navegación Inferior (iOS Tab Bar Limpia y Equilibrada con 4 pestañas) */}
      <nav
        className="super-nav fixed bottom-0 left-0 right-0 z-30"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          className="w-full max-w-md mx-auto px-3"
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: "58px",
          }}
        >
          {/* Tab 1: Hogar */}
          <button
            type="button"
            onClick={() => setActiveTab("hogar")}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
            className={`transition duration-150 active:scale-95 ${
              activeTab === "hogar"
                ? "text-blue-400 font-semibold"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Wallet className="w-5 h-5 mb-1 stroke-[1.8]" />
            <span className="text-[10px] tracking-wider uppercase leading-none font-medium">
              Hogar
            </span>
          </button>

          {/* Tab 2: Análisis */}
          <button
            type="button"
            onClick={() => setActiveTab("analisis")}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
            className={`transition duration-150 active:scale-95 ${
              activeTab === "analisis"
                ? "text-purple-400 font-semibold"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-1 stroke-[1.8]" />
            <span className="text-[10px] tracking-wider uppercase leading-none font-medium">
              Análisis
            </span>
          </button>

          {/* Tab 3: Cuotas */}
          <button
            type="button"
            onClick={() => setActiveTab("cuotas")}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
            className={`transition duration-150 active:scale-95 ${
              activeTab === "cuotas"
                ? "text-indigo-400 font-semibold"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <CreditCard className="w-5 h-5 mb-1 stroke-[1.8]" />
            <span className="text-[10px] tracking-wider uppercase leading-none font-medium">
              Cuotas
            </span>
          </button>

          {/* Tab 4: FCI */}
          <button
            type="button"
            onClick={() => setActiveTab("fci")}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
            className={`transition duration-150 active:scale-95 ${
              activeTab === "fci"
                ? "text-emerald-400 font-semibold"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <PiggyBank className="w-5 h-5 mb-1 stroke-[1.8]" />
            <span className="text-[10px] tracking-wider uppercase leading-none font-medium">
              FCI
            </span>
          </button>
        </div>
      </nav>

      {/* Modales */}
      <QuickExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        periodId={period.id}
        users={users}
        categories={categories}
      />

      <SalaryConfigModal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        periodId={period.id}
        monthName={monthLabel}
        year={currentYear}
        users={users}
        incomes={period.incomes}
      />

      <FCIInvestModal
        isOpen={isFCIModalOpen}
        onClose={() => setIsFCIModalOpen(false)}
        periodId={period.id}
        fundId={investmentFund?.id}
        fundName={investmentFund?.name}
        currentFundValue={investmentFund?.currentValue || 0}
        surplusAmount={poolSummary.remainingPool}
        isAlreadyTransferred={!!period.investmentTransfer}
        userABalance={{ name: userA.name, quotaPct: userA.fciQuotaSharePct }}
        userBBalance={{ name: userB.name, quotaPct: userB.fciQuotaSharePct }}
      />
    </div>
  );
}
