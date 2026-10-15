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
  Lock,
  Unlock,
  Check,
  X,
  Home,
  User,
  LogOut,
  Tag,
} from "./ui/icons";
import { CategoryIcon } from "./ui/icons";
import { QuickExpenseModal } from "./QuickExpenseModal";
import { SalaryConfigModal } from "./SalaryConfigModal";
import { FCIInvestModal } from "./FCIInvestModal";
import { MonthlyAnalyticsView } from "./MonthlyAnalyticsView";
import { InstallmentsManagerView } from "./InstallmentsManagerView";
import { LoginScreen } from "./LoginScreen";
import { PersonalDashboardView } from "./PersonalDashboardView";
import { ExpenseDetailModal, EditableExpense } from "./ExpenseDetailModal";
import { CategoryManagerModal } from "./CategoryManagerModal";
import {
  deleteExpenseAction,
  closeMonthAction,
  reopenMonthAction,
  loginAction,
  logoutAction,
} from "@/app/actions";

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
    currentUser: { id: string; name: string; avatarColor: string } | null;
    categories: Array<{ id: string; name: string; icon?: string | null; color?: string | null }>;
    period: {
      id: string;
      year: number;
      month: number;
      status: string;
      carriedOverBalance: number;
      closedAt?: Date | string | null;
      incomes: Array<{ userId: string; amount: number; contributionPct: number; targetPoolAmount: number }>;
      expenses: ExpenseItem[];
      investmentTransfer: { id: string; amount: number } | null;
    };
    poolSummary: {
      totalSalaries: number;
      salaryPool: number;
      carriedOverBalance: number;
      totalAvailablePool: number;
      investedInFCI: number;
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
    };
    investmentFund: {
      id: string;
      name: string;
      currentValue: number;
      contributions: Array<{ id: string; amount: number; investedAt: Date | string }>;
    } | null;
    recurringExpenses: Array<any>;
    personalData: any | null;
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
    currentUser,
    categories,
    period,
    poolSummary,
    investmentFund,
    recurringExpenses,
    personalData,
    currentYear,
    currentMonth,
  } = initialData;

  const [spaceMode, setSpaceMode] = useState<"hogar" | "personal">("hogar");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("hogar");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isFCIModalOpen, setIsFCIModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isProcessingClose, setIsProcessingClose] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<EditableExpense | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Si no hay usuario logueado en cookies, mostrar pantalla de selección de perfil
  if (!currentUser) {
    return <LoginScreen users={users} />;
  }

  const otherUser = users.find((u) => u.id !== currentUser.id);

  const handleSwitchUser = async (newUserId: string) => {
    setIsUserMenuOpen(false);
    await loginAction(newUserId);
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logoutAction();
  };

  const isClosed = period.status === "CLOSED";
  const nextMonthNumber = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const nextMonthName = MONTH_NAMES[nextMonthNumber - 1];

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

  const handleCloseMonth = async () => {
    setIsProcessingClose(true);
    try {
      await closeMonthAction(period.id);
      setIsCloseModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al cerrar el mes");
    } finally {
      setIsProcessingClose(false);
    }
  };

  const handleReopenMonth = async () => {
    if (
      confirm(
        "¿Reabrir este mes? Si se trasladó saldo remanente al mes siguiente, será restablecido si dicho mes sigue abierto."
      )
    ) {
      setIsProcessingClose(true);
      try {
        await reopenMonthAction(period.id);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Error al reabrir el mes");
      } finally {
        setIsProcessingClose(false);
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
    name: users[0]?.name || "Augusto",
    outOfPocketPaid: 0,
    committedAmount: 0,
    fciQuotaSharePct: 50,
  };
  const userB = poolSummary.memberBalances[1] || {
    name: users[1]?.name || "Agus",
    outOfPocketPaid: 0,
    committedAmount: 0,
    fciQuotaSharePct: 50,
  };

  const monthLabel = MONTH_NAMES[currentMonth - 1];

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col justify-between selection:bg-blue-600/30">
      {/* Contenedor mobile-first refinado */}
      <main className="w-full max-w-md mx-auto px-4 pt-safe pb-28 flex-1 flex flex-col gap-3.5">
        
        {/* Cabecera Superior: Usuario Conectado + Selector de Mes */}
        <header className="flex items-center justify-between pt-2">
          {/* Selector / Pill de Usuario Activo */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.08] px-3 py-1.5 rounded-full shadow-inner transition active:scale-95"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm"
                style={{ backgroundColor: currentUser.avatarColor }}
              >
                {currentUser.name.charAt(0)}
              </div>
              <span className="text-xs font-bold text-white tracking-tight">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-zinc-400">▾</span>
            </button>

            {/* Menú Flotante de Cambio de Usuario */}
            {isUserMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 bg-zinc-900 border border-white/[0.12] rounded-2xl p-2 shadow-2xl z-50 animate-fade-in space-y-1">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Perfil Activo
                </div>
                {otherUser && (
                  <button
                    onClick={() => handleSwitchUser(otherUser.id)}
                    className="w-full px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 hover:text-white hover:bg-white/[0.08] rounded-xl flex items-center gap-2 transition"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: otherUser.avatarColor }}
                    >
                      {otherUser.name.charAt(0)}
                    </div>
                    <span>Cambiar a {otherUser.name}</span>
                  </button>
                )}
                <div className="border-t border-white/[0.06] my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full px-2.5 py-2 text-left text-xs font-semibold text-rose-300 hover:bg-rose-500/10 rounded-xl flex items-center gap-2 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>

          {/* Selector de Mes Estilo Cápsula Dynamic Island */}
          <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-white/[0.08] px-2 py-1 rounded-full shadow-inner">
            <button
              onClick={handlePrevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-zinc-400 hover:text-white active:scale-90 transition duration-150"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold text-white px-1 tracking-tight flex items-center gap-1">
              {monthLabel} {currentYear}
              {isClosed && spaceMode === "hogar" && <Lock className="w-3 h-3 text-amber-400" />}
            </span>

            <button
              onClick={handleNextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-zinc-400 hover:text-white active:scale-90 transition duration-150"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* TOGGLE PRINCIPAL: HOGAR vs PERSONAL */}
        <div className="flex bg-zinc-900/90 p-1 rounded-2xl border border-white/[0.08] shadow-inner">
          <button
            type="button"
            onClick={() => setSpaceMode("hogar")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition duration-200 flex items-center justify-center gap-1.5 ${
              spaceMode === "hogar"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Hogar Compartido</span>
          </button>
          <button
            type="button"
            onClick={() => setSpaceMode("personal")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition duration-200 flex items-center justify-center gap-1.5 ${
              spaceMode === "personal"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Personal ({currentUser.name})</span>
          </button>
        </div>

        {/* CONTENIDO SEGÚN MODO SELECCIONADO */}

        {spaceMode === "personal" ? (
          /* ========================================================= */
          /* MODO PERSONAL (Privado e independiente, parte del 40%)    */
          /* ========================================================= */
          personalData && (
            <PersonalDashboardView
              currentUser={currentUser}
              currentYear={currentYear}
              currentMonth={currentMonth}
              monthName={monthLabel}
              categories={categories}
              personalData={personalData}
            />
          )
        ) : (
          /* ========================================================= */
          /* MODO HOGAR (Fondo Común 60% e Inversiones Compartidas)    */
          /* ========================================================= */
          <div className="space-y-4">
            {/* Botones de Acción de Hogar */}
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 active:scale-95 transition duration-150 border border-blue-400/20"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Gasto</span>
              </button>

              <button
                onClick={() => setIsSalaryModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-zinc-900/90 border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition duration-150"
                title="Configurar Sueldos"
              >
                <Settings className="w-3.5 h-3.5 text-blue-400" />
                <span>Sueldos</span>
              </button>

              {isClosed ? (
                <button
                  onClick={handleReopenMonth}
                  disabled={isProcessingClose}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 active:scale-95 transition duration-150 disabled:opacity-50"
                  title="Reabrir mes"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Reabrir</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsCloseModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-zinc-900/90 border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition duration-150"
                  title="Cerrar mes"
                >
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Cerrar</span>
                </button>
              )}
            </div>

            {/* TAB 1: HOGAR / GASTOS PRINCIPALES */}
            {activeTab === "hogar" && (
              <div className="space-y-4 animate-fade-in">
                {/* Tarjeta Principal: Termómetro del Fondo Común (Obsidian Glass) */}
                <section className="super-card rounded-3xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-blue-400" />
                  Presupuesto Común (60%)
                </span>
                <div className="flex items-center gap-2">
                  {isClosed && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      Cerrado
                    </span>
                  )}
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white font-bold border border-white/[0.12] tabular-nums">
                    {Math.round(poolSummary.burnRatePct)}% gastado
                  </span>
                </div>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">Gastado:</span>
                  <span className="text-3xl font-extrabold text-white tracking-tight font-mono tabular-nums">
                    ${Math.round(poolSummary.totalExpenses).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">Fondo Disponible:</span>
                  <span className="text-base font-bold text-zinc-100 font-mono tabular-nums">
                    ${Math.round(poolSummary.totalAvailablePool).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Sub-desglose si hay saldo arrastrado o invertido */}
              {(poolSummary.carriedOverBalance > 0 || poolSummary.investedInFCI > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] font-medium">
                  {poolSummary.carriedOverBalance > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono tabular-nums">
                      +${Math.round(poolSummary.carriedOverBalance).toLocaleString("es-AR")} mes anterior
                    </span>
                  )}
                  {poolSummary.investedInFCI > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono tabular-nums">
                      -${Math.round(poolSummary.investedInFCI).toLocaleString("es-AR")} invertido en FCI
                    </span>
                  )}
                </div>
              )}

              {/* Barra de Progreso SuperDesign */}
              <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden mb-4 p-0.5 border border-white/[0.08]">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${burnRateColor}`}
                  style={{ width: `${Math.min(100, poolSummary.burnRatePct)}%` }}
                />
              </div>

              {/* Banner Remanente para Invertir en FCI */}
              {poolSummary.investedInFCI > 0 && poolSummary.remainingPool === 0 ? (
                <div
                  onClick={() => setIsFCIModalOpen(true)}
                  className="cursor-pointer bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between transition-all duration-150 active:scale-[0.98] group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                        Excedente Invertido en FCI
                      </span>
                      <span className="text-base font-bold text-white font-mono tabular-nums">
                        ${Math.round(poolSummary.investedInFCI).toLocaleString("es-AR")} asignados
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-300 font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>Ver FCI</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsFCIModalOpen(true)}
                  className="cursor-pointer bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between transition-all duration-150 active:scale-[0.98] group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <PiggyBank className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                        Remanente para FCI
                      </span>
                      <span className="text-lg font-bold text-white font-mono tabular-nums">
                        ${Math.round(poolSummary.remainingPool).toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-300 font-bold group-hover:translate-x-0.5 transition-transform">
                    <span>Invertir</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </section>

            {/* Balances de Bolsillo (Agus & Pareja) */}
            <section className="super-card rounded-3xl p-5">
              <h2 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-rose-400" />
                Desembolsos de Bolsillo
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {/* User A (Agus) */}
                <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300 truncate">
                      {userA.name}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                  </div>
                  <span className="text-xl font-extrabold text-white block mt-1.5 font-mono tabular-nums">
                    ${Math.round(userA.outOfPocketPaid).toLocaleString("es-AR")}
                  </span>
                  <span className="text-[10px] text-zinc-300 font-medium block mt-0.5 font-mono tabular-nums">
                    Meta 60%: ${Math.round(userA.committedAmount).toLocaleString("es-AR")}
                  </span>
                </div>

                {/* User B (Pareja) */}
                <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300 truncate">
                      {userB.name}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
                  </div>
                  <span className="text-xl font-extrabold text-white block mt-1.5 font-mono tabular-nums">
                    ${Math.round(userB.outOfPocketPaid).toLocaleString("es-AR")}
                  </span>
                  <span className="text-[10px] text-zinc-300 font-medium block mt-0.5 font-mono tabular-nums">
                    Meta 60%: ${Math.round(userB.committedAmount).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
            </section>

            {/* Lista de Gastos */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Gastos de {monthLabel} ({period.expenses.length})
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 active:scale-95 flex items-center gap-1 transition"
                    title="Gestionar categorías"
                  >
                    <Tag className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Categorías</span>
                  </button>
                  <button
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 active:scale-95 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Anotar Gasto</span>
                  </button>
                </div>
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
                        onClick={() => {
                          setSelectedExpense({
                            id: exp.id,
                            title: exp.title,
                            amount: exp.amount,
                            date: exp.date,
                            categoryId: exp.category.id,
                            category: exp.category,
                            paidById: exp.paidBy.id,
                            paidBy: exp.paidBy,
                            isFromPoolFund: exp.isFromPoolFund,
                            notes: exp.notes,
                            installmentNumber: exp.installmentNumber,
                            totalInstallments: exp.totalInstallments,
                            isPersonal: false,
                          });
                          setIsDetailModalOpen(true);
                        }}
                        className="super-card-subtle rounded-2xl p-3.5 flex items-center justify-between hover:bg-white/[0.05] active:scale-[0.99] transition duration-150 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-white/[0.08] flex items-center justify-center text-zinc-300 shadow-sm shrink-0">
                            <CategoryIcon name={exp.category.name} className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-white block group-hover:text-blue-300 transition-colors">
                              {exp.title}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-300 font-medium">
                              <span>{dateStr}</span>
                              <span>•</span>
                              <span
                                className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] border ${
                                  isAgus
                                    ? "bg-blue-500/20 text-blue-200 border-blue-400/30"
                                    : "bg-rose-500/20 text-rose-200 border-rose-400/30"
                                }`}
                              >
                                Pagó {exp.paidBy.name}
                              </span>
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
                              handleDeleteExpense(exp.id);
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

        {/* TAB 2: ANÁLISIS MENSUAL */}
        {activeTab === "analisis" && (
          <MonthlyAnalyticsView
            monthName={monthLabel}
            year={currentYear}
            totalSpent={poolSummary.totalExpenses}
            totalAvailablePool={poolSummary.totalAvailablePool}
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
      </div>
    )}
  </main>

  {/* Barra de Navegación Inferior (solo en modo Hogar) */}
  {spaceMode === "hogar" && (
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
      )}

      {/* Modales */}
      <QuickExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        periodId={period.id}
        users={users}
        categories={categories}
        defaultPayerId={currentUser.id}
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

      {/* Modal de Confirmación de Cierre Mensual */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md super-card rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Cierre Mensual</h2>
                  <p className="text-xs text-zinc-400">{monthLabel} {currentYear}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCloseModalOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumen del Período */}
            <div className="mt-4 space-y-3">
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium">Presupuesto Disponible:</span>
                  <span className="font-bold text-white font-mono tabular-nums">
                    ${Math.round(poolSummary.totalAvailablePool).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium">Total Gastos Imputados:</span>
                  <span className="font-bold text-rose-300 font-mono tabular-nums">
                    -${Math.round(poolSummary.totalExpenses).toLocaleString("es-AR")}
                  </span>
                </div>
                {poolSummary.investedInFCI > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-medium">Invertido en FCI:</span>
                    <span className="font-bold text-emerald-400 font-mono tabular-nums">
                      -${Math.round(poolSummary.investedInFCI).toLocaleString("es-AR")}
                    </span>
                  </div>
                )}
                <div className="border-t border-white/[0.08] pt-2 flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-200">Remanente no invertido:</span>
                  <span className="text-base font-extrabold text-white font-mono tabular-nums">
                    ${Math.round(poolSummary.remainingPool).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Explicación del Traspaso de Saldo */}
              {poolSummary.remainingPool > 0 ? (
                <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 text-xs text-blue-100 flex items-start gap-3 shadow-sm">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-blue-300 block">Pase automático de saldo</span>
                    <p className="text-zinc-200 leading-relaxed">
                      El saldo remanente de{" "}
                      <strong className="text-white font-mono tabular-nums">
                        ${Math.round(poolSummary.remainingPool).toLocaleString("es-AR")}
                      </strong>{" "}
                      se trasladará automáticamente como saldo disponible inicial a{" "}
                      <strong className="text-blue-300">{nextMonthName} {nextMonthYear}</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900/60 border border-white/[0.08] rounded-2xl p-4 text-xs text-zinc-300 flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    No hay remanente libre para trasladar. Todo el presupuesto fue consumido o invertido en el FCI. {nextMonthName} iniciará con sueldos nuevos.
                  </p>
                </div>
              )}
            </div>

            {/* Botones de Acción */}
            <div className="mt-5 space-y-2">
              <button
                onClick={handleCloseMonth}
                disabled={isProcessingClose}
                className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-amber-400/20"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isProcessingClose ? "Cerrando período..." : `Confirmar Cierre de ${monthLabel}`}
                </span>
              </button>

              <button
                onClick={() => setIsCloseModalOpen(false)}
                disabled={isProcessingClose}
                className="w-full py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 font-medium text-xs active:scale-[0.98] transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle y Edición de Gasto del Hogar */}
      <ExpenseDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedExpense(null);
        }}
        expense={selectedExpense}
        users={users}
        categories={categories}
        isPersonal={false}
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
