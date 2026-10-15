"use client";

import React from "react";
import { CategoryIcon, PieChart, TrendingUp, AlertCircle, Sparkles, User, Wallet } from "./ui/icons";

interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  paidBy: { id: string; name: string };
  category: { id: string; name: string; color?: string | null };
  isFromPoolFund: boolean;
}

interface MonthlyAnalyticsViewProps {
  monthName: string;
  year: number;
  totalSpent: number;
  totalAvailablePool: number;
  remainingPool: number;
  burnRatePct: number;
  expenses: ExpenseItem[];
  users: Array<{ id: string; name: string }>;
}

export function MonthlyAnalyticsView({
  monthName,
  year,
  totalSpent,
  totalAvailablePool,
  remainingPool,
  burnRatePct,
  expenses,
  users,
}: MonthlyAnalyticsViewProps) {
  // Agrupar gastos por categoría
  const categoryTotals: Record<string, { name: string; amount: number; count: number; color?: string | null }> = {};

  for (const exp of expenses) {
    const catName = exp.category.name;
    if (!categoryTotals[catName]) {
      categoryTotals[catName] = {
        name: catName,
        amount: 0,
        count: 0,
        color: exp.category.color,
      };
    }
    categoryTotals[catName].amount += exp.amount;
    categoryTotals[catName].count += 1;
  }

  const sortedCategories = Object.values(categoryTotals).sort((a, b) => b.amount - a.amount);

  // Agrupar gastos por pagador (Agus vs Pareja)
  const payerTotals: Record<string, { name: string; amount: number }> = {};
  for (const u of users) {
    payerTotals[u.id] = { name: u.name, amount: 0 };
  }

  for (const exp of expenses) {
    if (payerTotals[exp.paidBy.id]) {
      payerTotals[exp.paidBy.id].amount += exp.amount;
    }
  }

  const averageExpense = expenses.length > 0 ? Math.round(totalSpent / expenses.length) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Tarjeta de Diagnóstico Mensual (Obsidian Glass) */}
      <div className="super-card rounded-3xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-purple-400" />
            Análisis de {monthName} {year}
          </span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white font-bold border border-white/[0.12] tabular-nums">
            {expenses.length} gastos
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 shadow-sm">
            <span className="text-[11px] font-medium text-zinc-300 block">Total Gastado</span>
            <span className="text-xl font-bold text-white mt-1 block font-mono tabular-nums">
              ${Math.round(totalSpent).toLocaleString("es-AR")}
            </span>
            <span className="text-[10px] text-zinc-400 font-medium block mt-0.5 tabular-nums">
              {Math.round(burnRatePct)}% del fondo del 60%
            </span>
          </div>

          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 shadow-sm">
            <span className="text-[11px] font-medium text-zinc-300 block">Ticket Promedio</span>
            <span className="text-xl font-bold text-white mt-1 block font-mono tabular-nums">
              ${averageExpense.toLocaleString("es-AR")}
            </span>
            <span className="text-[10px] text-zinc-400 font-medium block mt-0.5">
              por cada compra
            </span>
          </div>
        </div>

        {/* Diagnóstico Inteligente */}
        <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-3.5 flex items-start gap-2.5 shadow-sm">
          <Sparkles className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-200 leading-relaxed">
            {totalSpent === 0 ? (
              <p>Todavía no hay gastos registrados este mes para generar métricas.</p>
            ) : remainingPool > 0 ? (
              <p>
                <strong className="text-purple-300">¡Muy buen ritmo!</strong> Tienen un remanente proyectado de{" "}
                <span className="text-emerald-400 font-bold font-mono tabular-nums">
                  ${Math.round(remainingPool).toLocaleString("es-AR")}
                </span>{" "}
                que podrán destinar al FCI al cerrar el mes.
              </p>
            ) : (
              <p>
                <strong className="text-amber-300">Atención:</strong> Los gastos superaron el 60% presupuestado. Convendría revisar categorías secundarias.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Desglose por Categorías */}
      <div className="super-card rounded-3xl p-5">
        <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-4">
          Gastos por Categoría
        </h3>

        {sortedCategories.length === 0 ? (
          <p className="text-xs text-zinc-400 italic py-2">Sin gastos en este período.</p>
        ) : (
          <div className="space-y-3.5">
            {sortedCategories.map((cat) => {
              const pctOfTotal = totalSpent > 0 ? (cat.amount / totalSpent) * 100 : 0;

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
                      <span className="text-zinc-300 font-bold tabular-nums">{Math.round(pctOfTotal)}%</span>
                    </div>
                  </div>

                  <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(4, pctOfTotal)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desglose por Pagador (Agus vs Pareja) */}
      <div className="super-card rounded-3xl p-5">
        <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          ¿Quién desembolsó más?
        </h3>

        <div className="space-y-3">
          {Object.entries(payerTotals).map(([key, data], idx) => {
            const pct = totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0;
            const isAgus = idx === 0;

            return (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-200 font-semibold flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isAgus ? "bg-blue-500" : "bg-rose-500"}`} />
                    {data.name}
                  </span>
                  <span className="text-white font-semibold font-mono tabular-nums">
                    ${Math.round(data.amount).toLocaleString("es-AR")}{" "}
                    <span className="text-zinc-500 font-normal">({Math.round(pct)}%)</span>
                  </span>
                </div>
                <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/[0.04]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isAgus ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                    }`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
