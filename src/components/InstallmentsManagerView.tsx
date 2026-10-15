"use client";

import React, { useState } from "react";
import { CreditCard, Repeat, Plus, Check, Trash2, CategoryIcon, X, User, Wallet } from "./ui/icons";
import {
  createRecurringExpenseAction,
  deleteRecurringExpenseAction,
  applyRecurringExpenseToMonthAction,
} from "@/app/actions";

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

export function InstallmentsManagerView({
  periodId,
  currentYear,
  currentMonth,
  monthName,
  recurringExpenses,
  users,
  categories,
}: InstallmentsManagerViewProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [title, setTitle] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [isInstallmentPlan, setIsInstallmentPlan] = useState(true);
  const [totalInstallments, setTotalInstallments] = useState("6");
  const [selectedPayerId, setSelectedPayerId] = useState(users[0]?.id || "");
  const [isFromPoolFund, setIsFromPoolFund] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(installmentAmount);
    if (!title.trim() || amountNum <= 0) return;

    setIsSubmitting(true);
    try {
      await createRecurringExpenseAction({
        title: title.trim(),
        installmentAmount: amountNum,
        totalInstallments: isInstallmentPlan ? parseInt(totalInstallments) || null : null,
        startYear: currentYear,
        startMonth: currentMonth,
        paidById: selectedPayerId,
        categoryId: selectedCategoryId,
        isFromPoolFund: false,
      });

      setTitle("");
      setInstallmentAmount("");
      setIsAddingNew(false);
    } catch (err) {
      console.error(err);
      alert("Error al guardar gasto recurrente");
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
    } catch (err) {
      console.error(err);
      alert("Error al cargar la cuota al mes");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Eliminar este gasto recurrente/cuota?")) {
      try {
        await deleteRecurringExpenseAction(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const applicableThisMonth = recurringExpenses.filter((r) => r.isApplicableThisMonth);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Cabecera de la sección */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            Cuotas y Tarjetas
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Compras en cuotas y débitos fijos mensuales
          </p>
        </div>

        <button
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md active:scale-95 transition border border-indigo-400/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Cuota</span>
        </button>
      </div>

      {/* Formulario de Nueva Cuota */}
      {isAddingNew && (
        <form
          onSubmit={handleCreate}
          className="super-card rounded-3xl p-5 shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <h3 className="text-sm font-bold text-white">Nueva Compra en Cuotas o Gasto Fijo</h3>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="p-1 rounded-full text-zinc-400 hover:text-white bg-white/[0.05]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Nombre del gasto
            </label>
            <input
              type="text"
              placeholder="ej: Celular en cuotas, Alquiler, Gimnasio"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm focus:ring-1 focus:ring-indigo-500/50 focus:outline-none"
              required
            />
          </div>

          {/* Toggle: Cuotas fijas vs Fijo mensual */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsInstallmentPlan(true)}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition active:scale-[0.98] ${
                isInstallmentPlan
                  ? "bg-indigo-600/25 border-indigo-500 text-indigo-300 shadow-sm"
                  : "bg-white/[0.03] border-white/[0.06] text-zinc-400"
              }`}
            >
              Tarjeta en Cuotas (ej: 6)
            </button>
            <button
              type="button"
              onClick={() => setIsInstallmentPlan(false)}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition active:scale-[0.98] ${
                !isInstallmentPlan
                  ? "bg-indigo-600/25 border-indigo-500 text-indigo-300 shadow-sm"
                  : "bg-white/[0.03] border-white/[0.06] text-zinc-400"
              }`}
            >
              Gasto Fijo Recurrente
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Monto por cuota / mes
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-500 text-xs">$</span>
                <input
                  type="number"
                  placeholder="25000"
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-6 pr-3 py-2 text-white text-sm font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  required
                />
              </div>
            </div>

            {isInstallmentPlan && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Cantidad de cuotas
                </label>
                <select
                  value={totalInstallments}
                  onChange={(e) => setTotalInstallments(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none"
                >
                  <option value="3">3 cuotas</option>
                  <option value="6">6 cuotas</option>
                  <option value="9">9 cuotas</option>
                  <option value="12">12 cuotas</option>
                  <option value="18">18 cuotas</option>
                  <option value="24">24 cuotas</option>
                </select>
              </div>
            )}
          </div>

          {/* Pagador */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              ¿Con la tarjeta de quién?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {users.slice(0, 2).map((u, idx) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedPayerId(u.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border text-center truncate transition active:scale-[0.97] ${
                    selectedPayerId === u.id
                      ? idx === 0
                        ? "bg-blue-600/25 border-blue-500 text-blue-300 ring-1 ring-blue-500/50"
                        : "bg-rose-600/25 border-rose-500 text-rose-300 ring-1 ring-rose-500/50"
                      : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-semibold shadow-md active:scale-[0.98] transition border border-indigo-400/20"
          >
            {isSubmitting ? "Guardando..." : "Guardar y Comenzar Seguimiento"}
          </button>
        </form>
      )}

      {/* Cuotas aplicables al mes seleccionado */}
      <div className="super-card rounded-3xl p-5 shadow-lg space-y-3">
        <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Cuotas para {monthName} {currentYear} ({applicableThisMonth.length})
        </h3>

        {applicableThisMonth.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-2">
            No hay cuotas programadas para este mes.
          </p>
        ) : (
          <div className="space-y-2.5">
            {applicableThisMonth.map((item) => (
              <div
                key={item.id}
                className="super-card-subtle rounded-2xl p-3.5 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-semibold text-white block">
                    {item.title}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                    <span className="text-indigo-400 font-semibold font-mono tabular-nums">
                      {item.totalInstallments
                        ? `Cuota ${item.installmentNumber} de ${item.totalInstallments}`
                        : "Gasto mensual fijo"}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-zinc-300">{item.paidBy.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white font-mono tabular-nums">
                    ${Math.round(item.installmentAmount).toLocaleString("es-AR")}
                  </span>

                  {item.alreadyApplied ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/50">
                      <Check className="w-3.5 h-3.5" />
                      Cargado
                    </span>
                  ) : (
                    <button
                      onClick={() => handleApplyToMonth(item)}
                      disabled={actionLoadingId === item.id}
                      className="text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-xl active:scale-95 transition shadow-sm"
                    >
                      {actionLoadingId === item.id ? "Cargando..." : "Cargar al mes"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Listado General de Recurrentes */}
      <div className="super-card rounded-3xl p-5 shadow-lg space-y-3">
        <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Todas las Cuotas Activas ({recurringExpenses.length})
        </h3>

        {recurringExpenses.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-1">No hay planes registrados.</p>
        ) : (
          <div className="space-y-2">
            {recurringExpenses.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-xs py-2 border-b border-white/[0.06] last:border-0"
              >
                <div>
                  <span className="text-zinc-200 font-semibold block">{r.title}</span>
                  <span className="text-zinc-500 text-[11px] font-mono tabular-nums">
                    ${Math.round(r.installmentAmount).toLocaleString("es-AR")}/mes • Inicio:{" "}
                    {r.startMonth}/{r.startYear}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 active:scale-90 transition"
                  title="Eliminar cuota"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
