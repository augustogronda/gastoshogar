"use client";

import React, { useEffect } from "react";
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
  RefreshCw,
  Repeat,
  Search,
  Monitor,
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

export interface DesktopDashboardProps {
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

export function DesktopDashboard({
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
}: DesktopDashboardProps) {

  // Atajos de teclado ergonómicos para PC (N para nuevo gasto, Flechas para cambiar mes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Evitar disparar si el usuario está escribiendo en un input o textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        triggerHaptic(12);
        setIsExpenseModalOpen(true);
      } else if (e.key === "ArrowLeft" && e.altKey) {
        e.preventDefault();
        handlePrevMonth();
      } else if (e.key === "ArrowRight" && e.altKey) {
        e.preventDefault();
        handleNextMonth();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setIsExpenseModalOpen, handlePrevMonth, handleNextMonth]);

  return (
    <div className="flex min-h-screen bg-[#07090e] text-zinc-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* ========================================================= */}
      {/* BARRA LATERAL FIJA PARA ESCRITORIO PC (Sidebar macOS/Web)  */}
      {/* ========================================================= */}
      <aside className="w-72 shrink-0 h-screen sticky top-0 bg-zinc-950/80 border-r border-white/[0.08] backdrop-blur-2xl flex flex-col justify-between p-5 z-20 overflow-y-auto no-scrollbar">
        {/* Cabecera Sidebar: Logo, Versión y Usuario */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/[0.12] shadow-md shadow-indigo-500/20 shrink-0">
                <img
                  src="/apple-touch-icon.png"
                  alt="Finanzas Hogar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="text-sm font-bold text-white tracking-tight block leading-tight">
                  Finanzas Hogar
                </span>
                <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                  <Monitor className="w-3 h-3 text-blue-400 inline" />
                  Versión Escritorio PC
                </span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-mono font-bold border border-blue-500/20">
              v{currentAppVersion.version}
            </span>
          </div>

          {/* Tarjeta de Usuario Conectado */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition text-left group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold text-white shadow-sm shrink-0"
                  style={{ backgroundColor: currentUser.avatarColor }}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate group-hover:text-blue-300 transition-colors">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 block truncate font-mono">
                    {currentUser.email || "Usuario conectado"}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors shrink-0" />
            </button>

            {/* Menú Flotante de Usuario */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-full apple-glass-sheet border border-white/[0.14] rounded-2xl p-2.5 shadow-2xl z-50 animate-fade-in space-y-1.5">
                  <div className="px-2 py-1 text-left">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                      Cuenta activa
                    </span>
                    <span className="text-xs font-bold text-white block mt-0.5">
                      {currentUser.name}
                    </span>
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
                        <span>Verificar Actualizaciones</span>
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

          {/* Navegador de Mes para Escritorio */}
          <div className="p-3 rounded-2xl super-card-subtle space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Período
              </span>
              {isClosed ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Cerrado
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  Abierto
                </span>
              )}
            </div>

            <div className="flex items-center justify-between bg-zinc-900/90 border border-white/[0.08] px-2 py-1.5 rounded-xl shadow-inner">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={isChangingMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white transition disabled:opacity-30"
                title="Mes anterior (Alt + Flecha Izquierda)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(true)}
                className="text-xs font-bold text-white px-2 py-1 rounded-lg hover:bg-white/[0.08] tracking-tight flex items-center gap-1.5 transition group"
                title="Abrir selector de mes"
              >
                {isChangingMonth ? (
                  <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>{monthLabel}</span>
                  </span>
                ) : (
                  <>
                    <span>{monthLabel} {currentYear}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={isChangingMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white transition disabled:opacity-30"
                title="Mes siguiente (Alt + Flecha Derecha)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conmutador de Espacio: Hogar vs Personal */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
              Espacio de Finanzas
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl apple-segmented-track">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setSpaceMode("hogar");
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition ${
                  spaceMode === "hogar"
                    ? "apple-segment-active-hogar"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Hogar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setSpaceMode("personal");
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition ${
                  spaceMode === "personal"
                    ? "apple-segment-active-personal"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Personal</span>
                {pendingPersonalReviewCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Menú de Navegación según Espacio */}
          <nav className="space-y-1 pt-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
              {spaceMode === "hogar" ? "Vistas de Hogar" : "Vistas Personales"}
            </span>

            {spaceMode === "hogar" ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("hogar")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === "hogar"
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Wallet className="w-4 h-4" />
                    <span>Gastos del Mes</span>
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/30 font-mono">
                    {period.expenses.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("analisis")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === "analisis"
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4" />
                    <span>Análisis & Métricas</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("cuotas")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === "cuotas"
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Repeat className="w-4 h-4" />
                    <span>Gestor de Cuotas</span>
                  </span>
                  {recurringExpenses && recurringExpenses.length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/30 font-mono">
                      {recurringExpenses.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("fci")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === "fci"
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <PiggyBank className="w-4 h-4" />
                    <span>Fondo Común FCI</span>
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setPersonalTab("gastos")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    personalTab === "gastos"
                      ? "apple-segment-active-personal"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Wallet className="w-4 h-4" />
                    <span>Gastos Personales</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPersonalTab("analisis")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    personalTab === "analisis"
                      ? "apple-segment-active-personal"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4" />
                    <span>Análisis & Métricas</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPersonalTab("cuotas")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    personalTab === "cuotas"
                      ? "apple-segment-active-personal"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Repeat className="w-4 h-4" />
                    <span>Cuotas Personales</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPersonalTab("tarjetas")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    personalTab === "tarjetas"
                      ? "apple-segment-active-personal"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4" />
                    <span>Tarjetas de Crédito</span>
                  </span>
                  {pendingPersonalReviewCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400 text-zinc-950 font-extrabold">
                      {pendingPersonalReviewCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPersonalTab("inversiones")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    personalTab === "inversiones"
                      ? "apple-segment-active-personal"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <TrendingUp className="w-4 h-4" />
                    <span>Inversiones & Cripto</span>
                  </span>
                </button>
              </div>
            )}
          </nav>

          {/* Botón Principal de Acción Rápida */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                setIsExpenseModalOpen(true);
              }}
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition active:scale-95 group"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Gasto</span>
              <kbd className="hidden lg:inline-block ml-auto text-[10px] px-1.5 py-0.5 rounded bg-blue-700 text-blue-200 font-mono">
                N
              </kbd>
            </button>
          </div>
        </div>

        {/* Pie Sidebar: Ajustes de Mes y Selector de Dispositivo */}
        <div className="pt-4 border-t border-white/[0.08] space-y-3">
          {spaceMode === "hogar" ? (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setIsSalaryModalOpen(true)}
                className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] rounded-xl flex items-center gap-2.5 transition"
              >
                <Settings className="w-3.5 h-3.5 text-blue-400" />
                <span>Configurar Sueldos</span>
              </button>

              <button
                type="button"
                disabled={isProcessingClose}
                onClick={() => {
                  if (isClosed) {
                    handleReopenMonth();
                  } else {
                    setIsCloseModalOpen(true);
                  }
                }}
                className={`w-full px-3 py-2 text-left text-xs font-medium rounded-xl flex items-center gap-2.5 transition ${
                  isClosed
                    ? "text-amber-300 hover:bg-amber-500/15"
                    : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {isClosed ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Reabrir Mes ({monthLabel})</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Cerrar Mes ({monthLabel})</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setPersonalMenuAction({ type: "income", seq: Date.now() })}
                className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] rounded-xl flex items-center gap-2.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Editar Ingreso Personal</span>
              </button>
            </div>
          )}

          {/* Selector de Dispositivo */}
          <div className="pt-2 border-t border-white/[0.06]">
            <DeviceModeSelector compact className="w-full" />
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* ÁREA DE CONTENIDO PRINCIPAL DE ESCRITORIO PC (Multicolumna) */}
      {/* ========================================================= */}
      <main className="flex-1 min-w-0 px-8 py-6 max-w-7xl mx-auto flex flex-col gap-6">
        {/* Cabecera Superior de Escritorio: Breadcrumb & Estado */}
        <header className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-1">
              <span>Finanzas Hogar</span>
              <span>/</span>
              <span className="capitalize">{spaceMode === "hogar" ? "Hogar Compartido" : "Personal"}</span>
              <span>/</span>
              <span className="text-white font-semibold">{monthLabel} {currentYear}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {spaceMode === "hogar"
                ? activeTab === "hogar"
                  ? `Gastos del Hogar • ${monthLabel} ${currentYear}`
                  : activeTab === "analisis"
                  ? `Análisis y Diagnóstico • ${monthLabel}`
                  : activeTab === "cuotas"
                  ? `Gestor de Cuotas y Débitos`
                  : `Fondo Común e Inversiones FCI`
                : `Gestión Personal de ${currentUser.name}`}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <DeviceModeSelector compact />
          </div>
        </header>

        {/* CONTENIDO SEGÚN MODO: PERSONAL vs HOGAR */}
        {spaceMode === "personal" ? (
          personalData && (
            <div className="w-full max-w-6xl mx-auto">
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
            </div>
          )
        ) : (
          /* MODO HOGAR COMPARTIDO */
          <div className="space-y-6">
            {/* PESTAÑA 1: GASTOS DEL HOGAR (Layout Multicolumna de Escritorio) */}
            {activeTab === "hogar" && (
              <div className="space-y-6 animate-fade-in">
                {/* Fila Superior de Métricas Clave (4 KPI Cards en Grid de Escritorio) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* KPI 1: Presupuesto Disponible */}
                  <div className="super-card rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        Presupuesto Total
                      </span>
                      <Wallet className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <span className="text-2xl font-extrabold text-white font-mono tabular-nums block">
                        ${Math.round(poolSummary.totalAvailablePool).toLocaleString("es-AR")}
                      </span>
                      <span className="text-[11px] text-zinc-400 mt-0.5 block font-medium">
                        Aporte común ({hogarPct}%)
                      </span>
                    </div>
                  </div>

                  {/* KPI 2: Total Gastado */}
                  <div className="super-card rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        Gastado del Mes
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-white font-mono font-bold">
                        {Math.round(poolSummary.burnRatePct)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-2xl font-extrabold text-white font-mono tabular-nums block">
                        ${Math.round(poolSummary.totalExpenses).toLocaleString("es-AR")}
                      </span>
                      <span className="text-[11px] text-zinc-400 mt-0.5 block font-medium">
                        {period.expenses.length} compra(s) registradas
                      </span>
                    </div>
                  </div>

                  {/* KPI 3: Remanente Libre */}
                  <div className="super-card rounded-2xl p-4 flex flex-col justify-between border-blue-500/20 bg-blue-950/20">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                        Remanente Libre
                      </span>
                      <Sparkles className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <span
                        className={`text-2xl font-extrabold font-mono tabular-nums block ${
                          poolSummary.remainingPool < 0 ? "text-rose-400" : "text-white"
                        }`}
                      >
                        ${Math.round(poolSummary.remainingPool).toLocaleString("es-AR")}
                      </span>
                      <span className="text-[11px] text-blue-200/80 mt-0.5 block font-medium">
                        {poolSummary.remainingPool >= 0 ? "Disponible para invertir" : "Déficit mensual"}
                      </span>
                    </div>
                  </div>

                  {/* KPI 4: Inversión en FCI */}
                  <div className="super-card rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        FCI / Excedente
                      </span>
                      <PiggyBank className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-2xl font-extrabold text-white font-mono tabular-nums block">
                        ${Math.round(poolSummary.investedInFCI).toLocaleString("es-AR")}
                      </span>
                      <span className="text-[11px] text-zinc-400 mt-0.5 block font-medium">
                        Invertido en el mes
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid Principal de Escritorio: 2 Columnas (Lista de Gastos 62% + Salud Financiera 38%) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* COLUMNA IZQUIERDA: Buscador, Filtros y Lista de Gastos (7 Cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="super-card rounded-3xl p-5 space-y-4">
                      {/* Cabecera de la Lista */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-white tracking-tight">
                            Gastos de {monthLabel}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.08] text-xs font-bold text-zinc-300 font-mono">
                            {period.expenses.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsCategoryModalOpen(true)}
                            className="text-xs font-semibold text-blue-300 hover:text-blue-200 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition"
                          >
                            <Tag className="w-3.5 h-3.5 text-blue-400" />
                            <span>Categorías</span>
                          </button>
                        </div>
                      </div>

                      {/* Buscador de Gastos en PC */}
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={hogarSearchQuery}
                          onChange={(e) => setHogarSearchQuery(e.target.value)}
                          placeholder="Buscar por comercio, categoría o notas..."
                          className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-900/90 border border-white/[0.08] focus:border-blue-400/50 text-sm text-white placeholder:text-zinc-500 focus:outline-none transition shadow-inner"
                        />
                        {hogarSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setHogarSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Chips de Filtros Rápidos */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setHogarFilter("ALL")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                            hogarFilter === "ALL"
                              ? "bg-blue-600 text-white font-bold shadow-sm"
                              : "bg-zinc-900 text-zinc-400 hover:text-white border border-white/[0.08]"
                          }`}
                        >
                          Todos ({period.expenses.length})
                        </button>
                        {users[0] && (
                          <button
                            type="button"
                            onClick={() => setHogarFilter(hogarFilter === `USER:${users[0].id}` ? "ALL" : `USER:${users[0].id}`)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                              hogarFilter === `USER:${users[0].id}`
                                ? "bg-blue-600 text-white font-bold shadow-sm"
                                : "bg-zinc-900 text-zinc-400 hover:text-white border border-white/[0.08]"
                            }`}
                          >
                            Pagó {users[0].name}
                          </button>
                        )}
                        {users[1] && (
                          <button
                            type="button"
                            onClick={() => setHogarFilter(hogarFilter === `USER:${users[1].id}` ? "ALL" : `USER:${users[1].id}`)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                              hogarFilter === `USER:${users[1].id}`
                                ? "bg-rose-600 text-white font-bold shadow-sm"
                                : "bg-zinc-900 text-zinc-400 hover:text-white border border-white/[0.08]"
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
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                              hogarFilter === `CAT:${cat.id}`
                                ? "bg-blue-600 text-white font-bold shadow-sm"
                                : "bg-zinc-900 text-zinc-400 hover:text-white border border-white/[0.08]"
                            }`}
                          >
                            {cat.name} ({cat.count})
                          </button>
                        ))}
                      </div>

                      {/* Lista de Gastos */}
                      <div className="space-y-2 pt-2">
                        {period.expenses.length === 0 ? (
                          <div className="p-8 text-center border border-dashed border-white/[0.1] rounded-2xl">
                            <CreditCard className="w-8 h-8 text-zinc-500 mx-auto mb-2 opacity-60" />
                            <p className="text-sm font-semibold text-zinc-300">
                              No hay gastos en este mes
                            </p>
                            <p className="text-xs text-zinc-500 mt-1">
                              Presioná <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">N</kbd> para registrar el primero.
                            </p>
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

                  {/* COLUMNA DERECHA: Salud Financiera, Aportes y Atajos (5 Cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Tarjeta de Integrantes: Augusto & Karen */}
                    <div className="super-card rounded-3xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-blue-400" />
                          Aportes y Balances
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          Fondo {hogarPct}%
                        </span>
                      </div>

                      <div className="space-y-3">
                        {/* Usuario A */}
                        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-bold text-xs">
                              {userA.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-white block">
                                {userA.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 block font-mono">
                                Pagó de su bolsillo: ${Math.round(userA.outOfPocketPaid).toLocaleString("es-AR")}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-white font-mono block">
                              ${Math.round(userA.committedAmount).toLocaleString("es-AR")}
                            </span>
                            <span className="text-[10px] text-blue-300 font-mono block">
                              Aporte cuota: {Math.round(userA.fciQuotaSharePct)}%
                            </span>
                          </div>
                        </div>

                        {/* Usuario B */}
                        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center justify-center font-bold text-xs">
                              {userB.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-white block">
                                {userB.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 block font-mono">
                                Pagó de su bolsillo: ${Math.round(userB.outOfPocketPaid).toLocaleString("es-AR")}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-white font-mono block">
                              ${Math.round(userB.committedAmount).toLocaleString("es-AR")}
                            </span>
                            <span className="text-[10px] text-rose-300 font-mono block">
                              Aporte cuota: {Math.round(userB.fciQuotaSharePct)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progreso de la Tasa de Quemado */}
                      <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400 font-medium">Consumo del Fondo Común</span>
                          <span className="font-mono font-bold text-white">
                            {Math.round(poolSummary.burnRatePct)}%
                          </span>
                        </div>
                        <div className="w-full bg-zinc-800/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${burnRateColor}`}
                            style={{ width: `${Math.min(100, poolSummary.burnRatePct)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Acciones Rápidas del Mes */}
                    <div className="super-card rounded-3xl p-5 space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                        Gestión del Mes
                      </span>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setIsSalaryModalOpen(true)}
                          className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition"
                        >
                          <Settings className="w-4 h-4 text-blue-400 mb-1.5" />
                          <span className="text-xs font-bold text-white block">Sueldos</span>
                          <span className="text-[10px] text-zinc-400 block">Configurar base</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsFCIModalOpen(true)}
                          className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition"
                        >
                          <PiggyBank className="w-4 h-4 text-emerald-400 mb-1.5" />
                          <span className="text-xs font-bold text-white block">FCI Común</span>
                          <span className="text-[10px] text-zinc-400 block">Invertir remanente</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isClosed) handleReopenMonth();
                          else setIsCloseModalOpen(true);
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                          isClosed
                            ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
                            : "bg-white/[0.05] border border-white/[0.1] text-zinc-200 hover:bg-white/[0.08]"
                        }`}
                      >
                        {isClosed ? (
                          <>
                            <Unlock className="w-4 h-4 text-amber-400" />
                            <span>Reabrir Período de {monthLabel}</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 text-zinc-400" />
                            <span>Cerrar Período de {monthLabel}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ANÁLISIS MENSUAL */}
            {activeTab === "analisis" && (
              <div className="w-full max-w-6xl mx-auto">
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
              </div>
            )}

            {/* TAB 3: CUOTAS */}
            {activeTab === "cuotas" && (
              <div className="w-full max-w-6xl mx-auto">
                <InstallmentsManagerView
                  periodId={period.id}
                  currentYear={currentYear}
                  currentMonth={currentMonth}
                  monthName={monthLabel}
                  recurringExpenses={recurringExpenses}
                  users={users}
                  categories={categories}
                />
              </div>
            )}

            {/* TAB 4: FCI */}
            {activeTab === "fci" && (
              <div className="w-full max-w-6xl mx-auto space-y-4 animate-fade-in">
                {appConfig.features.enableSharedInvestmentsPortfolio && (
                  <div className="flex bg-zinc-900/90 p-1.5 rounded-2xl border border-white/[0.08] shadow-inner max-w-md">
                    <button
                      type="button"
                      onClick={() => setSharedInvestmentsTab("fci")}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition ${
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
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
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
                  <div className="super-card rounded-3xl p-6 space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                          Fondo Común de Inversión Conjunta (FCI)
                        </span>
                        <h2 className="text-2xl font-extrabold text-white font-mono tabular-nums">
                          ${Math.round(poolSummary.investedInFCI).toLocaleString("es-AR")}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsFCIModalOpen(true)}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-2 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Aportar al FCI</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-xs font-bold text-zinc-300 block mb-1">
                          Participación de {userA.name}
                        </span>
                        <span className="text-lg font-mono font-bold text-white">
                          {Math.round(userA.fciQuotaSharePct)}%
                        </span>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-xs font-bold text-zinc-300 block mb-1">
                          Participación de {userB.name}
                        </span>
                        <span className="text-lg font-mono font-bold text-white">
                          {Math.round(userB.fciQuotaSharePct)}%
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
