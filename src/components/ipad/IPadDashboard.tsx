"use client";

import React from "react";
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  Plus,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  RefreshCw,
  Repeat,
  Search,
  Tablet,
} from "../ui/icons";
import { HogarExpenseRow } from "../HogarExpenseRow";
import { DeviceModeSelector } from "../DeviceModeSelector";
import { forceCheckAppUpdate } from "../AppUpdateChecker";
import currentAppVersion from "../../../public/version.json";
import { triggerHaptic } from "@/lib/haptics";
import { MonthlyAnalyticsView } from "../MonthlyAnalyticsView";
import { InstallmentsManagerView } from "../InstallmentsManagerView";
import { PersonalDashboardView } from "../PersonalDashboardView";
import { PersonalInvestmentsView } from "../PersonalInvestmentsView";
import { appConfig } from "@/config/appConfig";

export interface IPadDashboardProps {
  currentUser: any;
  users: any[];
  household: any;
  period: any;
  poolSummary: any;
  categories: any[];
  currentYear: number;
  currentMonth: number;
  monthLabel: string;
  isClosed: boolean;
  isChangingMonth: boolean;
  spaceMode: "hogar" | "personal";
  setSpaceMode: (mode: "hogar" | "personal") => void;
  activeTab: "hogar" | "analisis" | "cuotas" | "fci";
  setActiveTab: (tab: "hogar" | "analisis" | "cuotas" | "fci") => void;
  personalTab: "gastos" | "analisis" | "cuotas" | "tarjetas" | "inversiones";
  setPersonalTab: (tab: "gastos" | "analisis" | "cuotas" | "tarjetas" | "inversiones") => void;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  setIsMonthPickerOpen: (open: boolean) => void;
  setIsUserMenuOpen: (open: boolean) => void;
  isUserMenuOpen: boolean;
  setIsSalaryModalOpen: (open: boolean) => void;
  setIsCloseModalOpen: (open: boolean) => void;
  setIsExpenseModalOpen: (open: boolean) => void;
  setIsCategoryModalOpen: (open: boolean) => void;
  setIsFCIModalOpen: (open: boolean) => void;
  handleLogout: () => void;
  handleReopenMonth: () => void;
  isProcessingClose: boolean;
  hogarPct: number;
  burnRateColor: string;
  hogarSearchQuery: string;
  setHogarSearchQuery: (q: string) => void;
  hogarFilter: string;
  setHogarFilter: (f: string) => void;
  hogarCategoriesWithCount: Array<{ id: string; name: string; count: number }>;
  filteredHogarExpenses: any[];
  filteredSubtotal: number;
  normalizedHogarQuery: string;
  deletingId: string | null;
  onOpenDetail: (exp: any) => void;
  onLongPress: (exp: any) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  personalData: any;
  recurringExpenses: any[];
  sharedInvestments: any[];
  sharedInvestmentsSummary: any;
  sharedInvestmentsTab: "fci" | "portfolio";
  setSharedInvestmentsTab: (tab: "fci" | "portfolio") => void;
  pendingPersonalReviewCount: number;
  personalMenuAction: any;
  setPersonalMenuAction: (act: any) => void;
  handleSyncPersonalExpenses: any;
  userA: any;
  userB: any;
}

