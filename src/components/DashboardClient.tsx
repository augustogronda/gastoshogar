"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
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
  Copy,
  RefreshCw,
  Repeat,
  Search,
  CheckSquare,
  ArrowLeftRight,
} from "./ui/icons";
import { forceCheckAppUpdate } from "./AppUpdateChecker";
import currentAppVersion from "../../public/version.json";
import { triggerHaptic, initAutoHaptics } from "@/lib/haptics";
import { CategoryIcon } from "./ui/icons";
import { ConfirmDialog, ToastBanner, useToast } from "./ui/ConfirmDialog";
import { QuickExpenseModal } from "./QuickExpenseModal";
import { SalaryConfigModal } from "./SalaryConfigModal";
import { FCIInvestModal } from "./FCIInvestModal";
import { MonthlyAnalyticsView } from "./MonthlyAnalyticsView";
import { InstallmentsManagerView } from "./InstallmentsManagerView";
import { LoginScreen } from "./LoginScreen";
import { PersonalDashboardView } from "./PersonalDashboardView";
import { ExpenseDetailModal, EditableExpense } from "./ExpenseDetailModal";
import { ExpenseContextMenu, ContextMenuExpense } from "./ExpenseContextMenu";
import { useLongPress } from "@/lib/use-long-press";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { PersonalInvestmentsView } from "./PersonalInvestmentsView";
import { MonthPickerModal } from "./MonthPickerModal";
import { appConfig } from "@/config/appConfig";
import { useDevice } from "@/lib/use-device";
import { DesktopDashboard } from "./desktop/DesktopDashboard";
import { IPadDashboard } from "./ipad/IPadDashboard";
import { DeviceModeSelector } from "./DeviceModeSelector";
import { HogarExpenseRow } from "./HogarExpenseRow";
import {
  getDashboardData,
  addExpenseAction,
  deleteExpenseAction,
  closeMonthAction,
  reopenMonthAction,
  logoutAction,
  duplicateSharedToPersonalExpenseAction,
  batchDeleteExpensesAction,
  batchCopyExpensesAction,
  batchMoveExpensesAction,
} from "@/app/actions";
import { hasReviewFlag } from "@/lib/expense-review";

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
    household: { id: string; name: string; currency: string; defaultRate?: number };
    users: Array<{ id: string; name: string; avatarColor: string; email?: string | null }>;
    currentUser: { id: string; name: string; avatarColor: string; email?: string | null } | null;
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
      fciWithdrawals?: Array<{
        id: string;
        amount: number;
        destination: string;
        purpose?: string | null;
        withdrawnAt: Date | string;
      }>;
    };
    poolSummary: {
      totalSalaries: number;
      salaryPool: number;
      carriedOverBalance: number;
      totalAvailablePool: number;
      fciWithdrawnToPool?: number;
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
      withdrawals?: Array<{
        id: string;
        amount: number;
        destination: string;
        purpose?: string | null;
        withdrawnAt: Date | string;
      }>;
    } | null;
    recurringExpenses: Array<any>;
    personalData: any | null;
    sharedInvestments?: any[];
    sharedInvestmentsSummary?: any;
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
  const [dashboardData, setDashboardData] = useState(initialData);
  const [isChangingMonth, setIsChangingMonth] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Caché de meses en memoria cliente y almacenamiento local del teléfono
  const dataCacheRef = useRef<Map<string, typeof initialData>>(new Map());

  // 1. Al montar el componente, hidratar meses previamente cacheados en el teléfono
  useEffect(() => {
    try {
      const stored = localStorage.getItem("gastoshogar_months_cache");
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([k, v]) => {
          dataCacheRef.current.set(k, v as typeof initialData);
        });
      }
    } catch (e) {
      console.warn("Error leyendo caché local:", e);
    }

    const cleanupHaptics = initAutoHaptics();
    return () => {
      cleanupHaptics();
    };
  }, []);

  // 2. Sincronizar datos si initialData se actualiza desde el servidor y persistir en el dispositivo
  useEffect(() => {
    setDashboardData((prev) => {
      // Preservar gastos temporales que aún estén en proceso de conciliación
      const pendingExpenses = (prev?.period?.expenses || []).filter((e) => e.id.startsWith("temp-"));
      if (pendingExpenses.length === 0) {
        return initialData;
      }
      return {
        ...initialData,
        period: {
          ...initialData.period,
          expenses: [
            ...pendingExpenses,
            ...initialData.period.expenses.filter((e) => !pendingExpenses.some((p) => p.id === e.id)),
          ],
        },
      };
    });
    if (initialData?.currentUser) {
      const key = `${initialData.currentYear}-${initialData.currentMonth}`;
      dataCacheRef.current.set(key, initialData);
    }
  }, [initialData]);

  // 3. Persistir en segundo plano (debounced) para no bloquear el hilo principal en mutaciones optimistas (0ms)
  useEffect(() => {
    if (!dashboardData?.currentUser) return;
    const key = `${dashboardData.currentYear}-${dashboardData.currentMonth}`;
    dataCacheRef.current.set(key, dashboardData);

    const timer = setTimeout(() => {
      try {
        localStorage.setItem("gastoshogar_cached_dashboard_v2", JSON.stringify(dashboardData));
        const storedMap: Record<string, any> = {};
        dataCacheRef.current.forEach((val, k) => {
          storedMap[k] = val;
        });
        localStorage.setItem("gastoshogar_months_cache", JSON.stringify(storedMap));
      } catch (e) {
        console.warn("Error sincronizando cambios con almacenamiento local:", e);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [dashboardData]);

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
    sharedInvestments = [],
    sharedInvestmentsSummary = null,
    currentYear,
    currentMonth,
  } = dashboardData;

  const [spaceMode, setSpaceMode] = useState<"hogar" | "personal">("hogar");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [personalMenuAction, setPersonalMenuAction] = useState<{
    type: "income" | "expense" | "closeOrReopen";
    seq: number;
  } | null>(null);

  const handleSpaceModeChange = (mode: "hogar" | "personal") => {
    setPersonalMenuAction(null);
    setSpaceMode(mode);
  };
  const [activeTab, setActiveTab] = useState<ActiveTab>("hogar");
  const [personalTab, setPersonalTab] = useState<"gastos" | "analisis" | "cuotas" | "tarjetas" | "inversiones">("gastos");
  const [hogarFilter, setHogarFilter] = useState<string>("ALL");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [hogarSearchQuery, setHogarSearchQuery] = useState<string>("");
  const [sharedInvestmentsTab, setSharedInvestmentsTab] = useState<"fci" | "portfolio">("fci");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isFCIModalOpen, setIsFCIModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isProcessingClose, setIsProcessingClose] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<EditableExpense | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [contextMenuExpense, setContextMenuExpense] = useState<ContextMenuExpense | null>(null);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmHogarState, setConfirmHogarState] = useState<{
    isOpen: boolean;
    type: "deleteExpense" | "reopenMonth";
    targetId?: string;
    title: string;
    description: string;
  }>({ isOpen: false, type: "deleteExpense", title: "", description: "" });

  // Selección Múltiple (Hogar)
  const [isHogarSelectionMode, setIsHogarSelectionMode] = useState(false);
  const [selectedHogarExpenseIds, setSelectedHogarExpenseIds] = useState<string[]>([]);
  const [isHogarBatchProcessing, setIsHogarBatchProcessing] = useState(false);
  const [isHogarBatchDeleteModalOpen, setIsHogarBatchDeleteModalOpen] = useState(false);
  const { toast, showToast } = useToast();
  const { device } = useDevice();

  const handleOpenDetail = (targetExp: any) => {
    setSelectedExpense({
      id: targetExp.id,
      title: targetExp.title,
      amount: targetExp.amount,
      date: targetExp.date,
      categoryId: targetExp.category.id,
      category: targetExp.category,
      paidById: targetExp.paidBy.id,
      paidBy: targetExp.paidBy,
      isFromPoolFund: targetExp.isFromPoolFund,
      notes: targetExp.notes,
      installmentNumber: targetExp.installmentNumber,
      totalInstallments: targetExp.totalInstallments,
      isPersonal: false,
    });
    setIsDetailModalOpen(true);
  };

  const handleLongPress = (targetExp: any) => {
    setContextMenuExpense({
      id: targetExp.id,
      title: targetExp.title,
      amount: targetExp.amount,
      date: targetExp.date,
      category: targetExp.category,
      paidBy: targetExp.paidBy,
      isPersonal: false,
      notes: targetExp.notes,
    });
    setIsContextMenuOpen(true);
  };

  // Pull-to-Refresh con "Pull Brusco + Mantener con Rueda de Tiempo"
  const [pullDistance, setPullDistance] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0); // 0 a 100%
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const pullRafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const lastHoldPctRef = useRef<number>(0);
  const isRefreshingRef = useRef(false);

  const PULL_DEADZONE = 45; // px antes de empezar a mostrar indicador
  const PULL_THRESHOLD = 90; // unidad interna (~175px de arrastre real del dedo)
  const HOLD_DURATION_MS = 1700; // ms manteniendo abajo para completar la rueda (1.7s, el doble)

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      cancelAnimationFrame(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdStartRef.current = null;
    lastHoldPctRef.current = 0;
    setHoldProgress(0);
  };

  const executeManualRefresh = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    clearHoldTimer();
    setIsRefreshing(true);
    setPullDistance(65);
    try {
      // 1. Limpiar caché en memoria de meses y almacenamiento local del teléfono
      dataCacheRef.current.clear();
      try {
        localStorage.removeItem("gastoshogar_months_cache");
      } catch (e) {}

      // 2. Traer datos frescos del servidor
      const freshData = await getDashboardData(currentYear, currentMonth);
      if (freshData) {
        setDashboardData(freshData);
        dataCacheRef.current.set(`${currentYear}-${currentMonth}`, freshData);
        try {
          localStorage.setItem("gastoshogar_cached_dashboard_v2", JSON.stringify(freshData));
        } catch (e) {}
      }
      router.refresh();
      showToast("Datos y caché actualizados", "success");
    } catch (e) {
      showToast("Error al refrescar datos", "error");
    } finally {
      setTimeout(() => {
        setPullDistance(0);
        setHoldProgress(0);
        setIsRefreshing(false);
        isRefreshingRef.current = false;
        setIsPulling(false);
        isPullingRef.current = false;
        hasTriggeredHapticRef.current = false;
      }, 450);
    }
  };

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      // No activar nunca si hay un modal abierto o se toca dentro de un diálogo/sheet
      if (target?.closest('[role="dialog"], [data-sheet-scroll]')) {
        touchStartRef.current = null;
        return;
      }

      if (window.scrollY <= 1 && !isRefreshingRef.current) {
        touchStartRef.current = e.touches[0].clientY;
        hasTriggeredHapticRef.current = false;
      } else {
        touchStartRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartRef.current === null || isRefreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const rawDiff = currentY - touchStartRef.current;

      if (pullRafRef.current !== null) {
        cancelAnimationFrame(pullRafRef.current);
      }

      pullRafRef.current = requestAnimationFrame(() => {
        pullRafRef.current = null;
        if (touchStartRef.current === null || isRefreshingRef.current) return;

        if (rawDiff > PULL_DEADZONE && window.scrollY <= 1) {
          const effectiveDiff = rawDiff - PULL_DEADZONE;
          // Requiere un deslizamiento largo y firme (~175px reales para llegar a PULL_THRESHOLD = 90)
          const pull = Math.min(effectiveDiff * 0.68, 105);
          setPullDistance(pull);
          if (!isPullingRef.current) {
            isPullingRef.current = true;
            setIsPulling(true);
          }

          if (pull >= PULL_THRESHOLD) {
            if (!hasTriggeredHapticRef.current) {
              triggerHaptic(12);
              hasTriggeredHapticRef.current = true;
            }
            // Iniciar rueda de tiempo sincronizada a 120Hz ProMotion mientras mantiene abajo
            if (!holdStartRef.current && holdTimerRef.current === null) {
              holdStartRef.current = performance.now();
              const stepHold = (now: number) => {
                if (!holdStartRef.current) return;
                const elapsed = now - holdStartRef.current;
                const pct = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
                if (pct !== lastHoldPctRef.current) {
                  lastHoldPctRef.current = pct;
                  setHoldProgress(pct);
                }

                if (pct >= 100) {
                  clearHoldTimer();
                  touchStartRef.current = null;
                  triggerHaptic(25);
                  executeManualRefresh();
                  return;
                }
                holdTimerRef.current = requestAnimationFrame(stepHold);
              };
              holdTimerRef.current = requestAnimationFrame(stepHold);
            }
          } else {
            // Si sube el dedo antes de completar el tiempo, reinicia la rueda
            clearHoldTimer();
            hasTriggeredHapticRef.current = false;
          }
        } else if (rawDiff <= PULL_DEADZONE) {
          clearHoldTimer();
          setPullDistance(0);
          if (isPullingRef.current) {
            isPullingRef.current = false;
            setIsPulling(false);
          }
        }
      });
    };

    const handleTouchEnd = () => {
      if (pullRafRef.current !== null) {
        cancelAnimationFrame(pullRafRef.current);
        pullRafRef.current = null;
      }
      if (touchStartRef.current === null && !isPullingRef.current) return;
      touchStartRef.current = null;
      clearHoldTimer();

      if (!isRefreshingRef.current) {
        setPullDistance(0);
        isPullingRef.current = false;
        setIsPulling(false);
        hasTriggeredHapticRef.current = false;
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      if (pullRafRef.current !== null) {
        cancelAnimationFrame(pullRafRef.current);
      }
      clearHoldTimer();
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [currentYear, currentMonth]);

  // Precarga inteligente en segundo plano de los meses contiguos (-1 y +1)
  useEffect(() => {
    const currentKey = `${currentYear}-${currentMonth}`;
    dataCacheRef.current.set(currentKey, dashboardData);

    const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevKey = `${prevY}-${prevM}`;

    const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nextKey = `${nextY}-${nextM}`;

    let isMounted = true;
    const prefetchTimer = setTimeout(async () => {
      if (!dataCacheRef.current.has(prevKey) && isMounted) {
        try {
          const prevData = await getDashboardData(prevY, prevM);
          if (isMounted && prevData) {
            dataCacheRef.current.set(prevKey, prevData);
          }
        } catch (e) {
          // Silencioso para no interferir
        }
      }
      if (!dataCacheRef.current.has(nextKey) && isMounted) {
        try {
          const nextData = await getDashboardData(nextY, nextM);
          if (isMounted && nextData) {
            dataCacheRef.current.set(nextKey, nextData);
          }
        } catch (e) {
          // Silencioso para no interferir
        }
      }
    }, 450);

    return () => {
      isMounted = false;
      clearTimeout(prefetchTimer);
    };
  }, [currentYear, currentMonth]);

  // Limpiar URL si ya estamos en el mes actual al cargar la app
  useEffect(() => {
    if (typeof window !== "undefined") {
      const now = new Date();
      const isCurrentRealMonth = currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1);
      if (isCurrentRealMonth && window.location.search) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, [currentYear, currentMonth]);

  // Manejo de navegación del navegador (botones atrás/adelante)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const now = new Date();
      const y = params.get("year") ? parseInt(params.get("year")!) : now.getFullYear();
      const m = params.get("month") ? parseInt(params.get("month")!) : (now.getMonth() + 1);
      switchMonth(y, m);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Cambio ultra-rápido de mes con soporte de caché
  const switchMonth = async (targetYear: number, targetMonth: number) => {
    if (targetYear === currentYear && targetMonth === currentMonth) return;

    const key = `${targetYear}-${targetMonth}`;
    const now = new Date();
    const isCurrentRealMonth = targetYear === now.getFullYear() && targetMonth === (now.getMonth() + 1);
    const targetUrl = isCurrentRealMonth ? "/" : `/?year=${targetYear}&month=${targetMonth}`;

    // 1. Si está en caché local, respuesta inmediata en 0ms
    if (dataCacheRef.current.has(key)) {
      const cached = dataCacheRef.current.get(key)!;
      setDashboardData(cached);
      window.history.pushState(null, "", targetUrl);
      return;
    }

    // 2. Si no está en caché, mostramos indicador visual de carga suave en la cápsula
    setIsChangingMonth(true);
    try {
      const freshData = await getDashboardData(targetYear, targetMonth);
      dataCacheRef.current.set(key, freshData);
      setDashboardData(freshData);
      window.history.pushState(null, "", targetUrl);
    } catch (err) {
      console.error("Error al cargar mes:", err);
    } finally {
      setIsChangingMonth(false);
    }
  };

  const handlePrevMonth = () => {
    const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
    switchMonth(prevY, prevM);
  };

  const handleNextMonth = () => {
    const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
    switchMonth(nextY, nextM);
  };

  // Si no hay usuario logueado en cookies, mostrar pantalla de login
  if (!currentUser) {
    return <LoginScreen />;
  }

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    try {
      localStorage.removeItem("gastoshogar_cached_dashboard_v2");
      localStorage.removeItem("gastoshogar_months_cache");
      localStorage.removeItem("gastoshogar_device_token");
      dataCacheRef.current.clear();
    } catch (e) {}
    await logoutAction();
    window.location.href = "/";
  };

  const isClosed = period.status === "CLOSED";
  const nextMonthNumber = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const nextMonthName = MONTH_NAMES[nextMonthNumber - 1];

  const handleDeleteExpense = (id: string, title?: string) => {
    setConfirmHogarState({
      isOpen: true,
      type: "deleteExpense",
      targetId: id,
      title: `¿Eliminar "${title || "este gasto"}"?`,
      description: "Se descontará del fondo común del mes y se recalcularán los saldos de bolsillo.",
    });
  };

  const handleQuickDuplicateToPersonal = async (expenseId: string) => {
    try {
      await duplicateSharedToPersonalExpenseAction({
        expenseId,
        targetUserId: currentUser?.id,
      });
      showToast("Duplicado a tus gastos personales", "success");
      router.refresh();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al duplicar a personal", "error");
    }
  };

  const pendingPersonalReviewCount = Array.isArray(personalData?.expenses)
    ? personalData.expenses.filter((e: any) => hasReviewFlag(e?.notes)).length
    : 0;

  const handleCloseMonth = async () => {
    setIsProcessingClose(true);
    try {
      await closeMonthAction(period.id);
      setIsCloseModalOpen(false);
      showToast(`Mes de ${monthLabel} cerrado con éxito`, "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al cerrar el mes", "error");
    } finally {
      setIsProcessingClose(false);
    }
  };

  const handleReopenMonth = () => {
    setConfirmHogarState({
      isOpen: true,
      type: "reopenMonth",
      title: `¿Reabrir ${monthLabel} ${currentYear}?`,
      description: "Si se trasladó saldo remanente al mes siguiente, será restablecido si dicho mes sigue abierto.",
    });
  };

  const handleOptimisticDeleteHogarExpense = async (id: string) => {
    triggerHaptic(15);
    setDeletingId(id);

    // 1. IMPACTO INMEDIATO EN CACHÉ Y ESTADO LOCAL (0ms de latencia)
    const previousData = dashboardData;
    const targetExpense = period.expenses.find((e) => e.id === id);
    const deletedAmount = targetExpense ? targetExpense.amount : 0;
    const updatedExpenses = period.expenses.filter((e) => e.id !== id);

    const newTotalExpenses = Math.max(0, dashboardData.poolSummary.totalExpenses - deletedAmount);
    const newRemainingPool = Math.max(
      0,
      dashboardData.poolSummary.totalAvailablePool - newTotalExpenses - dashboardData.poolSummary.investedInFCI
    );
    const newBurnRatePct =
      dashboardData.poolSummary.totalAvailablePool > 0
        ? (newTotalExpenses / dashboardData.poolSummary.totalAvailablePool) * 100
        : 0;

    const updatedMemberBalances = dashboardData.poolSummary.memberBalances.map((mb) => {
      if (targetExpense && !targetExpense.isFromPoolFund && mb.userId === targetExpense.paidBy.id) {
        const newOutOfPocket = Math.max(0, mb.outOfPocketPaid - deletedAmount);
        return {
          ...mb,
          outOfPocketPaid: newOutOfPocket,
          netBalance: newOutOfPocket - mb.committedAmount,
        };
      }
      return mb;
    });

    const optimisticData = {
      ...dashboardData,
      period: {
        ...dashboardData.period,
        expenses: updatedExpenses,
      },
      poolSummary: {
        ...dashboardData.poolSummary,
        totalExpenses: newTotalExpenses,
        remainingPool: newRemainingPool,
        burnRatePct: newBurnRatePct,
        memberBalances: updatedMemberBalances,
      },
    };

    setDashboardData(optimisticData);
    const cacheKey = `${currentYear}-${currentMonth}`;
    dataCacheRef.current.set(cacheKey, optimisticData);
    showToast("✓ Gasto eliminado", "success");

    // 2. Persistencia en segundo plano en la base de datos
    try {
      await deleteExpenseAction(id);
    } catch (err: unknown) {
      setDashboardData(previousData);
      dataCacheRef.current.set(cacheKey, previousData);
      showToast(err instanceof Error ? err.message : "Error al eliminar gasto", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOptimisticMoveHogarToPersonal = async (id: string) => {
    triggerHaptic(15);
    setDeletingId(id);

    const previousData = dashboardData;
    const targetExpense = period.expenses.find((e) => e.id === id);
    const deletedAmount = targetExpense ? targetExpense.amount : 0;
    const updatedExpenses = period.expenses.filter((e) => e.id !== id);

    const newTotalExpenses = Math.max(0, dashboardData.poolSummary.totalExpenses - deletedAmount);
    const newRemainingPool = Math.max(
      0,
      dashboardData.poolSummary.totalAvailablePool - newTotalExpenses - dashboardData.poolSummary.investedInFCI
    );
    const newBurnRatePct =
      dashboardData.poolSummary.totalAvailablePool > 0
        ? (newTotalExpenses / dashboardData.poolSummary.totalAvailablePool) * 100
        : 0;

    const updatedMemberBalances = dashboardData.poolSummary.memberBalances.map((mb) => {
      if (targetExpense && !targetExpense.isFromPoolFund && mb.userId === targetExpense.paidBy.id) {
        const newOutOfPocket = Math.max(0, mb.outOfPocketPaid - deletedAmount);
        return {
          ...mb,
          outOfPocketPaid: newOutOfPocket,
          netBalance: newOutOfPocket - mb.committedAmount,
        };
      }
      return mb;
    });

    const optimisticData = {
      ...dashboardData,
      period: {
        ...dashboardData.period,
        expenses: updatedExpenses,
      },
      poolSummary: {
        ...dashboardData.poolSummary,
        totalExpenses: newTotalExpenses,
        remainingPool: newRemainingPool,
        burnRatePct: newBurnRatePct,
        memberBalances: updatedMemberBalances,
      },
    };

    setDashboardData(optimisticData);
    const cacheKey = `${currentYear}-${currentMonth}`;
    dataCacheRef.current.set(cacheKey, optimisticData);
    showToast("✓ Gasto movido a Gastos Personales", "success");

    try {
      const res = await duplicateSharedToPersonalExpenseAction({
        expenseId: id,
        targetUserId: currentUser?.id,
        move: true,
      });
      if (res?.expense) {
        setDashboardData((curr) => {
          if (!curr.personalData) return curr;
          const nextPersonalExpenses = [res.expense, ...(curr.personalData.expenses || [])];
          const totalPersonalExpenses = nextPersonalExpenses.reduce((acc: number, e: any) => acc + e.amount, 0);
          const totalPersonalAvailable = curr.personalData.totalPersonalAvailable || 0;
          const nextState = {
            ...curr,
            personalData: {
              ...curr.personalData,
              expenses: nextPersonalExpenses,
              totalPersonalExpenses,
              remainingPersonalPool: Math.max(0, totalPersonalAvailable - totalPersonalExpenses),
              personalBurnRatePct:
                totalPersonalAvailable > 0 ? (totalPersonalExpenses / totalPersonalAvailable) * 100 : 0,
            },
          };
          dataCacheRef.current.set(cacheKey, nextState);
          return nextState;
        });
      }
    } catch (err: unknown) {
      setDashboardData(previousData);
      dataCacheRef.current.set(cacheKey, previousData);
      showToast(err instanceof Error ? err.message : "Error al mover gasto a personal", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOptimisticCopyHogarToPersonal = async (id: string) => {
    triggerHaptic(12);
    showToast("✓ Copiando a Gastos Personales...", "info");
    const cacheKey = `${currentYear}-${currentMonth}`;

    try {
      const res = await duplicateSharedToPersonalExpenseAction({
        expenseId: id,
        targetUserId: currentUser?.id,
        move: false,
      });

      if (res?.expense) {
        setDashboardData((curr) => {
          if (!curr.personalData) return curr;
          const nextPersonalExpenses = [res.expense, ...(curr.personalData.expenses || [])];
          const totalPersonalExpenses = nextPersonalExpenses.reduce((acc: number, e: any) => acc + e.amount, 0);
          const totalPersonalAvailable = curr.personalData.totalPersonalAvailable || 0;
          const nextState = {
            ...curr,
            personalData: {
              ...curr.personalData,
              expenses: nextPersonalExpenses,
              totalPersonalExpenses,
              remainingPersonalPool: Math.max(0, totalPersonalAvailable - totalPersonalExpenses),
              personalBurnRatePct:
                totalPersonalAvailable > 0 ? (totalPersonalExpenses / totalPersonalAvailable) * 100 : 0,
            },
          };
          dataCacheRef.current.set(cacheKey, nextState);
          return nextState;
        });
      }
      showToast("✓ Gasto copiado a Gastos Personales", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al copiar gasto a personal", "error");
    }
  };

  const handleSyncPersonalExpenses = (updatedPersonalExpenses: any[]) => {
    setDashboardData((curr) => {
      if (!curr.personalData) return curr;
      const totalPersonalExpenses = updatedPersonalExpenses.reduce((acc, e) => acc + e.amount, 0);
      const totalPersonalAvailable = curr.personalData.totalPersonalAvailable || 0;
      const remainingPersonalPool = Math.max(0, totalPersonalAvailable - totalPersonalExpenses);
      const personalBurnRatePct =
        totalPersonalAvailable > 0 ? (totalPersonalExpenses / totalPersonalAvailable) * 100 : 0;

      const nextState = {
        ...curr,
        personalData: {
          ...curr.personalData,
          expenses: updatedPersonalExpenses,
          totalPersonalExpenses,
          remainingPersonalPool,
          personalBurnRatePct,
        },
      };
      dataCacheRef.current.set(`${curr.currentYear}-${curr.currentMonth}`, nextState);
      return nextState;
    });
  };

  const executeHogarConfirmAction = async () => {
    if (confirmHogarState.type === "deleteExpense" && confirmHogarState.targetId) {
      const id = confirmHogarState.targetId;
      setConfirmHogarState((prev) => ({ ...prev, isOpen: false }));
      await handleOptimisticDeleteHogarExpense(id);
    } else if (confirmHogarState.type === "reopenMonth") {
      setConfirmHogarState((prev) => ({ ...prev, isOpen: false }));
      setIsProcessingClose(true);
      try {
        await reopenMonthAction(period.id);
        showToast(`Mes de ${monthLabel} reabierto`, "success");
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Error al reabrir el mes", "error");
      } finally {
        setIsProcessingClose(false);
      }
    }
  };

  const handleAddHogarExpense = async (data: {
    title: string;
    amount: number;
    paidById: string;
    categoryId: string;
    periodId: string;
    isFromPoolFund?: boolean;
    date?: string;
  }) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const previousData = dashboardData;

    const payer = users.find((u) => u.id === data.paidById) || {
      id: data.paidById,
      name: "Usuario",
      avatarColor: "blue",
    };
    const category = categories.find((c) => c.id === data.categoryId) || {
      id: data.categoryId,
      name: "General",
      icon: "Receipt",
      color: "zinc",
    };

    const optimisticExpense: ExpenseItem = {
      id: tempId,
      title: data.title,
      amount: data.amount,
      date: data.date || new Date().toISOString(),
      paidBy: { id: payer.id, name: payer.name },
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
      },
      isFromPoolFund: data.isFromPoolFund ?? false,
    };

    // 1. IMPACTO INMEDIATO EN CACHÉ Y ESTADO LOCAL (0ms de latencia)
    const newTotalExpenses = dashboardData.poolSummary.totalExpenses + data.amount;
    const newRemainingPool = Math.max(0, dashboardData.poolSummary.remainingPool - data.amount);
    const totalCommittedOrSpent = newTotalExpenses + (dashboardData.poolSummary.investedInFCI || 0);
    const newBurnRate =
      dashboardData.poolSummary.totalAvailablePool > 0
        ? (totalCommittedOrSpent / dashboardData.poolSummary.totalAvailablePool) * 100
        : 0;

    const updatedMemberBalances = dashboardData.poolSummary.memberBalances.map((mb) => {
      if (mb.userId === data.paidById && !data.isFromPoolFund) {
        const newOutOfPocket = mb.outOfPocketPaid + data.amount;
        return {
          ...mb,
          outOfPocketPaid: newOutOfPocket,
          netBalance: newOutOfPocket - mb.committedAmount,
        };
      }
      return mb;
    });

    const optimisticData = {
      ...dashboardData,
      period: {
        ...dashboardData.period,
        expenses: [optimisticExpense, ...dashboardData.period.expenses],
      },
      poolSummary: {
        ...dashboardData.poolSummary,
        totalExpenses: newTotalExpenses,
        remainingPool: newRemainingPool,
        burnRatePct: newBurnRate,
        memberBalances: updatedMemberBalances,
      },
    };

    setDashboardData(optimisticData);
    const cacheKey = `${currentYear}-${currentMonth}`;
    dataCacheRef.current.set(cacheKey, optimisticData);
    triggerHaptic(15);
    showToast(`✓ Gasto de $${Math.round(data.amount).toLocaleString("es-AR")} agregado`, "success");

    // 2. Conciliación en segundo plano con la base de datos
    try {
      const res = await addExpenseAction(data);
      if (res?.expense) {
        setDashboardData((curr) => {
          const updatedExpenses = curr.period.expenses.map((exp) =>
            exp.id === tempId
              ? {
                  ...exp,
                  id: res.expense.id,
                  date: res.expense.date ? new Date(res.expense.date).toISOString() : exp.date,
                }
              : exp
          );
          const reconciledData = {
            ...curr,
            period: {
              ...curr.period,
              expenses: updatedExpenses,
            },
          };
          dataCacheRef.current.set(cacheKey, reconciledData);
          return reconciledData;
        });
      }
    } catch (err: unknown) {
      console.error("Error al guardar gasto en base de datos:", err);
      setDashboardData(previousData);
      dataCacheRef.current.set(cacheKey, previousData);
      showToast(err instanceof Error ? err.message : "Error al guardar el gasto en la base de datos", "error");
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
  const hogarPct = Math.round(
    (period.incomes[0]?.contributionPct ?? household.defaultRate ?? 0.60) * 100
  );

  // Memoizar categorías activas y conteo en un solo pase O(N) en lugar de O(N * C) en cada render
  const hogarCategoriesWithCount = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const exp of period.expenses) {
      const existing = map.get(exp.category.id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(exp.category.id, { id: exp.category.id, name: exp.category.name, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [period.expenses]);

  // Memoizar filtrado y subtotal de gastos del hogar
  const { filteredHogarExpenses, filteredSubtotal, normalizedHogarQuery } = useMemo(() => {
    const q = hogarSearchQuery.trim().toLowerCase();
    const filtered = period.expenses.filter((exp) => {
      if (hogarFilter.startsWith("USER:") && exp.paidBy.id !== hogarFilter.replace("USER:", "")) {
        return false;
      }
      if (hogarFilter.startsWith("CAT:") && exp.category.id !== hogarFilter.replace("CAT:", "")) {
        return false;
      }
      if (q) {
        const matchTitle = exp.title.toLowerCase().includes(q);
        const matchCat = exp.category.name.toLowerCase().includes(q);
        const matchNotes = exp.notes?.toLowerCase().includes(q);
        const matchPayer = exp.paidBy.name.toLowerCase().includes(q);
        return matchTitle || matchCat || matchNotes || matchPayer;
      }
      return true;
    });
    const subtotal = filtered.reduce((sum, e) => sum + e.amount, 0);
    return { filteredHogarExpenses: filtered, filteredSubtotal: subtotal, normalizedHogarQuery: q };
  }, [period.expenses, hogarFilter, hogarSearchQuery]);

  const selectedHogarSubtotal = useMemo(() => {
    return period.expenses
      .filter((e) => selectedHogarExpenseIds.includes(e.id))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [period.expenses, selectedHogarExpenseIds]);

  const handleToggleSelectHogarExpense = (id: string) => {
    setSelectedHogarExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllHogarExpenses = () => {
    triggerHaptic(10);
    const visibleIds = filteredHogarExpenses.map((e) => e.id);
    const areAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedHogarExpenseIds.includes(id));
    if (areAllSelected) {
      setSelectedHogarExpenseIds([]);
    } else {
      setSelectedHogarExpenseIds(visibleIds);
    }
  };

  const handleHogarBatchCopy = async () => {
    if (selectedHogarExpenseIds.length === 0 || isHogarBatchProcessing) return;
    setIsHogarBatchProcessing(true);
    triggerHaptic(15);
    try {
      const res = await batchCopyExpensesAction({
        expenseIds: selectedHogarExpenseIds,
        fromScope: "hogar",
        targetUserId: currentUser?.id,
      });
      triggerHaptic(20);
      showToast(`¡${res.count} gasto(s) copiado(s) a tu espacio Personal!`, "success");
      setIsHogarSelectionMode(false);
      setSelectedHogarExpenseIds([]);
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast("Error al copiar los gastos a Personal", "error");
    } finally {
      setIsHogarBatchProcessing(false);
    }
  };

  const handleHogarBatchMove = async () => {
    if (selectedHogarExpenseIds.length === 0 || isHogarBatchProcessing) return;
    setIsHogarBatchProcessing(true);
    triggerHaptic(15);
    const idsToMove = [...selectedHogarExpenseIds];
    try {
      const res = await batchMoveExpensesAction({
        expenseIds: idsToMove,
        fromScope: "hogar",
        targetUserId: currentUser?.id,
      });
      triggerHaptic(20);
      showToast(`¡${res.count} gasto(s) movido(s) a tu espacio Personal!`, "success");
      setIsHogarSelectionMode(false);
      setSelectedHogarExpenseIds([]);
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast("Error al mover los gastos a Personal", "error");
    } finally {
      setIsHogarBatchProcessing(false);
    }
  };

  const handleHogarBatchDelete = async () => {
    if (selectedHogarExpenseIds.length === 0 || isHogarBatchProcessing) return;
    setIsHogarBatchProcessing(true);
    triggerHaptic(15);
    const idsToDelete = [...selectedHogarExpenseIds];
    try {
      const res = await batchDeleteExpensesAction({
        expenseIds: idsToDelete,
        isPersonal: false,
      });
      triggerHaptic(20);
      showToast(`¡${res.count} gasto(s) eliminado(s)!`, "success");
      setIsHogarSelectionMode(false);
      setSelectedHogarExpenseIds([]);
      setIsHogarBatchDeleteModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar los gastos del hogar", "error");
    } finally {
      setIsHogarBatchProcessing(false);
    }
  };

  const dashboardSharedProps = {
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
    setSpaceMode: handleSpaceModeChange,
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
    onOpenDetail: handleOpenDetail,
    onLongPress: handleLongPress,
    showToast,
    personalData,
    recurringExpenses,
    sharedInvestments,
    sharedInvestmentsSummary,
    sharedInvestmentsTab,
    setSharedInvestmentsTab,
    pendingPersonalReviewCount,
    personalMenuAction,
    setPersonalMenuAction,
    handleSyncPersonalExpenses,
    userA,
    userB,
    isHogarSelectionMode,
    setIsHogarSelectionMode,
    selectedHogarExpenseIds,
    setSelectedHogarExpenseIds,
    selectedHogarSubtotal,
    onToggleSelectHogarExpense: handleToggleSelectHogarExpense,
    onSelectAllHogarExpenses: handleSelectAllHogarExpenses,
    handleHogarBatchCopy,
    handleHogarBatchMove,
    handleHogarBatchDelete,
    isHogarBatchProcessing,
    isHogarBatchDeleteModalOpen,
    setIsHogarBatchDeleteModalOpen,
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col justify-between selection:bg-blue-600/30 relative">
      {device === "desktop" ? (
        <DesktopDashboard {...dashboardSharedProps} />
      ) : device === "ipad" ? (
        <IPadDashboard {...dashboardSharedProps} />
      ) : (
        <>
          {/* Indicador Pull-to-Refresh Flotante con Rueda de Tiempo (Estilo iOS Dynamic Island) */}
          <div
            className="fixed top-0 left-0 right-0 z-50 pointer-events-none flex justify-center will-change-transform"
            style={{
              transform: `translate3d(0, ${pullDistance > 0 ? Math.min(pullDistance * 0.65 + 10, 74) : -56}px, 0)`,
              opacity: pullDistance > 8 || isRefreshing ? 1 : 0,
              transition: isPulling ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease",
            }}
          >
        <div
          className={`flex items-center gap-2.5 px-4 py-2 rounded-full border shadow-2xl backdrop-blur-xl text-xs font-semibold transition-colors duration-200 ${
            pullDistance >= PULL_THRESHOLD || isRefreshing
              ? "bg-zinc-900/95 border-blue-400/45 text-white shadow-blue-950/50"
              : "bg-zinc-900/90 border-white/[0.15] text-zinc-200"
          }`}
        >
          {/* Rueda de tiempo circular SVG + ícono */}
          <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="9.5"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2.5"
              />
              <circle
                cx="12"
                cy="12"
                r="9.5"
                fill="none"
                stroke={
                  isRefreshing || holdProgress > 0
                    ? "#38bdf8"
                    : "rgba(255,255,255,0.55)"
                }
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={59.7}
                strokeDashoffset={
                  isRefreshing
                    ? 0
                    : pullDistance >= PULL_THRESHOLD
                    ? 59.7 * (1 - holdProgress / 100)
                    : 59.7 * (1 - Math.min(pullDistance / PULL_THRESHOLD, 1) * 0.35)
                }
              />
            </svg>
            <RefreshCw
              className={`w-2.5 h-2.5 absolute ${
                isRefreshing
                  ? "animate-spin text-sky-400"
                  : pullDistance >= PULL_THRESHOLD
                  ? "text-sky-300"
                  : "text-zinc-400"
              }`}
              style={{
                transform: isRefreshing ? undefined : `rotate(${pullDistance * 2.5}deg)`,
              }}
            />
          </div>

          <span className="text-[11px] font-semibold tracking-[-0.01em] whitespace-nowrap">
            {isRefreshing
              ? "Actualizando datos..."
              : pullDistance >= PULL_THRESHOLD
              ? `Mantené abajo para actualizar (${holdProgress}%)`
              : "Deslizá más abajo para actualizar"}
          </span>
        </div>
      </div>

      {/* Contenedor mobile-first refinado */}
      <main className="w-full max-w-md mx-auto px-4 pt-safe pb-36 flex-1 flex flex-col gap-3.5">
        
        {/* Cabecera Superior: Logo + Usuario Conectado + Selector de Mes */}
        <header className="flex items-center justify-between pt-2">
          {/* Logo y Selector de Usuario (Menú Contextual Unificado) */}
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label="Abrir menú de configuración y cuenta"
              className="w-8 h-8 rounded-xl overflow-hidden border border-white/[0.12] shadow-md shadow-indigo-500/20 shrink-0 active:scale-95 transition"
            >
              <img src="/apple-touch-icon.png" alt="Hogar" className="w-full h-full object-cover" />
            </button>

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
              <span className="text-xs font-bold text-white tracking-tight">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-zinc-400">▾</span>
            </button>

            {/* Menú Flotante Contextual (Cuenta + Acciones del Mes en Hogar o Personal) */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-60 apple-glass-sheet border border-white/[0.14] rounded-2xl p-2.5 shadow-2xl z-50 animate-fade-in space-y-1.5">
                  <div className="px-2 py-1 text-left">
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

                  <div className="border-t border-white/[0.08] pt-1.5">
                    <span className="px-2 pb-1 text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                      {spaceMode === "hogar"
                        ? `Gestión Hogar • ${monthLabel}`
                        : `Gestión Personal • ${monthLabel}`}
                    </span>

                    {spaceMode === "hogar" ? (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setIsSalaryModalOpen(true);
                          }}
                          className="w-full px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 hover:bg-white/[0.07] rounded-xl flex items-center gap-2.5 transition"
                        >
                          <Settings className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>Configurar Sueldos</span>
                        </button>

                        <button
                          type="button"
                          disabled={isProcessingClose}
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            if (isClosed) {
                              handleReopenMonth();
                            } else {
                              setIsCloseModalOpen(true);
                            }
                          }}
                          className={`w-full px-2.5 py-2 text-left text-xs font-semibold rounded-xl flex items-center gap-2.5 transition ${
                            isClosed
                              ? "text-amber-300 hover:bg-amber-500/15"
                              : "text-zinc-200 hover:bg-white/[0.07]"
                          }`}
                        >
                          {isClosed ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Reabrir Mes ({monthLabel})</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span>Cerrar Mes ({monthLabel})</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setPersonalMenuAction({ type: "income", seq: Date.now() });
                          }}
                          className="w-full px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 hover:bg-white/[0.07] rounded-xl flex items-center gap-2.5 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Editar Ingreso / Bono</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setPersonalMenuAction({ type: "closeOrReopen", seq: Date.now() });
                          }}
                          className={`w-full px-2.5 py-2 text-left text-xs font-semibold rounded-xl flex items-center gap-2.5 transition ${
                            personalData?.isClosed
                              ? "text-amber-300 hover:bg-amber-500/15"
                              : "text-zinc-200 hover:bg-white/[0.07]"
                          }`}
                        >
                          {personalData?.isClosed ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Reabrir Mes Personal</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span>Cerrar Mes Personal</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/[0.08] pt-1.5 px-1 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block px-1.5">
                      Vista y Dispositivo
                    </span>
                    <DeviceModeSelector compact className="w-full" />
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

          {/* Selector de Mes Estilo Cápsula Dynamic Island (o Badge En Vivo en vistas independientes del mes) */}
          {spaceMode === "personal" && (personalTab === "tarjetas" || personalTab === "inversiones") ? (
            <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-white/[0.08] px-3 py-1.5 rounded-full shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-zinc-200 tracking-tight">
                {personalTab === "tarjetas" ? "Ciclo Propio • Activo" : "Cartera • En Vivo"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-zinc-900/90 border border-white/[0.08] px-2 py-1 rounded-full shadow-inner">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={isChangingMonth}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-zinc-400 hover:text-white active:scale-90 transition duration-150 disabled:opacity-30"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(true)}
                className="text-xs font-bold text-white px-2 py-1 rounded-full hover:bg-white/[0.08] tracking-tight flex items-center gap-1.5 transition active:scale-95 group"
                title="Tocar para seleccionar mes"
              >
                {isChangingMonth ? (
                  <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span className="text-[11px]">{monthLabel}</span>
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
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-zinc-400 hover:text-white active:scale-90 transition duration-150 disabled:opacity-30"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </header>

        {/* TOGGLE PRINCIPAL: HOGAR vs PERSONAL (Apple HIG Segmented Control) */}
        <div
          role="tablist"
          aria-label="Espacio de gastos"
          className="flex apple-segmented-track p-1 rounded-[14px] gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={spaceMode === "hogar"}
            onClick={() => {
              if (spaceMode !== "hogar") triggerHaptic(10);
              handleSpaceModeChange("hogar");
            }}
            className={`flex-1 min-h-[38px] py-2 px-3 rounded-[10px] text-[13px] tracking-[-0.01em] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-[0.98] ${
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
              handleSpaceModeChange("personal");
            }}
            className={`flex-1 min-h-[38px] py-2 px-3 rounded-[10px] text-[13px] tracking-[-0.01em] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-[0.98] ${
              spaceMode === "personal"
                ? "apple-segment-active-personal"
                : "text-zinc-300 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Personal ({currentUser.name})</span>
            {pendingPersonalReviewCount > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold border flex items-center gap-1 ${
                  spaceMode === "personal"
                    ? "bg-[#FF9F0A] text-zinc-950 border-amber-300 shadow-sm"
                    : "bg-[#FF9F0A]/20 text-amber-300 border-[#FF9F0A]/40"
                }`}
                title={`${pendingPersonalReviewCount} gasto(s) de tarjeta pendientes de revisar`}
              >
                {spaceMode !== "personal" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F0A] animate-ping" />
                )}
                {pendingPersonalReviewCount}
              </span>
            )}
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
              activeTab={personalTab}
              onTabChange={setPersonalTab}
              externalMenuAction={personalMenuAction}
              onResetExternalMenuAction={() => setPersonalMenuAction(null)}
              onSyncPersonalExpenses={handleSyncPersonalExpenses}
            />
          )
        ) : (
          /* ========================================================= */
          /* MODO HOGAR (Fondo Común 60% e Inversiones Compartidas)    */
          /* ========================================================= */
          <div className="space-y-4">
            {/* TAB 1: HOGAR / GASTOS PRINCIPALES */}
            {activeTab === "hogar" && (
              <div className="space-y-4 animate-fade-in">
                {/* Tarjeta Principal: Termómetro del Fondo Común (Obsidian Glass) */}
                <section className="super-card rounded-3xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-blue-400" />
                      Presupuesto Común ({hogarPct}%)
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

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">
                        Gastado del Mes
                      </span>
                      <span className="text-[28px] leading-tight font-extrabold text-white tracking-[-0.03em] font-mono tabular-nums block">
                        ${Math.round(poolSummary.totalExpenses).toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div className="text-right bg-blue-500/[0.08] border border-blue-400/20 rounded-2xl px-3.5 py-2 flex flex-col justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block mb-0.5">
                        Remanente Libre
                      </span>
                      <span
                        className={`text-lg leading-tight font-extrabold font-mono tabular-nums tracking-[-0.02em] ${
                          poolSummary.remainingPool < 0 ? "text-rose-400" : "text-white"
                        }`}
                      >
                        ${Math.round(poolSummary.remainingPool).toLocaleString("es-AR")}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono tabular-nums mt-0.5">
                        de ${Math.round(poolSummary.totalAvailablePool).toLocaleString("es-AR")} disp.
                      </span>
                    </div>
                  </div>

                  {/* Sub-desglose si hay saldo arrastrado, invertido o retiros del FCI */}
                  {(poolSummary.carriedOverBalance > 0 ||
                    poolSummary.investedInFCI > 0 ||
                    (poolSummary.fciWithdrawnToPool && poolSummary.fciWithdrawnToPool > 0)) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] font-medium">
                      {poolSummary.carriedOverBalance > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono tabular-nums">
                          +${Math.round(poolSummary.carriedOverBalance).toLocaleString("es-AR")} mes anterior
                        </span>
                      )}
                      {!!poolSummary.fciWithdrawnToPool && poolSummary.fciWithdrawnToPool > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono tabular-nums">
                          +${Math.round(poolSummary.fciWithdrawnToPool).toLocaleString("es-AR")} retiro de FCI
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
                  <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${burnRateColor}`}
                      style={{ width: `${Math.min(100, poolSummary.burnRatePct)}%` }}
                    />
                  </div>
                </section>

                {/* Lista de Gastos con Buscador estilo iOS y Filtros Rápidos */}
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-semibold text-white tracking-[-0.015em]">
                        Gastos de {monthLabel}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.07] border border-white/[0.08] text-[11px] font-semibold text-zinc-300 tabular-nums">
                        {period.expenses.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {period.expenses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(8);
                            const next = !isHogarSelectionMode;
                            setIsHogarSelectionMode(next);
                            if (!next) setSelectedHogarExpenseIds([]);
                          }}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-xl transition flex items-center gap-1 active:scale-95 cursor-pointer ${
                            isHogarSelectionMode
                              ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/40"
                              : "text-zinc-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08]"
                          }`}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>{isHogarSelectionMode ? "Listo" : "Seleccionar"}</span>
                        </button>
                      )}
                      <button
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-xs font-semibold text-blue-300/90 hover:text-blue-200 active:scale-95 flex items-center gap-1 transition cursor-pointer"
                        title="Gestionar categorías"
                      >
                        <Tag className="w-3.5 h-3.5 text-blue-400/80" />
                        <span>Categorías</span>
                      </button>
                    </div>
                  </div>

                  {/* Barra de control de Selección Múltiple (Hogar) */}
                  {isHogarSelectionMode && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs animate-fade-in shadow-inner">
                      <span className="text-zinc-200 font-medium">
                        <strong className="text-white font-mono">{selectedHogarExpenseIds.length}</strong> de{" "}
                        {filteredHogarExpenses.length} seleccionado{selectedHogarExpenseIds.length === 1 ? "" : "s"}
                      </span>
                      <button
                        type="button"
                        onClick={handleSelectAllHogarExpenses}
                        className="text-xs font-bold text-blue-300 hover:text-blue-200 underline transition cursor-pointer"
                      >
                        {selectedHogarExpenseIds.length === filteredHogarExpenses.length &&
                        filteredHogarExpenses.length > 0
                          ? "Deseleccionar todos"
                          : "Seleccionar todos"}
                      </button>
                    </div>
                  )}

                  {/* Buscador en Tiempo Real UISearchTextField + Chips por Pagador y Categoría */}
                  {period.expenses.length > 0 && (
                    <div className="space-y-2">
                      {/* Input de Búsqueda Rápida */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={hogarSearchQuery}
                          onChange={(e) => setHogarSearchQuery(e.target.value)}
                          placeholder="Buscar por comercio, categoría o nota..."
                          className="w-full pl-9 pr-8 py-2 rounded-xl bg-[rgba(118,118,128,0.24)] border border-white/[0.07] focus:bg-[rgba(118,118,128,0.32)] focus:border-blue-400/50 text-[13px] text-white placeholder:text-zinc-400 focus:outline-none transition"
                        />
                        {hogarSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setHogarSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-300 hover:text-white bg-white/[0.12]"
                            title="Limpiar búsqueda"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Chips de Filtro Rápido en 1 toque (Por pagador o categoría) */}
                      <div
                        className="flex items-center gap-1.5 overflow-x-auto touch-pan-x overscroll-x-contain no-scrollbar py-1 -mx-1 px-1 scroll-smooth"
                        style={{ WebkitOverflowScrolling: "touch" }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(8);
                            setHogarFilter("ALL");
                          }}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition active:scale-95 select-none ${
                            hogarFilter === "ALL"
                              ? "bg-blue-600 text-white shadow-sm font-bold"
                              : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                          }`}
                        >
                          Todos ({period.expenses.length})
                        </button>
                        {users[0] && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic(8);
                              setHogarFilter(hogarFilter === `USER:${users[0].id}` ? "ALL" : `USER:${users[0].id}`);
                            }}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition active:scale-95 select-none ${
                              hogarFilter === `USER:${users[0].id}`
                                ? "bg-blue-600 text-white shadow-sm font-bold"
                                : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                            }`}
                          >
                            Pagó {users[0].name}
                          </button>
                        )}
                        {users[1] && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic(8);
                              setHogarFilter(hogarFilter === `USER:${users[1].id}` ? "ALL" : `USER:${users[1].id}`);
                            }}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition active:scale-95 select-none ${
                              hogarFilter === `USER:${users[1].id}`
                                ? "bg-rose-600 text-white shadow-sm font-bold"
                                : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                            }`}
                          >
                            Pagó {users[1].name}
                          </button>
                        )}
                        {/* Categorías con gastos en el mes */}
                        {hogarCategoriesWithCount.map((cat) => {
                          const isSelected = hogarFilter === `CAT:${cat.id}`;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                triggerHaptic(8);
                                setHogarFilter(isSelected ? "ALL" : `CAT:${cat.id}`);
                              }}
                              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition active:scale-95 select-none flex items-center gap-1.5 ${
                                isSelected
                                  ? "bg-blue-600 text-white shadow-sm font-bold ring-1 ring-blue-400/60"
                                  : "bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/[0.08]"
                              }`}
                            >
                              <CategoryIcon name={cat.name} className="w-3.5 h-3.5" />
                              <span>{cat.name} ({cat.count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {period.expenses.length === 0 ? (
                    <div className="super-card rounded-2xl p-8 text-center">
                      <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
                      <p className="text-sm font-medium text-zinc-300">No hay gastos en este mes</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Tocá el botón <span className="text-blue-400 font-semibold">+ Nuevo Gasto</span> para cargar el primero.
                      </p>
                    </div>
                  ) : (() => {
                    const q = normalizedHogarQuery;

                    return (
                      <div className="space-y-2">
                        {(hogarFilter !== "ALL" || q !== "") && (
                          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-[11px]">
                            <span className="text-zinc-300">
                              Mostrando <strong className="text-white">{filteredHogarExpenses.length}</strong> gasto(s)
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-300 tabular-nums">
                                Subtotal: ${Math.round(filteredSubtotal).toLocaleString("es-AR")}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setHogarFilter("ALL");
                                  setHogarSearchQuery("");
                                }}
                                className="text-[10px] font-bold text-zinc-400 hover:text-white underline"
                              >
                                Limpiar
                              </button>
                            </div>
                          </div>
                        )}

                        {filteredHogarExpenses.length === 0 ? (
                          <div className="super-card-subtle rounded-2xl p-6 text-center">
                            <p className="text-xs text-zinc-400">No se encontraron gastos con ese criterio.</p>
                          </div>
                        ) : (
                          filteredHogarExpenses.map((exp) => (
                            <HogarExpenseRow
                              key={exp.id}
                              exp={exp}
                              users={users}
                              deletingId={deletingId}
                              isSelectionMode={isHogarSelectionMode}
                              isSelected={selectedHogarExpenseIds.includes(exp.id)}
                              onToggleSelect={handleToggleSelectHogarExpense}
                              onOpenDetail={(targetExp) => {
                                setSelectedExpense({
                                  id: targetExp.id,
                                  title: targetExp.title,
                                  amount: targetExp.amount,
                                  date: targetExp.date,
                                  categoryId: targetExp.category.id,
                                  category: targetExp.category,
                                  paidById: targetExp.paidBy.id,
                                  paidBy: targetExp.paidBy,
                                  isFromPoolFund: targetExp.isFromPoolFund,
                                  notes: targetExp.notes,
                                  installmentNumber: targetExp.installmentNumber,
                                  totalInstallments: targetExp.totalInstallments,
                                  isPersonal: false,
                                });
                                setIsDetailModalOpen(true);
                              }}
                              onLongPress={(targetExp) => {
                                setContextMenuExpense({
                                  id: targetExp.id,
                                  title: targetExp.title,
                                  amount: targetExp.amount,
                                  date: targetExp.date,
                                  category: targetExp.category,
                                  paidBy: targetExp.paidBy,
                                  isPersonal: false,
                                  notes: targetExp.notes,
                                });
                                setIsContextMenuOpen(true);
                              }}
                              showToast={showToast}
                            />
                          ))
                        )}
                      </div>
                    );
                  })()}
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
              if (isClosed) {
                handleReopenMonth();
              } else {
                setIsCloseModalOpen(true);
              }
            }}
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

        {/* TAB 4: FCI INVERSIÓN (con soporte de Feature Flag para multi-activo) */}
        {activeTab === "fci" && (
          <div className="space-y-4 animate-fade-in">
            {/* Si el flag está activo en appConfig, mostrar sub-selector */}
            {appConfig.features.enableSharedInvestmentsPortfolio && (
              <div className="flex bg-zinc-900/90 p-1 rounded-2xl border border-white/[0.08] shadow-inner mb-3">
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
                summary={sharedInvestmentsSummary}
              />
            ) : (
              <>
                <div className="super-card rounded-3xl p-5 shadow-xl relative overflow-hidden">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                    Fondo Común de Inversión Pareja
                  </span>
                  <span className="text-3xl font-extrabold text-white block mt-2 font-mono tabular-nums">
                    ${Math.round(investmentFund?.currentValue || 0).toLocaleString("es-AR")}
                  </span>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Patrimonio acumulado con los remanentes mensuales del Fondo Común.
                  </p>
                  <button
                    onClick={() => setIsFCIModalOpen(true)}
                    className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-semibold shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition duration-150"
                  >
                    Gestionar Ahorro e Inversión
                  </button>
                </div>

                {/* Card de Remanente Hipotético del Mes en Curso */}
                <div className="super-card rounded-3xl p-5 border border-emerald-500/25 bg-gradient-to-br from-emerald-950/30 via-zinc-900/90 to-zinc-950">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <PiggyBank className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block">
                          Remanente Hipotético • {monthLabel}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          Proyección actual del mes en curso
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tabular-nums">
                      {Math.max(0, 100 - Math.round(poolSummary.burnRatePct))}% libre
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-black/30 border border-white/[0.07] rounded-2xl p-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                        Disponible p/ Transferir
                      </span>
                      <span
                        className={`text-xl font-extrabold font-mono tabular-nums mt-1 block ${
                          poolSummary.remainingPool > 0 ? "text-emerald-400" : "text-zinc-400"
                        }`}
                      >
                        ${Math.round(Math.max(0, poolSummary.remainingPool)).toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div className="bg-black/30 border border-white/[0.07] rounded-2xl p-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                        Ya Invertido en {monthLabel}
                      </span>
                      <span className="text-xl font-extrabold text-white font-mono tabular-nums mt-1 block">
                        ${Math.round(poolSummary.investedInFCI || 0).toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                    <p className="text-[11px] text-zinc-300 leading-snug">
                      {poolSummary.remainingPool > 0
                        ? `Si cerraran ${monthLabel} hoy, podrían sumar $${Math.round(poolSummary.remainingPool).toLocaleString("es-AR")} extra al FCI.`
                        : poolSummary.investedInFCI > 0
                        ? `Ya transfirieron todo el remanente disponible de ${monthLabel} al FCI.`
                        : `Actualmente no queda excedente libre del Fondo Común en ${monthLabel}.`}
                    </p>
                    {poolSummary.remainingPool > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsFCIModalOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/35 text-xs font-bold shrink-0 flex items-center gap-1 active:scale-95 transition"
                      >
                        <span>Invertir</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
              </>
            )}
          </div>
        )}
      </div>
    )}
  </main>

      {/* Barra de Navegación Inferior Unificada (Apple HIG Liquid Glass Tab Bar) */}
      <nav
        aria-label="Navegación principal"
        className="super-nav fixed bottom-0 left-0 right-0 z-30"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 0px))" }}
      >
        {spaceMode === "hogar" ? (
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
              onClick={() => {
                if (activeTab !== "hogar") triggerHaptic(10);
                setActiveTab("hogar");
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
              className={`transition-all duration-200 active:scale-95 ${
                activeTab === "hogar"
                  ? "text-[#0A84FF] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Wallet className={`w-5 h-5 mb-1 ${activeTab === "hogar" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] tracking-[-0.01em] leading-none font-medium">
                Gastos
              </span>
            </button>

            {/* Tab 2: Análisis */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== "analisis") triggerHaptic(10);
                setActiveTab("analisis");
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
              className={`transition-all duration-200 active:scale-95 ${
                activeTab === "analisis"
                  ? "text-[#0A84FF] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <BarChart3 className={`w-5 h-5 mb-1 ${activeTab === "analisis" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] tracking-[-0.01em] leading-none font-medium">
                Análisis
              </span>
            </button>

            {/* Tab 3: Cuotas */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== "cuotas") triggerHaptic(10);
                setActiveTab("cuotas");
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
              className={`transition-all duration-200 active:scale-95 ${
                activeTab === "cuotas"
                  ? "text-[#0A84FF] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Repeat className={`w-5 h-5 mb-1 ${activeTab === "cuotas" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] tracking-[-0.01em] leading-none font-medium">
                Cuotas
              </span>
            </button>

            {/* Tab 4: FCI */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== "fci") triggerHaptic(10);
                setActiveTab("fci");
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
              className={`transition-all duration-200 active:scale-95 ${
                activeTab === "fci"
                  ? "text-[#0A84FF] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <PiggyBank className={`w-5 h-5 mb-1 ${activeTab === "fci" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] tracking-[-0.01em] leading-none font-medium">
                FCI
              </span>
            </button>
          </div>
        ) : (
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
            {/* Personal Tab 1: Gastos */}
            <button
              type="button"
              onClick={() => {
                if (personalTab !== "gastos") triggerHaptic(10);
                setPersonalTab("gastos");
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
              className={`transition-all duration-200 active:scale-95 ${
                personalTab === "gastos"
                  ? "text-[#7D7AFF] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Wallet className={`w-5 h-5 mb-1 ${personalTab === "gastos" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] tracking-[-0.01em] leading-none font-medium">
                Gastos
              </span>
            </button>

            {/* Personal Tab 2: Análisis */}
            <button
              type="button"
              onClick={() => {
                if (personalTab !== "analisis") triggerHaptic(10);
                setPersonalTab("analisis");
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
              className={`transition-all duration-200 active:scale-95 ${
                personalTab === "analisis"
                  ? "text-[#7D7AFF] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <BarChart3 className={`w-5 h-5 mb-1 ${personalTab === "analisis" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] tracking-[-0.01em] leading-none font-medium">
                Análisis
              </span>
            </button>

            {/* Personal Tab 3: Cuotas */}
            <button
              type="button"
              onClick={() => {
                if (personalTab !== "cuotas") triggerHaptic(10);
                setPersonalTab("cuotas");
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
              className={`transition-all duration-200 active:scale-95 ${
                personalTab === "cuotas"
                  ? "text-[#7D7AFF] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Repeat className={`w-5 h-5 mb-1 ${personalTab === "cuotas" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] tracking-[-0.01em] leading-none font-medium">
                Cuotas
              </span>
            </button>

            {/* Personal Tab 4: Tarjetas */}
            <button
              type="button"
              onClick={() => {
                if (personalTab !== "tarjetas") triggerHaptic(10);
                setPersonalTab("tarjetas");
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
              className={`transition-all duration-200 active:scale-95 ${
                personalTab === "tarjetas"
                  ? "text-[#7D7AFF] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <CreditCard className={`w-5 h-5 mb-1 ${personalTab === "tarjetas" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] tracking-[-0.01em] leading-none font-medium">
                Tarjetas
              </span>
            </button>

            {/* Personal Tab 5: Inversión */}
            <button
              type="button"
              onClick={() => {
                if (personalTab !== "inversiones") triggerHaptic(10);
                setPersonalTab("inversiones");
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
              className={`transition-all duration-200 active:scale-95 ${
                personalTab === "inversiones"
                  ? "text-[#7D7AFF] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <TrendingUp className={`w-5 h-5 mb-1 ${personalTab === "inversiones" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] tracking-[-0.01em] leading-none font-medium">
                Inversión
              </span>
            </button>
          </div>
        )}
      </nav>
      </>
    )}

      {/* Modales */}
      <QuickExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        periodId={period.id}
        users={users}
        categories={categories}
        defaultPayerId={currentUser.id}
        onAddExpense={handleAddHogarExpense}
      />

      <SalaryConfigModal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        periodId={period.id}
        monthName={monthLabel}
        year={currentYear}
        users={users}
        incomes={period.incomes}
        defaultRate={household.defaultRate ?? 0.60}
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
        withdrawals={investmentFund?.withdrawals || []}
      />

      {/* Modal de Confirmación de Cierre Mensual */}
      {isCloseModalOpen && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          style={{ minHeight: "100vh", minWidth: "100vw" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCloseModalOpen(false);
          }}
        >
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
                className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition cursor-pointer"
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
                className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-amber-400/20 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isProcessingClose ? "Cerrando período..." : `Confirmar Cierre de ${monthLabel}`}
                </span>
              </button>

              <button
                onClick={() => setIsCloseModalOpen(false)}
                disabled={isProcessingClose}
                className="w-full py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 font-medium text-xs active:scale-[0.98] transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
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
        onDeleteExpense={handleOptimisticDeleteHogarExpense}
        onMoveExpense={handleOptimisticMoveHogarToPersonal}
        onCopyExpense={handleOptimisticCopyHogarToPersonal}
        onUpdateExpense={(updated) => {
          setDashboardData((curr) => {
            const oldExp = curr.period.expenses.find((e) => e.id === updated.id);
            const diff = oldExp ? updated.amount - oldExp.amount : 0;
            const updatedExpenses = curr.period.expenses.map((e) =>
              e.id === updated.id
                ? {
                    ...e,
                    title: updated.title,
                    amount: updated.amount,
                    date: updated.date,
                    category: updated.category || e.category,
                    paidBy: updated.paidBy || e.paidBy,
                    notes: updated.notes,
                  }
                : e
            );
            const newTotalExpenses = Math.max(0, curr.poolSummary.totalExpenses + diff);
            const newRemainingPool = Math.max(
              0,
              curr.poolSummary.totalAvailablePool - newTotalExpenses - curr.poolSummary.investedInFCI
            );
            const newBurnRatePct =
              curr.poolSummary.totalAvailablePool > 0
                ? (newTotalExpenses / curr.poolSummary.totalAvailablePool) * 100
                : 0;
            const nextState = {
              ...curr,
              period: {
                ...curr.period,
                expenses: updatedExpenses,
              },
              poolSummary: {
                ...curr.poolSummary,
                totalExpenses: newTotalExpenses,
                remainingPool: newRemainingPool,
                burnRatePct: newBurnRatePct,
              },
            };
            dataCacheRef.current.set(`${currentYear}-${currentMonth}`, nextState);
            return nextState;
          });
          showToast("✓ Gasto actualizado", "success");
        }}
      />

      {/* Menú Contextual iOS (Long Press) para Gastos del Hogar */}
      <ExpenseContextMenu
        isOpen={isContextMenuOpen}
        onClose={() => {
          setIsContextMenuOpen(false);
          setContextMenuExpense(null);
        }}
        expense={contextMenuExpense}
        isPersonal={false}
        onOpenDetail={(exp) => {
          setSelectedExpense({
            id: exp.id,
            title: exp.title,
            amount: exp.amount,
            date: exp.date,
            categoryId: exp.category?.id,
            category: exp.category as any,
            paidById: exp.paidBy?.id,
            paidBy: exp.paidBy as any,
            notes: exp.notes,
            installmentNumber: exp.installmentNumber,
            totalInstallments: exp.totalInstallments,
            isPersonal: false,
          });
          setIsDetailModalOpen(true);
        }}
        onCopyExpense={handleOptimisticCopyHogarToPersonal}
        onMoveExpense={handleOptimisticMoveHogarToPersonal}
        onDeleteExpense={handleOptimisticDeleteHogarExpense}
      />

      {/* Modal de Gestión de Categorías */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onCategoriesChange={(nextCats) => {
          setDashboardData((curr) => ({
            ...curr,
            categories: nextCats as typeof curr.categories,
          }));
        }}
      />

      {/* Selector Rápido de Meses */}
      <MonthPickerModal
        isOpen={isMonthPickerOpen}
        onClose={() => setIsMonthPickerOpen(false)}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onSelectMonth={switchMonth}
      />

      {/* Botón de Acción Rápida Flotante (+) en Hogar Compartido (Solo en Móvil) */}
      {device === "mobile" && spaceMode === "hogar" && !isHogarSelectionMode && (activeTab === "hogar" || activeTab === "analisis") && (
        <div
          className="fixed left-0 right-0 z-40 pointer-events-none"
          style={{ bottom: "calc(68px + max(8px, env(safe-area-inset-bottom, 0px)))" }}
        >
          <div className="w-full max-w-md mx-auto px-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                setIsExpenseModalOpen(true);
              }}
              className="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-[0_10px_30px_rgba(37,99,235,0.6)] border border-blue-400/40 active:scale-95 transition-all"
              title="Cargar nuevo gasto compartido"
            >
              <Plus className="w-4 h-4 stroke-[2.8]" />
              <span>Nuevo Gasto</span>
            </button>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmación Nativo Integrado (Hogar) */}
      <ConfirmDialog
        isOpen={confirmHogarState.isOpen}
        title={confirmHogarState.title}
        description={confirmHogarState.description}
        confirmLabel={confirmHogarState.type === "reopenMonth" ? "Reabrir Mes" : "Eliminar"}
        variant={confirmHogarState.type === "reopenMonth" ? "warning" : "danger"}
        isLoading={isProcessingClose || !!deletingId}
        onConfirm={executeHogarConfirmAction}
        onCancel={() => setConfirmHogarState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Diálogo de Confirmación para Eliminación en Lote (Hogar) */}
      <ConfirmDialog
        isOpen={isHogarBatchDeleteModalOpen}
        title={`¿Eliminar ${selectedHogarExpenseIds.length} gasto${selectedHogarExpenseIds.length > 1 ? "s" : ""}?`}
        description={`Esta acción eliminará de forma permanente los ${selectedHogarExpenseIds.length} gastos seleccionados del Hogar.`}
        confirmLabel={`Eliminar (${selectedHogarExpenseIds.length})`}
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isHogarBatchProcessing}
        onConfirm={handleHogarBatchDelete}
        onCancel={() => setIsHogarBatchDeleteModalOpen(false)}
      />

      {/* Barra de Acciones Flotante por Lote (Hogar -> Personal / Eliminar) */}
      {isHogarSelectionMode && spaceMode === "hogar" && activeTab === "hogar" && (
        <div className="fixed bottom-20 inset-x-3 max-w-lg mx-auto sm:bottom-6 z-50 animate-slide-up">
          <div className="rounded-2xl p-3 border border-white/[0.15] shadow-2xl bg-zinc-950/92 backdrop-blur-xl flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-zinc-300">
                <strong className="text-white font-mono">{selectedHogarExpenseIds.length}</strong> seleccionado{selectedHogarExpenseIds.length === 1 ? "" : "s"}
                {selectedHogarSubtotal > 0 && (
                  <span className="text-blue-300 font-mono font-bold ml-1.5">
                    • ${Math.round(selectedHogarSubtotal).toLocaleString("es-AR")}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setIsHogarSelectionMode(false);
                  setSelectedHogarExpenseIds([]);
                }}
                className="text-[11px] font-semibold text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/[0.08] transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleHogarBatchCopy}
                disabled={selectedHogarExpenseIds.length === 0 || isHogarBatchProcessing}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/30 text-xs font-semibold active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-purple-400" />
                <span className="truncate">Copiar a Personal</span>
              </button>
              <button
                type="button"
                onClick={handleHogarBatchMove}
                disabled={selectedHogarExpenseIds.length === 0 || isHogarBatchProcessing}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-500/40 text-xs font-semibold active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-300" />
                <span className="truncate">Mover a Personal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(12);
                  setIsHogarBatchDeleteModalOpen(true);
                }}
                disabled={selectedHogarExpenseIds.length === 0 || isHogarBatchProcessing}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="truncate">Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación Flotante Toast */}
      <ToastBanner toast={toast} />
    </div>
  );
}
