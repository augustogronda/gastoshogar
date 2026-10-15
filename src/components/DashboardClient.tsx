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
      ? "bg-red-500"
      : poolSummary.burnRatePct > 70
      ? "bg-amber-500"
      : "bg-emerald-500";

  const userA = poolSummary.memberBalances[0] || {
    name: users[0]?.name || "Él",
    outOfPocketPaid: 0,
    committedAmount: 0,
    fciQuotaSharePct: 50,
  };
  const userB = poolSummary.memberBalances[1] || {
    name: users[1]?.name || "Ella",
    outOfPocketPaid: 0,
    committedAmount: 0,
    fciQuotaSharePct: 50,
  };

  const monthLabel = MONTH_NAMES[currentMonth - 1];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between">
      {/* Contenedor optimizado para iPhone 15/16 Pro */}
      <main className="w-full max-w-md mx-auto px-4 pt-safe pb-28 flex-1 flex flex-col gap-4">
        
        {/* Cabecera Superior: Selector de Mes con Flechas y Botón de Sueldos */}
        <header className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">
                Finanzas del Hogar
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
                {monthLabel} {currentYear}
              </h1>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-md active:scale-95 transition"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Gasto</span>
            </button>

            <button
              onClick={() => setIsSalaryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 active:scale-95 transition"
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
            {/* Tarjeta Principal: Termómetro del Fondo Común */}
            <section className="bg-gradient-to-br from-zinc-900 to-zinc-900/90 border border-zinc-800/90 rounded-3xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-blue-400" />
                  Presupuesto Común (60%)
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium border border-zinc-700/50">
                  {Math.round(poolSummary.burnRatePct)}% gastado
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <span className="text-xs text-zinc-400 block mb-0.5">Gastado:</span>
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    ${Math.round(poolSummary.totalExpenses).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-400 block mb-0.5">Fondo disponible:</span>
                  <span className="text-lg font-semibold text-zinc-300">
                    ${Math.round(poolSummary.totalCommittedPool).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Barra de Progreso */}
              <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${burnRateColor}`}
                  style={{ width: `${Math.min(100, poolSummary.burnRatePct)}%` }}
                />
              </div>

              {/* Banner Remanente FCI */}
              <div
                onClick={() => setIsFCIModalOpen(true)}
                className="cursor-pointer bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/40 rounded-2xl p-3 flex items-center justify-between transition active:scale-98"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block">
                      Remanente para FCI
                    </span>
                    <span className="text-base font-bold text-white">
                      ${Math.round(poolSummary.remainingPool).toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                  <span>Invertir</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </section>

            {/* Balances y Compensación */}
            <section className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-5 shadow-lg">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-pink-400" />
                Gastos del Bolsillo de Cada Uno
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-2xl p-3">
                  <span className="text-xs font-semibold text-blue-400 block truncate">
                    {userA.name}
                  </span>
                  <span className="text-lg font-bold text-white block mt-1">
                    ${Math.round(userA.outOfPocketPaid).toLocaleString("es-AR")}
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    Meta 60%: ${Math.round(userA.committedAmount).toLocaleString("es-AR")}
                  </span>
                </div>

                <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-2xl p-3">
                  <span className="text-xs font-semibold text-pink-400 block truncate">
                    {userB.name}
                  </span>
                  <span className="text-lg font-bold text-white block mt-1">
                    ${Math.round(userB.outOfPocketPaid).toLocaleString("es-AR")}
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    Meta 60%: ${Math.round(userB.committedAmount).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {poolSummary.settlementSuggestion.amount > 0 ? (
                <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-3 text-xs text-blue-200 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-blue-300">Compensación:</span>
                    <p className="mt-0.5 text-zinc-300">
                      {poolSummary.settlementSuggestion.explanation}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-zinc-400 text-center py-1">
                  Gastos nivelados al 60% proporcional este mes.
                </div>
              )}
            </section>

            {/* Lista de Gastos */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Gastos de {monthLabel} ({period.expenses.length})
                </h2>
                <button
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 active:scale-95 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Anotar Gasto</span>
                </button>
              </div>

              {period.expenses.length === 0 ? (
                <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 text-center">
                  <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-zinc-300">No hay gastos en este mes</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Tocá el botón <span className="text-blue-400 font-semibold">+ Anotar Gasto</span> para cargar uno.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {period.expenses.map((exp) => {
                    const dateObj = new Date(exp.date);
                    const dateStr = `${dateObj.getDate()} ${SHORT_MONTHS[dateObj.getMonth()] || ""}`;

                    return (
                      <div
                        key={exp.id}
                        className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 rounded-2xl p-3.5 flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-200">
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
                                className={`font-semibold ${
                                  exp.paidBy.id === users[0]?.id
                                    ? "text-blue-400"
                                    : "text-pink-400"
                                }`}
                              >
                                Pagó {exp.paidBy.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-white">
                            ${Math.round(exp.amount).toLocaleString("es-AR")}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            disabled={deletingId === exp.id}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 active:scale-95 transition"
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
            <div className="bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-800/40 rounded-3xl p-5 shadow-xl">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                Fondo Común de Inversión Pareja
              </span>
              <span className="text-3xl font-extrabold text-white block mt-2">
                ${Math.round(investmentFund?.currentValue || 0).toLocaleString("es-AR")}
              </span>
              <p className="text-xs text-zinc-400 mt-2">
                Patrimonio acumulado con los remanentes mensuales del 60%.
              </p>
              <button
                onClick={() => setIsFCIModalOpen(true)}
                className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-semibold shadow-md active:scale-95 transition"
              >
                Gestionar Ahorro e Inversión
              </button>
            </div>

            {/* Historial de Aportes al FCI */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 shadow-lg">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
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
                        className="flex justify-between items-center text-xs py-2 border-b border-zinc-800/60 last:border-0"
                      >
                        <span className="text-zinc-300 font-medium">
                          Traspaso {d.getDate()}/{d.getMonth() + 1}/{d.getFullYear()}
                        </span>
                        <span className="font-bold text-emerald-400">
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
        className="fixed bottom-0 left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          className="w-full max-w-md mx-auto px-2"
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
            className={`transition active:scale-95 ${
              activeTab === "hogar" ? "text-blue-400 font-semibold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Wallet className="w-5 h-5 mb-1" />
            <span className="text-[11px] tracking-tight leading-none">Hogar</span>
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
            className={`transition active:scale-95 ${
              activeTab === "analisis" ? "text-purple-400 font-semibold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-1" />
            <span className="text-[11px] tracking-tight leading-none">Análisis</span>
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
            className={`transition active:scale-95 ${
              activeTab === "cuotas" ? "text-indigo-400 font-semibold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <CreditCard className="w-5 h-5 mb-1" />
            <span className="text-[11px] tracking-tight leading-none">Cuotas</span>
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
            className={`transition active:scale-95 ${
              activeTab === "fci" ? "text-emerald-400 font-semibold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <PiggyBank className="w-5 h-5 mb-1" />
            <span className="text-[11px] tracking-tight leading-none">FCI</span>
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