export function IPadDashboard({
  currentUser,
  users,
  household,
  period,
  poolSummary,
  categories,
  currentYear,
  currentMonth,
  monthLabel,
  isClosed,
  isChangingMonth,
  spaceMode,
  setSpaceMode,
  activeTab,
  setActiveTab,
  personalTab,
  setPersonalTab,
  handlePrevMonth,
  handleNextMonth,
  setIsMonthPickerOpen,
  setIsUserMenuOpen,
  isUserMenuOpen,
  setIsSalaryModalOpen,
  setIsCloseModalOpen,
  setIsExpenseModalOpen,
  setIsCategoryModalOpen,
  setIsFCIModalOpen,
  handleLogout,
  handleReopenMonth,
  isProcessingClose,
  hogarPct,
  burnRateColor,
  hogarSearchQuery,
  setHogarSearchQuery,
  hogarFilter,
  setHogarFilter,
  hogarCategoriesWithCount,
  filteredHogarExpenses,
  filteredSubtotal,
  normalizedHogarQuery,
  deletingId,
  onOpenDetail,
  onLongPress,
  showToast,
  personalData,
  recurringExpenses,
  sharedInvestments,
  sharedInvestmentsTab,
  setSharedInvestmentsTab,
  pendingPersonalReviewCount,
  personalMenuAction,
  setPersonalMenuAction,
  handleSyncPersonalExpenses,
  userA,
  userB,
}: IPadDashboardProps) {
  // Cálculo de ratio de aportes entre integrantes
  const nameA = userA?.name || "Augusto";
  const nameB = userB?.name || "Karen";
  const totalCommitted = (userA?.committedAmount || 0) + (userB?.committedAmount || 0) || 1;
  const pctA = Math.round(((userA?.committedAmount || 0) / totalCommitted) * 100);
  const pctB = 100 - pctA;

  // Diagnóstico temporal del mes en curso
  const now = new Date();
  const isCurrentMonthView = now.getFullYear() === currentYear && (now.getMonth() + 1) === currentMonth;
  const currentDay = now.getDate();
  const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
  const monthElapsedPct = Math.round((currentDay / daysInCurrentMonth) * 100);

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-20">
      {/* ========================================================= */}
      {/* CABECERA SUPERIOR IPADOS (iPad Glass Toolbar)             */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-2xl border-b border-white/[0.08] px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Logo + Título iPad */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/[0.12] shadow-sm shrink-0">
              <img src="/apple-touch-icon.png" alt="Hogar" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                Finanzas Hogar
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium flex items-center gap-1">
                  <Tablet className="w-2.5 h-2.5" />
                  iPad
                </span>
              </span>
            </div>
          </div>

          {/* Selector de Mes + Estado */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-white/[0.08] px-2 py-1 rounded-full shadow-inner">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={isChangingMonth}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-zinc-400 hover:text-white transition active:scale-90"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMonthPickerOpen(true)}
              className="text-xs font-bold text-white px-2.5 py-1 rounded-full hover:bg-white/[0.08] tracking-tight flex items-center gap-1.5 transition active:scale-95 group"
            >
              {isChangingMonth ? (
                <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>{monthLabel}</span>
                </span>
              ) : (
                <>
                  <span>{monthLabel} {currentYear}</span>
                  {isClosed && spaceMode === "hogar" && <Lock className="w-3 h-3 text-amber-400" />}
                  <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isChangingMonth}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-zinc-400 hover:text-white transition active:scale-90"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Usuario Conectado + Selector de Dispositivo */}
          <div className="flex items-center gap-2 relative">
            <DeviceModeSelector compact />

            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.08] px-3 py-1.5 rounded-full shadow-inner transition active:scale-95"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm"
                style={{ backgroundColor: currentUser.avatarColor }}
              >
                {currentUser.name.charAt(0)}
              </div>
              <span className="text-xs font-bold text-white">{currentUser.name}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {/* Menú Contextual Flotante de Usuario */}
            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 apple-glass-sheet border border-white/[0.14] rounded-2xl p-3 shadow-2xl z-50 animate-fade-in space-y-2">
                  <div className="px-2 py-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                      Conectado como
                    </span>
                    <span className="text-xs font-bold text-white block mt-0.5">
                      {currentUser.name}
                    </span>
                    {currentUser.email && (
                      <span className="text-[10px] text-zinc-400 font-mono block truncate">
                        {currentUser.email}
                      </span>
                    )}
                  </div>

                  <div className="border-t border-white/[0.08] pt-1.5 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        forceCheckAppUpdate();
                      }}
                      className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-zinc-300 hover:bg-white/[0.05] rounded-xl flex items-center justify-between transition"
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Versión</span>
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 font-bold">
                        v{currentAppVersion.version}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-rose-300 hover:bg-rose-500/10 rounded-xl flex items-center gap-2 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* CUERPO PRINCIPAL IPAD: SEGMENTED CONTROLS & SUB-BARRA     */}
      {/* ========================================================= */}
      <main className="max-w-5xl w-full mx-auto px-6 pt-4 flex-1 flex flex-col gap-5">
        {/* Conmutador de Espacio: Hogar vs Personal */}
        <div className="flex items-center justify-between gap-4">
          <div
            role="tablist"
            className="flex-1 max-w-md apple-segmented-track p-1 rounded-2xl flex gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={spaceMode === "hogar"}
              onClick={() => {
                if (spaceMode !== "hogar") triggerHaptic(10);
                setSpaceMode("hogar");
              }}
              className={`flex-1 min-h-[38px] py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                spaceMode === "hogar"
                  ? "apple-segment-active-hogar"
                  : "text-zinc-300 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Hogar Compartido</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={spaceMode === "personal"}
              onClick={() => {
                if (spaceMode !== "personal") triggerHaptic(10);
                setSpaceMode("personal");
              }}
              className={`flex-1 min-h-[38px] py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                spaceMode === "personal"
                  ? "apple-segment-active-personal"
                  : "text-zinc-300 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Personal ({currentUser.name})</span>
              {pendingPersonalReviewCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#FF9F0A] text-zinc-950">
                  {pendingPersonalReviewCount}
                </span>
              )}
            </button>
          </div>

          {/* Botón Nuevo Gasto Flotante en la Barra iPad */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(12);
              setIsExpenseModalOpen(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center gap-2 transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo Gasto</span>
          </button>
        </div>

        {/* Pestañas de Navegación iPad (iPadOS Tab Strip) */}
        {spaceMode === "hogar" ? (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => {
                if (activeTab !== "hogar") triggerHaptic(8);
                setActiveTab("hogar");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === "hogar"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Gastos del Mes ({period.expenses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab !== "analisis") triggerHaptic(8);
                setActiveTab("analisis");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === "analisis"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Análisis & Diagnóstico</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab !== "cuotas") triggerHaptic(8);
                setActiveTab("cuotas");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === "cuotas"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Gestor de Cuotas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab !== "fci") triggerHaptic(8);
                setActiveTab("fci");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === "fci"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <PiggyBank className="w-3.5 h-3.5" />
              <span>Fondo FCI</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setPersonalTab("gastos")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                personalTab === "gastos"
                  ? "apple-segment-active-personal"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Gastos Personales</span>
            </button>

            <button
              type="button"
              onClick={() => setPersonalTab("analisis")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                personalTab === "analisis"
                  ? "apple-segment-active-personal"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Análisis</span>
            </button>

            <button
              type="button"
              onClick={() => setPersonalTab("cuotas")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                personalTab === "cuotas"
                  ? "apple-segment-active-personal"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Cuotas</span>
            </button>

            <button
              type="button"
              onClick={() => setPersonalTab("tarjetas")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                personalTab === "tarjetas"
                  ? "apple-segment-active-personal"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Tarjetas</span>
              {pendingPersonalReviewCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400 text-zinc-950 font-extrabold">
                  {pendingPersonalReviewCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPersonalTab("inversiones")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                personalTab === "inversiones"
                  ? "apple-segment-active-personal"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Inversiones</span>
            </button>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL IPAD */}
        {spaceMode === "personal" ? (
          personalData && (
            <PersonalDashboardView
              currentUser={currentUser}
              currentYear={currentYear}
              currentMonth={currentMonth}
              monthName={monthLabel}
              categories={categories}
              personalData={personalData}
              activeTab={personalTab}
              onTabChange={setPersonalTab}
              externalMenuAction={personalMenuAction}
              onSyncPersonalExpenses={handleSyncPersonalExpenses}
            />
          )
        ) : (
          <div className="space-y-5">
            {/* TAB 1: HOGAR GASTOS (iPad 2-Column Split) */}
            {activeTab === "hogar" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start animate-fade-in">
                {/* COLUMNA IZQUIERDA IPAD: Métricas + Salud Financiera (5 Cols) */}
                <div className="md:col-span-5 space-y-4">
                  {/* Presupuesto Común (Termómetro Burn Rate) */}
                  <section className="super-card rounded-3xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-blue-400" />
                        Presupuesto Común ({hogarPct}%)
                      </span>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white font-bold border border-white/[0.12] tabular-nums">
                        {Math.round(poolSummary.burnRatePct)}% gastado
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">
                          Gastado del Mes
                        </span>
                        <span className="text-2xl font-extrabold text-white font-mono tabular-nums block">
                          ${Math.round(poolSummary.totalExpenses).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <div className="text-right bg-blue-500/[0.08] border border-blue-400/20 rounded-2xl px-3 py-2 flex flex-col justify-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block mb-0.5">
                          Remanente Libre
                        </span>
                        <span
                          className={`text-base font-extrabold font-mono tabular-nums ${
                            poolSummary.remainingPool < 0 ? "text-rose-400" : "text-white"
                          }`}
                        >
                          ${Math.round(poolSummary.remainingPool).toLocaleString("es-AR")}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono tabular-nums mt-0.5">
                          de ${Math.round(poolSummary.totalAvailablePool).toLocaleString("es-AR")} disp.
                        </span>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${burnRateColor}`}
                        style={{ width: `${Math.min(100, poolSummary.burnRatePct)}%` }}
                      />
                    </div>

                    {isCurrentMonthView && (
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium pt-2 mt-2 border-t border-white/[0.06]">
                        <span>Día {currentDay} de {daysInCurrentMonth} ({monthElapsedPct}% del mes)</span>
                        <span className={
                          poolSummary.burnRatePct > monthElapsedPct + 15
                            ? "text-amber-400 font-semibold"
                            : poolSummary.burnRatePct < monthElapsedPct - 10
                            ? "text-emerald-400 font-semibold"
                            : "text-blue-300 font-semibold"
                        }>
                          {poolSummary.burnRatePct > monthElapsedPct + 15
                            ? "Gasto acelerado"
                            : poolSummary.burnRatePct < monthElapsedPct - 10
                            ? "Ritmo controlado"
                            : "Ritmo alineado"}
                        </span>
                      </div>
                    )}
                  </section>

                  {/* Aportes y Balances (Augusto & Karen) */}
                  <div className="super-card rounded-3xl p-5 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      Aportes de la Pareja
                    </span>

                    <div className="space-y-2">
                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-bold text-xs">
                            {nameA.charAt(0)}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">{nameA}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              Bolsillo: ${Math.round(userA?.outOfPocketPaid || 0).toLocaleString("es-AR")}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-white font-mono">
                          ${Math.round(userA?.committedAmount || 0).toLocaleString("es-AR")}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center justify-center font-bold text-xs">
                            {nameB.charAt(0)}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">{nameB}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              Bolsillo: ${Math.round(userB?.outOfPocketPaid || 0).toLocaleString("es-AR")}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-white font-mono">
                          ${Math.round(userB?.committedAmount || 0).toLocaleString("es-AR")}
                        </span>
                      </div>
                    </div>

                    {/* Barra de Proporción de Aportes Pareja */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-blue-300 font-semibold">{nameA} ({pctA}%)</span>
                        <span className="text-rose-300 font-semibold">{nameB} ({pctB}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden flex bg-zinc-800/80 border border-white/[0.08]">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                          style={{ width: `${pctA}%` }}
                        />
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                          style={{ width: `${pctB}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Atajos Rápidos */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSalaryModalOpen(true)}
                      className="p-3 rounded-2xl super-card-subtle text-left hover:bg-white/[0.05] transition flex items-center gap-2.5"
                    >
                      <Settings className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-white block">Sueldos</span>
                        <span className="text-[10px] text-zinc-400 block">Configurar</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessingClose}
                      onClick={() => {
                        if (isClosed) handleReopenMonth();
                        else setIsCloseModalOpen(true);
                      }}
                      className="p-3 rounded-2xl super-card-subtle text-left hover:bg-white/[0.05] transition flex items-center gap-2.5"
                    >
                      {isClosed ? (
                        <>
                          <Unlock className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-amber-300 block">Reabrir</span>
                            <span className="text-[10px] text-zinc-400 block">{monthLabel}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-zinc-400 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-white block">Cerrar Mes</span>
                            <span className="text-[10px] text-zinc-400 block">{monthLabel}</span>
                          </div>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* COLUMNA DERECHA IPAD: Lista de Gastos & Filtros (7 Cols) */}
                <div className="md:col-span-7 space-y-3">
                  <div className="super-card rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[15px] font-semibold text-white tracking-[-0.015em]">
                          Gastos de {monthLabel}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.07] border border-white/[0.08] text-[11px] font-semibold text-zinc-300 tabular-nums">
                          {period.expenses.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-xs font-semibold text-blue-300 hover:text-blue-200 flex items-center gap-1 transition"
                      >
                        <Tag className="w-3.5 h-3.5 text-blue-400" />
                        <span>Categorías</span>
                      </button>
                    </div>

                    {/* Buscador iPad */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={hogarSearchQuery}
                        onChange={(e) => setHogarSearchQuery(e.target.value)}
                        placeholder="Buscar por comercio, categoría o nota..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900/90 border border-white/[0.07] text-[13px] text-white placeholder:text-zinc-400 focus:outline-none transition"
                      />
                      {hogarSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setHogarSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-300 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Filtros Rápidos */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                      <button
                        type="button"
                        onClick={() => setHogarFilter("ALL")}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
                          hogarFilter === "ALL"
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                        }`}
                      >
                        Todos ({period.expenses.length})
                      </button>
                      {users[0] && (
                        <button
                          type="button"
                          onClick={() => setHogarFilter(hogarFilter === `USER:${users[0].id}` ? "ALL" : `USER:${users[0].id}`)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
                            hogarFilter === `USER:${users[0].id}`
                              ? "bg-blue-600 text-white font-bold"
                              : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                          }`}
                        >
                          Pagó {users[0].name}
                        </button>
                      )}
                      {users[1] && (
                        <button
                          type="button"
                          onClick={() => setHogarFilter(hogarFilter === `USER:${users[1].id}` ? "ALL" : `USER:${users[1].id}`)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
                            hogarFilter === `USER:${users[1].id}`
                              ? "bg-rose-600 text-white font-bold"
                              : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                          }`}
                        >
                          Pagó {users[1].name}
                        </button>
                      )}
                      {hogarCategoriesWithCount.slice(0, 6).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setHogarFilter(hogarFilter === `CAT:${cat.id}` ? "ALL" : `CAT:${cat.id}`)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
                            hogarFilter === `CAT:${cat.id}`
                              ? "bg-blue-600 text-white font-bold"
                              : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                          }`}
                        >
                          {cat.name} ({cat.count})
                        </button>
                      ))}
                    </div>

                    {/* Lista */}
                    <div className="space-y-2 pt-1">
                      {period.expenses.length === 0 ? (
                        <div className="super-card rounded-2xl p-8 text-center">
                          <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
                          <p className="text-sm font-medium text-zinc-300">No hay gastos en este mes</p>
                        </div>
                      ) : filteredHogarExpenses.length === 0 ? (
                        <div className="p-6 text-center text-zinc-400 text-xs">
                          No se encontraron gastos que coincidan con la búsqueda.
                        </div>
                      ) : (
                        filteredHogarExpenses.map((exp) => (
                          <HogarExpenseRow
                            key={exp.id}
                            exp={exp}
                            users={users}
                            deletingId={deletingId}
                            onOpenDetail={onOpenDetail}
                            onLongPress={onLongPress}
                            showToast={showToast}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
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
                investedInFCI={poolSummary.investedInFCI}
                burnRatePct={poolSummary.burnRatePct}
                contributionPct={hogarPct}
                expenses={period.expenses}
                users={users}
                memberBalances={poolSummary.memberBalances}
                isClosed={isClosed}
                isProcessingClose={isProcessingClose}
                onOpenFCIModal={() => setIsFCIModalOpen(true)}
                onOpenSalaryModal={() => setIsSalaryModalOpen(true)}
                onCloseOrReopenMonth={() => {
                  if (isClosed) handleReopenMonth();
                  else setIsCloseModalOpen(true);
                }}
              />
            )}

            {/* TAB 3: CUOTAS */}
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

            {/* TAB 4: FCI */}
            {activeTab === "fci" && (
              <div className="space-y-4 animate-fade-in">
                {appConfig.features.enableSharedInvestmentsPortfolio && (
                  <div className="flex bg-zinc-900/90 p-1 rounded-2xl border border-white/[0.08] shadow-inner mb-3 max-w-sm">
                    <button
                      type="button"
                      onClick={() => setSharedInvestmentsTab("fci")}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition ${
                        sharedInvestmentsTab === "fci"
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Fondo FCI Pareja
                    </button>
                    <button
                      type="button"
                      onClick={() => setSharedInvestmentsTab("portfolio")}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                        sharedInvestmentsTab === "portfolio"
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Portafolio Hogar</span>
                    </button>
                  </div>
                )}

                {appConfig.features.enableSharedInvestmentsPortfolio && sharedInvestmentsTab === "portfolio" ? (
                  <PersonalInvestmentsView
                    householdId={household.id}
                    title="Portafolio de Inversiones del Hogar"
                    investments={sharedInvestments}
                  />
                ) : (
                  <div className="super-card rounded-3xl p-6 space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">
                          Fondo Común de Inversión Conjunta (FCI)
                        </span>
                        <h2 className="text-xl font-extrabold text-white font-mono tabular-nums">
                          ${Math.round(poolSummary.investedInFCI).toLocaleString("es-AR")}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsFCIModalOpen(true)}
                        className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Aportar al FCI</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-xs font-bold text-zinc-300 block mb-1">
                          Participación de {nameA}
                        </span>
                        <span className="text-base font-mono font-bold text-white">
                          {Math.round(userA?.fciQuotaSharePct || 50)}%
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-xs font-bold text-zinc-300 block mb-1">
                          Participación de {nameB}
                        </span>
                        <span className="text-base font-mono font-bold text-white">
                          {Math.round(userB?.fciQuotaSharePct || 50)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
