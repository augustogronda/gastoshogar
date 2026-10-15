"use client";

import React, { useState } from "react";
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
} from "./ui/icons";
import { CategoryIcon } from "./ui/icons";
import { QuickExpenseModal } from "./QuickExpenseModal";
import { SalaryConfigModal } from "./SalaryConfigModal";
import { FCIInvestModal } from "./FCIInvestModal";
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

export function DashboardClient({ initialData }: DashboardClientProps) {
  const { household, users, categories, period, poolSummary, investmentFund, currentYear, currentMonth } = initialData;

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isFCIModalOpen, setIsFCIModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const userA = poolSummary.memberBalances[0] || { name: users[0]?.name || "Él", outOfPocketPaid: 0, committedAmount: 0, fciQuotaSharePct: 50 };
  const userB = poolSummary.memberBalances[1] || { name: users[1]?.name || "Ella", outOfPocketPaid: 0, committedAmount: 0, fciQuotaSharePct: 50 };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between">
      {/* Contenedor optimizado para pantalla de iPhone 15/16 Pro */}
      <main className="w-full max-w-md mx-auto px-4 pt-safe pb-32 flex-1 flex flex-col gap-5">
        
        {/* Cabecera Superior (Mes & Botón de Ajuste de Sueldos) */}
        <header className="flex items-center justify-between pt-2">
          <div>
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold block">
              Fondo Común 60%
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </h1>
            </div>
          </div>

          <button
            onClick={() => setIsSalaryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 active:scale-95 transition"
          >
            <Settings className="w-3.5 h-3.5 text-blue-400" />
            <span>Sueldos</span>
          </button>
        </header>

        {/* Tarjeta Principal: Termómetro del Fondo Común */}
        <section className="bg-gradient-to-br from-zinc-900 to-zinc-900/90 border border-zinc-800/90 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-blue-400" />
              Presupuesto del Hogar
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium border border-zinc-700/50">
              {Math.round(poolSummary.burnRatePct)}% consumido
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-4">
            <div>
              <span className="text-xs text-zinc-400 block mb-0.5">Gastado hasta hoy:</span>
              <span className="text-3xl font-extrabold text-white tracking-tight">
                ${Math.round(poolSummary.totalExpenses).toLocaleString("es-AR")}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-zinc-400 block mb-0.5">Fondo total (60%):</span>
              <span className="text-lg font-semibold text-zinc-300">
                ${Math.round(poolSummary.totalCommittedPool).toLocaleString("es-AR")}
              </span>
            </div>
          </div>

          {/* Barra de Progreso del Fondo */}
          <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full transition-all duration-500 rounded-full ${burnRateColor}`}
              style={{ width: `${Math.min(100, poolSummary.burnRatePct)}%` }}
            />
          </div>

          {/* Banner de Remanente para FCI */}
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

        {/* Tarjeta de Balances y Compensación Mensual */}
        <section className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-5 shadow-lg">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-pink-400" />
            Aportes y Gastos de Bolsillo
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* User A */}
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

            {/* User B */}
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

          {/* Sugerencia de Compensación */}
          {poolSummary.settlementSuggestion.amount > 0 ? (
            <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-3 text-xs text-blue-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-blue-300">Compensación Sugerida:</span>
                <p className="mt-0.5 text-zinc-300">{poolSummary.settlementSuggestion.explanation}</p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-400 text-center py-1">
              Las cuentas van parejas este mes.
            </div>
          )}
        </section>

        {/* Tarjeta de Patrimonio FCI Pareja */}
        {investmentFund && (
          <section
            onClick={() => setIsFCIModalOpen(true)}
            className="cursor-pointer bg-gradient-to-r from-emerald-950/30 via-zinc-900 to-zinc-900 border border-emerald-900/30 rounded-3xl p-4 flex items-center justify-between hover:border-emerald-700/50 transition active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-zinc-400 block">Total en FCI Pareja</span>
                <span className="text-xl font-extrabold text-white">
                  ${Math.round(investmentFund.currentValue).toLocaleString("es-AR")}
                </span>
              </div>
            </div>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/40">
              Ver FCI
            </span>
          </section>
        )}

        {/* Lista de Gastos del Mes */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Gastos Anotados ({period.expenses.length})
            </h2>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 active:scale-95"
            >
              + Agregar
            </button>
          </div>

          {period.expenses.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 text-center">
              <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-300">No hay gastos anotados todavía</p>
              <p className="text-xs text-zinc-500 mt-1">
                Tocá el botón central <span className="text-blue-400 font-semibold">+</span> para registrar el primero.
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
                            className={`font-medium ${
                              exp.isFromPoolFund
                                ? "text-emerald-400"
                                : exp.paidBy.id === users[0]?.id
                                ? "text-blue-400"
                                : "text-pink-400"
                            }`}
                          >
                            {exp.isFromPoolFund ? "Fondo Común" : `Pagó ${exp.paidBy.name}`}
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
      </main>

      {/* Barra de Navegación Inferior (iOS Tab Bar fija con Safe Area) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 pb-safe">
        <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between relative">
          
          {/* Tab 1: Dashboard */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex flex-col items-center gap-1 text-blue-400 active:scale-95 transition"
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Hogar</span>
          </button>

          {/* Botón Central Flotante Táctil (+ GASTO - Ergonómico para Pulgar de iPhone) */}
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 active:scale-90 transition border-4 border-zinc-950"
            aria-label="Cargar Gasto"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>

          {/* Tab 2: FCI / Ahorro */}
          <button
            onClick={() => setIsFCIModalOpen(true)}
            className="flex flex-col items-center gap-1 text-zinc-400 hover:text-emerald-400 active:scale-95 transition"
          >
            <PiggyBank className="w-5 h-5" />
            <span className="text-[10px] font-semibold">FCI</span>
          </button>

          {/* Tab 3: Ajustes / Sueldos */}
          <button
            onClick={() => setIsSalaryModalOpen(true)}
            className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:scale-95 transition"
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Ajustes</span>
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
