"use server";

import { prisma } from "@/lib/prisma";
import { ensureDefaultHousehold } from "@/lib/db-init";
import { calculateMonthlyPool } from "@/lib/finance-engine";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import {
  hydrateInvestments,
  searchTickers,
  fetchTickerQuote,
  getExchangeRates,
  POPULAR_ARGENTINA_ASSETS,
} from "@/lib/investments-service";

export async function getDashboardData(targetYear?: number, targetMonth?: number) {
  const cookieStore = await cookies();
  const loggedUserId = cookieStore.get("auth_user_id")?.value;

  const now = new Date();
  const year = targetYear ?? now.getFullYear();
  const month = targetMonth ?? (now.getMonth() + 1);

  // Si no hay usuario logueado (ej. tras logout), no disparar consultas pesadas innecesarias
  if (!loggedUserId) {
    return {
      household: { id: "", name: "Finanzas Hogar", currency: "ARS" },
      users: [],
      currentUser: null,
      categories: [],
      period: {
        id: "",
        year,
        month,
        status: "OPEN",
        carriedOverBalance: 0,
        incomes: [],
        expenses: [],
        investmentTransfer: null,
      },
      poolSummary: {
        totalSalaries: 0,
        salaryPool: 0,
        carriedOverBalance: 0,
        totalAvailablePool: 0,
        fciWithdrawnToPool: 0,
        investedInFCI: 0,
        totalExpenses: 0,
        remainingPool: 0,
        burnRatePct: 0,
        memberBalances: [],
      },
      investmentFund: null,
      categoriesWithUsage: [],
      recurringExpenses: [],
      personalData: null,
      currentYear: year,
      currentMonth: month,
    };
  }

  const household = await ensureDefaultHousehold();

  // Buscar o crear el período
  let period = await prisma.monthlyPeriod.findUnique({
    where: {
      householdId_year_month: {
        householdId: household.id,
        year,
        month,
      },
    },
    include: {
      incomes: {
        include: { user: true },
      },
      expenses: {
        include: {
          paidBy: true,
          category: true,
        },
        orderBy: {
          date: "desc",
        },
      },
      investmentTransfer: true,
      fciWithdrawals: {
        orderBy: {
          withdrawnAt: "desc",
        },
      },
    },
  });

  if (!period) {
    // Buscar si el mes anterior tenía sueldos cargados para heredarlos por defecto
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevPeriod = await prisma.monthlyPeriod.findUnique({
      where: {
        householdId_year_month: {
          householdId: household.id,
          year: prevYear,
          month: prevMonth,
        },
      },
      include: { incomes: true },
    });

    period = await prisma.monthlyPeriod.create({
      data: {
        year,
        month,
        householdId: household.id,
        incomes: {
          create: household.users.map((u) => {
            const prevIncome = prevPeriod?.incomes.find((i) => i.userId === u.id);
            const amount = prevIncome?.amount ?? 0;
            const pct = prevIncome?.contributionPct ?? 0.60;
            return {
              userId: u.id,
              amount,
              contributionPct: pct,
              targetPoolAmount: amount * pct,
            };
          }),
        },
      },
      include: {
        incomes: {
          include: { user: true },
        },
        expenses: {
          include: {
            paidBy: true,
            category: true,
          },
          orderBy: {
            date: "desc",
          },
        },
        investmentTransfer: true,
        fciWithdrawals: {
          orderBy: {
            withdrawnAt: "desc",
          },
        },
      },
    });
  }

  // Agrupar gastos por pagador
  const outOfPocketByUser: Record<string, number> = {};
  let poolFundExpenses = 0;

  for (const user of household.users) {
    outOfPocketByUser[user.id] = 0;
  }

  for (const expense of period.expenses) {
    if (expense.isFromPoolFund) {
      poolFundExpenses += expense.amount;
    } else {
      outOfPocketByUser[expense.paidById] =
        (outOfPocketByUser[expense.paidById] ?? 0) + expense.amount;
    }
  }

  // Preparar input para el motor financiero
  const engineMembers = household.users.map((u) => {
    const incomeRecord = period.incomes.find((i) => i.userId === u.id);
    return {
      userId: u.id,
      name: u.name,
      salary: incomeRecord?.amount ?? 0,
      contributionPct: incomeRecord?.contributionPct ?? 0.60,
      outOfPocketPaid: outOfPocketByUser[u.id] ?? 0,
    };
  });

  const investedInFCI = period.investmentTransfer ? period.investmentTransfer.amount : 0;
  const carriedOver = period.carriedOverBalance || 0;
  const fciWithdrawnToPool = (period.fciWithdrawals || [])
    .filter((w) => w.destination === "POOL_FUND")
    .reduce((acc, w) => acc + w.amount, 0);

  const poolSummary = calculateMonthlyPool(
    engineMembers,
    poolFundExpenses,
    carriedOver,
    investedInFCI,
    fciWithdrawnToPool
  );

  // Obtener Fondo de Inversión con aportes y retiros
  const investmentFund = await prisma.investmentFund.findFirst({
    where: { householdId: household.id },
    include: {
      contributions: {
        orderBy: { investedAt: "desc" },
      },
      withdrawals: {
        orderBy: { withdrawnAt: "desc" },
      },
    },
  });

  // Obtener Cuotas y Gastos Recurrentes activos del hogar
  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: {
      householdId: household.id,
      isActive: true,
    },
    include: {
      paidBy: true,
      category: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Calcular si cada cuota recurrente ya fue cargada o qué número de cuota toca este mes
  const activeInstallmentsWithStatus = recurringExpenses.map((rec) => {
    // Meses transcurridos desde el inicio
    const monthsElapsed = (year - rec.startYear) * 12 + (month - rec.startMonth);
    const installmentNumber = monthsElapsed + 1;

    const isApplicableThisMonth =
      monthsElapsed >= 0 &&
      (!rec.totalInstallments || installmentNumber <= rec.totalInstallments);

    // Verificar si ya existe un gasto en este período imputado a esta cuota
    const alreadyAppliedExpense = period.expenses.find(
      (e) => e.recurringExpenseId === rec.id
    );

    return {
      ...rec,
      installmentNumber,
      isApplicableThisMonth,
      alreadyApplied: !!alreadyAppliedExpense,
      appliedExpenseId: alreadyAppliedExpense?.id,
    };
  });

  // Autenticación: Identificar usuario conectado (Augusto o Agus)
  const currentUser = household.users.find((u) => u.id === loggedUserId) || null;

  // Si hay usuario conectado, cargar/calcular su espacio personal
  let personalData = null;

  if (currentUser) {
    // Buscar o inicializar PersonalIncome para este mes
    let personalIncome = await prisma.personalIncome.findUnique({
      where: {
        userId_year_month: {
          userId: currentUser.id,
          year,
          month,
        },
      },
    });

    if (!personalIncome) {
      personalIncome = await prisma.personalIncome.create({
        data: {
          userId: currentUser.id,
          year,
          month,
          extraAmount: 0,
          carriedOverBalance: 0,
        },
      });
    }

    // Calcular el 40% base restante a partir del sueldo declarado en Hogar
    const userHogarIncome = period.incomes.find((i) => i.userId === currentUser.id);
    const hogarSalary = userHogarIncome?.amount ?? 0;
    const contributionPct = userHogarIncome?.contributionPct ?? 0.60;
    const personalRate = Math.max(0, 1 - contributionPct); // 40% restante por defecto
    const basePersonalSalary = hogarSalary * personalRate;
    const extraIncome = personalIncome.extraAmount || 0;
    const carriedOverPersonal = personalIncome.carriedOverBalance || 0;
    const totalPersonalAvailable = basePersonalSalary + extraIncome + carriedOverPersonal;

    // Gastos personales
    const personalExpenses = await prisma.personalExpense.findMany({
      where: {
        userId: currentUser.id,
        year,
        month,
      },
      include: {
        category: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    const totalPersonalExpenses = personalExpenses.reduce((acc, e) => acc + e.amount, 0);
    const remainingPersonalPool = Math.max(0, totalPersonalAvailable - totalPersonalExpenses);
    const personalBurnRatePct = totalPersonalAvailable > 0
      ? (totalPersonalExpenses / totalPersonalAvailable) * 100
      : 0;

    // Cuotas y gastos recurrentes personales
    const personalRecurringExpenses = await prisma.personalRecurringExpense.findMany({
      where: {
        userId: currentUser.id,
        isActive: true,
      },
      include: {
        category: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const activePersonalInstallments = personalRecurringExpenses.map((rec) => {
      const monthsElapsed = (year - rec.startYear) * 12 + (month - rec.startMonth);
      const installmentNumber = monthsElapsed + 1;
      const isApplicableThisMonth =
        monthsElapsed >= 0 &&
        (!rec.totalInstallments || installmentNumber <= rec.totalInstallments);

      const appliedExpense = personalExpenses.find(
        (e) => e.personalRecurringId === rec.id
      );

      return {
        ...rec,
        installmentNumber,
        isApplicableThisMonth,
        alreadyApplied: !!appliedExpense,
        appliedExpenseId: appliedExpense?.id,
      };
    });

    // Inversiones Personales (CEDEARs, Acciones, Bonos, FCIs, Cripto)
    const rawPersonalInvestments = await prisma.personalInvestment.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
    });

    const { investments: hydratedInvestments, summary: investmentsSummary } =
      await hydrateInvestments(rawPersonalInvestments);

    personalData = {
      incomeRecord: personalIncome,
      hogarSalary,
      contributionPct,
      personalRate,
      basePersonalSalary,
      extraIncome,
      carriedOverPersonal,
      totalPersonalAvailable,
      totalPersonalExpenses,
      remainingPersonalPool,
      personalBurnRatePct,
      expenses: personalExpenses,
      recurringExpenses: activePersonalInstallments,
      investments: hydratedInvestments,
      investmentsSummary,
      isClosed: personalIncome.status === "CLOSED",
    };
  }

  // Backfill inicial para categorías preexistentes sin lastUsedAt
  const uninitializedCategories = await prisma.category.findMany({
    where: { householdId: household.id, lastUsedAt: null },
    include: {
      expenses: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      personalExpenses: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });

  for (const cat of uninitializedCategories) {
    const dates: Date[] = [];
    if (cat.expenses[0]?.date) dates.push(new Date(cat.expenses[0].date));
    if (cat.personalExpenses[0]?.date) dates.push(new Date(cat.personalExpenses[0].date));
    const mostRecent = dates.length > 0
      ? new Date(Math.max(...dates.map((d) => d.getTime())))
      : (cat.createdAt || new Date());

    await prisma.category.update({
      where: { id: cat.id },
      data: { lastUsedAt: mostRecent },
    });
  }

  // Categorías ordenadas por uso reciente primero (las más nuevas o recién usadas al principio)
  const sortedCategories = await prisma.category.findMany({
    where: { householdId: household.id },
    orderBy: [
      { lastUsedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  return {
    household,
    users: household.users,
    currentUser,
    categories: sortedCategories,
    period,
    poolSummary,
    investmentFund,
    recurringExpenses: activeInstallmentsWithStatus,
    personalData,
    currentYear: year,
    currentMonth: month,
  };
}

async function touchCategory(categoryId?: string | null) {
  if (!categoryId) return;
  try {
    await prisma.category.update({
      where: { id: categoryId },
      data: { lastUsedAt: new Date() },
    });
  } catch (err) {
    console.error("Error touching category:", err);
  }
}

export async function addExpenseAction(data: {
  title: string;
  amount: number;
  paidById: string;
  categoryId: string;
  periodId: string;
  isFromPoolFund?: boolean;
  recurringExpenseId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  notes?: string;
  date?: string;
}) {
  if (!data.title || data.amount <= 0 || !data.paidById || !data.categoryId) {
    throw new Error("Datos de gasto inválidos");
  }

  await prisma.expense.create({
    data: {
      title: data.title,
      amount: data.amount,
      paidById: data.paidById,
      categoryId: data.categoryId,
      periodId: data.periodId,
      isFromPoolFund: data.isFromPoolFund ?? false,
      recurringExpenseId: data.recurringExpenseId,
      installmentNumber: data.installmentNumber,
      totalInstallments: data.totalInstallments,
      notes: data.notes,
      date: data.date ? new Date(data.date) : new Date(),
    },
  });

  await touchCategory(data.categoryId);

  revalidatePath("/");
  return { success: true };
}

export async function deleteExpenseAction(expenseId: string) {
  await prisma.expense.delete({
    where: { id: expenseId },
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateExpenseAction(data: {
  id: string;
  title: string;
  amount: number;
  paidById: string;
  categoryId: string;
  date?: string;
  notes?: string;
  isFromPoolFund?: boolean;
}) {
  if (!data.id || !data.title || data.amount <= 0 || !data.paidById || !data.categoryId) {
    throw new Error("Datos de gasto inválidos");
  }

  await prisma.expense.update({
    where: { id: data.id },
    data: {
      title: data.title,
      amount: data.amount,
      paidById: data.paidById,
      categoryId: data.categoryId,
      notes: data.notes ?? null,
      isFromPoolFund: data.isFromPoolFund ?? false,
      ...(data.date ? { date: new Date(data.date) } : {}),
    },
  });

  await touchCategory(data.categoryId);

  revalidatePath("/");
  return { success: true };
}

export async function duplicateExpenseAction(expenseId: string) {
  const existing = await prisma.expense.findUnique({
    where: { id: expenseId },
  });

  if (!existing) throw new Error("Gasto no encontrado");

  await prisma.expense.create({
    data: {
      title: `${existing.title} (Copia)`,
      amount: existing.amount,
      paidById: existing.paidById,
      categoryId: existing.categoryId,
      periodId: existing.periodId,
      isFromPoolFund: existing.isFromPoolFund,
      notes: existing.notes,
      date: new Date(),
    },
  });

  await touchCategory(existing.categoryId);

  revalidatePath("/");
  return { success: true };
}

export async function updateSalariesAction(
  periodId: string,
  salaries: Array<{ userId: string; amount: number; pct?: number }>
) {
  for (const s of salaries) {
    const pct = s.pct ?? 0.60;
    const targetPoolAmount = s.amount * pct;

    await prisma.income.upsert({
      where: {
        userId_periodId: {
          userId: s.userId,
          periodId,
        },
      },
      update: {
        amount: s.amount,
        contributionPct: pct,
        targetPoolAmount,
      },
      create: {
        userId: s.userId,
        periodId,
        amount: s.amount,
        contributionPct: pct,
        targetPoolAmount,
      },
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function transferSurplusToFCIAction(periodId: string, fundId: string) {
  const period = await prisma.monthlyPeriod.findUnique({
    where: { id: periodId },
    include: {
      incomes: true,
      expenses: true,
      investmentTransfer: true,
    },
  });

  if (!period) throw new Error("Período no encontrado");
  if (period.investmentTransfer) throw new Error("El remanente de este mes ya fue transferido");

  const totalPool =
    period.incomes.reduce((acc, i) => acc + i.targetPoolAmount, 0) +
    (period.carriedOverBalance || 0);
  const totalSpent = period.expenses.reduce((acc, e) => acc + e.amount, 0);
  const surplus = Math.max(0, totalPool - totalSpent);

  if (surplus <= 0) {
    throw new Error("No hay remanente positivo este mes para transferir");
  }

  // Cuotas de aporte proporcional al remanente
  const [incA, incB] = period.incomes;
  const ratioA = totalPool > 0 && incA ? incA.targetPoolAmount / totalPool : 0.5;
  const ratioB = totalPool > 0 && incB ? incB.targetPoolAmount / totalPool : 0.5;

  const quotaA = surplus * ratioA;
  const quotaB = surplus * ratioB;

  await prisma.investmentContribution.create({
    data: {
      fundId,
      periodId,
      amount: surplus,
      userAQuota: quotaA,
      userBQuota: quotaB,
    },
  });

  // Incrementamos el valor actual del fondo
  await prisma.investmentFund.update({
    where: { id: fundId },
    data: {
      currentValue: {
        increment: surplus,
      },
    },
  });

  revalidatePath("/");
  return { success: true, surplus };
}

export async function createFCIWithdrawalAction(data: {
  fundId: string;
  periodId?: string;
  amount: number;
  destination: "POOL_FUND" | "CUSTOM_USE";
  purpose?: string;
}) {
  const amount = Number(data.amount);
  if (!data.fundId || isNaN(amount) || amount <= 0) {
    throw new Error("El monto a retirar debe ser un número positivo.");
  }

  const fund = await prisma.investmentFund.findUnique({
    where: { id: data.fundId },
  });

  if (!fund) {
    throw new Error("Fondo Común de Inversión no encontrado.");
  }

  if (amount > fund.currentValue) {
    throw new Error(
      `El monto a retirar ($${Math.round(amount).toLocaleString("es-AR")}) supera el saldo actual del FCI ($${Math.round(fund.currentValue).toLocaleString("es-AR")}).`
    );
  }

  // Crear el registro de retiro
  const withdrawal = await prisma.investmentWithdrawal.create({
    data: {
      fundId: data.fundId,
      periodId: data.periodId || null,
      amount,
      destination: data.destination,
      purpose: data.purpose ? data.purpose.trim() : null,
      withdrawnAt: new Date(),
    },
  });

  // Descontar del saldo del FCI
  await prisma.investmentFund.update({
    where: { id: data.fundId },
    data: {
      currentValue: {
        decrement: amount,
      },
    },
  });

  revalidatePath("/");
  return { success: true, withdrawal };
}

export async function deleteFCIWithdrawalAction(withdrawalId: string) {
  if (!withdrawalId) throw new Error("ID de retiro requerido.");

  const withdrawal = await prisma.investmentWithdrawal.findUnique({
    where: { id: withdrawalId },
  });

  if (!withdrawal) throw new Error("Retiro no encontrado.");

  // Reintegrar saldo al FCI
  await prisma.investmentFund.update({
    where: { id: withdrawal.fundId },
    data: {
      currentValue: {
        increment: withdrawal.amount,
      },
    },
  });

  await prisma.investmentWithdrawal.delete({
    where: { id: withdrawalId },
  });

  revalidatePath("/");
  return { success: true };
}

export async function closeMonthAction(periodId: string) {
  const period = await prisma.monthlyPeriod.findUnique({
    where: { id: periodId },
    include: {
      incomes: true,
      expenses: true,
      investmentTransfer: true,
    },
  });

  if (!period) throw new Error("Período no encontrado");

  // Calcular el remanente no invertido
  const totalPool =
    period.incomes.reduce((acc, i) => acc + i.targetPoolAmount, 0) +
    (period.carriedOverBalance || 0);
  const totalSpent = period.expenses.reduce((acc, e) => acc + e.amount, 0);
  const invested = period.investmentTransfer ? period.investmentTransfer.amount : 0;

  // Si no se marcó como invertido, este saldo se pasa al mes siguiente
  const uninvestedSurplus = Math.max(0, totalPool - totalSpent - invested);

  // Marcar período actual como cerrado
  await prisma.monthlyPeriod.update({
    where: { id: periodId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  // Mes siguiente
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const nextYear = period.month === 12 ? period.year + 1 : period.year;

  // Buscar o crear el siguiente período
  const nextPeriod = await prisma.monthlyPeriod.findUnique({
    where: {
      householdId_year_month: {
        householdId: period.householdId,
        year: nextYear,
        month: nextMonth,
      },
    },
  });

  if (nextPeriod) {
    // Si ya existe, actualizamos el saldo arrastrado
    await prisma.monthlyPeriod.update({
      where: { id: nextPeriod.id },
      data: {
        carriedOverBalance: uninvestedSurplus,
      },
    });
  } else {
    // Si aún no existe, lo creamos heredando los sueldos del período actual y con el saldo arrastrado
    await prisma.monthlyPeriod.create({
      data: {
        householdId: period.householdId,
        year: nextYear,
        month: nextMonth,
        carriedOverBalance: uninvestedSurplus,
        incomes: {
          create: period.incomes.map((i) => ({
            userId: i.userId,
            amount: i.amount,
            contributionPct: i.contributionPct,
            targetPoolAmount: i.targetPoolAmount,
          })),
        },
      },
    });
  }

  revalidatePath("/");
  return { success: true, uninvestedSurplus };
}

export async function reopenMonthAction(periodId: string) {
  const period = await prisma.monthlyPeriod.findUnique({
    where: { id: periodId },
  });

  if (!period) throw new Error("Período no encontrado");

  await prisma.monthlyPeriod.update({
    where: { id: periodId },
    data: {
      status: "OPEN",
      closedAt: null,
    },
  });

  // Mes siguiente: si estaba abierto, quitamos el saldo arrastrado para recalcular
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const nextYear = period.month === 12 ? period.year + 1 : period.year;

  const nextPeriod = await prisma.monthlyPeriod.findUnique({
    where: {
      householdId_year_month: {
        householdId: period.householdId,
        year: nextYear,
        month: nextMonth,
      },
    },
  });

  if (nextPeriod && nextPeriod.status === "OPEN") {
    await prisma.monthlyPeriod.update({
      where: { id: nextPeriod.id },
      data: {
        carriedOverBalance: 0,
      },
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function updateFCIValueAction(fundId: string, newValue: number) {
  await prisma.investmentFund.update({
    where: { id: fundId },
    data: { currentValue: newValue },
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateMemberNamesAction(
  userAId: string,
  userAName: string,
  userBId: string,
  userBName: string
) {
  await prisma.user.update({
    where: { id: userAId },
    data: { name: userAName.trim() || "Persona A" },
  });
  await prisma.user.update({
    where: { id: userBId },
    data: { name: userBName.trim() || "Persona B" },
  });
  revalidatePath("/");
  return { success: true };
}

// Acciones de Gastos Recurrentes y Cuotas de Tarjeta
export async function createRecurringExpenseAction(data: {
  title: string;
  installmentAmount: number;
  totalInstallments?: number | null;
  startYear: number;
  startMonth: number;
  paidById: string;
  categoryId: string;
  isFromPoolFund?: boolean;
  notes?: string;
}) {
  const household = await ensureDefaultHousehold();

  await prisma.recurringExpense.create({
    data: {
      title: data.title,
      installmentAmount: data.installmentAmount,
      totalInstallments: data.totalInstallments || null,
      startYear: data.startYear,
      startMonth: data.startMonth,
      paidById: data.paidById,
      categoryId: data.categoryId,
      householdId: household.id,
      isFromPoolFund: data.isFromPoolFund ?? false,
      notes: data.notes,
    },
  });

  await touchCategory(data.categoryId);

  revalidatePath("/");
  return { success: true };
}

export async function deleteRecurringExpenseAction(id: string) {
  await prisma.recurringExpense.delete({
    where: { id },
  });
  revalidatePath("/");
  return { success: true };
}

export async function applyRecurringExpenseToMonthAction(data: {
  recurringId: string;
  periodId: string;
  title: string;
  amount: number;
  paidById: string;
  categoryId: string;
  isFromPoolFund: boolean;
  installmentNumber?: number;
  totalInstallments?: number | null;
}) {
  const fullTitle = data.totalInstallments
    ? `${data.title} (Cuota ${data.installmentNumber}/${data.totalInstallments})`
    : data.title;

  await prisma.expense.create({
    data: {
      title: fullTitle,
      amount: data.amount,
      paidById: data.paidById,
      categoryId: data.categoryId,
      periodId: data.periodId,
      isFromPoolFund: data.isFromPoolFund,
      recurringExpenseId: data.recurringId,
      installmentNumber: data.installmentNumber,
      totalInstallments: data.totalInstallments,
      date: new Date(),
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function applyAllRecurringExpensesAction(
  periodId: string,
  items: Array<{
    recurringId: string;
    title: string;
    amount: number;
    paidById: string;
    categoryId: string;
    isFromPoolFund: boolean;
    installmentNumber?: number;
    totalInstallments?: number | null;
  }>
) {
  for (const item of items) {
    const fullTitle = item.totalInstallments
      ? `${item.title} (Cuota ${item.installmentNumber}/${item.totalInstallments})`
      : item.title;

    await prisma.expense.create({
      data: {
        title: fullTitle,
        amount: item.amount,
        paidById: item.paidById,
        categoryId: item.categoryId,
        periodId,
        isFromPoolFund: item.isFromPoolFund,
        recurringExpenseId: item.recurringId,
        installmentNumber: item.installmentNumber,
        totalInstallments: item.totalInstallments,
        date: new Date(),
      },
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function unapplyRecurringExpenseAction(expenseId: string) {
  await prisma.expense.delete({
    where: { id: expenseId },
  });
  revalidatePath("/");
  return { success: true };
}

// ==========================================
// AUTENTICACIÓN SIN CONTRASEÑA (MAGIC LINK & MAILS REGISTRADOS)
// ==========================================

const AUTHORIZED_EMAILS = ["augustogronda@gmail.com", "agusaux@gmail.com"];

export async function requestMagicLinkAction(inputEmail: string) {
  const normalizedEmail = inputEmail.trim().toLowerCase();

  if (!AUTHORIZED_EMAILS.includes(normalizedEmail)) {
    throw new Error(
      "El correo ingresado no se encuentra autorizado en el sistema."
    );
  }

  // Asegurar que el hogar y los usuarios estén actualizados
  await ensureDefaultHousehold();

  let user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail } },
  });

  if (!user) {
    const isAugusto = normalizedEmail.includes("augusto");
    const nameMatch = isAugusto ? "Augusto" : "Agus";
    user = await prisma.user.findFirst({
      where: { name: { contains: nameMatch } },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email: normalizedEmail },
      });
    }
  }

  if (!user) {
    throw new Error("Usuario no encontrado en el sistema.");
  }

  // Generar token mágico si no existe
  let token = user.magicToken;
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
    user = await prisma.user.update({
      where: { id: user.id },
      data: { magicToken: token },
    });
  }

  // Disparo de Magic Link vía Supabase Auth con el dominio de producción
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gastoshogar-jade.vercel.app";
  const redirectUrl = `${siteUrl.replace(/\/$/, "")}/auth/callback`;

  let emailSent = false;
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    if (!error) {
      emailSent = true;
    } else {
      console.warn("Supabase signInWithOtp warning:", error.message);
    }
  } catch (err) {
    console.warn("Supabase OTP optional dispatch notice:", err);
  }

  return {
    success: true,
    emailSent,
    email: normalizedEmail,
  };
}

export async function loginWithMagicTokenAction(token: string) {
  if (!token) throw new Error("Token de acceso requerido");

  const user = await prisma.user.findUnique({
    where: { magicToken: token },
  });

  if (!user) {
    throw new Error("Link de acceso inválido o expirado");
  }

  const cookieStore = await cookies();
  cookieStore.set("auth_user_id", user.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 año
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/");
  return { success: true, user };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_user_id");
  revalidatePath("/");
  return { success: true };
}


// ==========================================
// ACCIONES DE FINANZAS PERSONALES (40% + Extras)
// ==========================================

export async function updatePersonalExtraIncomeAction(
  userId: string,
  year: number,
  month: number,
  extraAmount: number,
  notes?: string
) {
  await prisma.personalIncome.upsert({
    where: {
      userId_year_month: {
        userId,
        year,
        month,
      },
    },
    update: {
      extraAmount,
      notes,
    },
    create: {
      userId,
      year,
      month,
      extraAmount,
      notes,
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function addPersonalExpenseAction(data: {
  userId: string;
  year: number;
  month: number;
  title: string;
  amount: number;
  categoryId?: string;
  date?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  personalRecurringId?: string;
  notes?: string;
}) {
  if (!data.title || data.amount <= 0 || !data.userId) {
    throw new Error("Datos de gasto personal inválidos");
  }

  await prisma.personalExpense.create({
    data: {
      userId: data.userId,
      year: data.year,
      month: data.month,
      title: data.title,
      amount: data.amount,
      categoryId: data.categoryId,
      date: data.date ? new Date(data.date) : new Date(),
      installmentNumber: data.installmentNumber,
      totalInstallments: data.totalInstallments,
      personalRecurringId: data.personalRecurringId,
      notes: data.notes,
    },
  });

  await touchCategory(data.categoryId);

  revalidatePath("/");
  return { success: true };
}

export async function deletePersonalExpenseAction(expenseId: string) {
  await prisma.personalExpense.delete({
    where: { id: expenseId },
  });
  revalidatePath("/");
  return { success: true };
}

export async function updatePersonalExpenseAction(data: {
  id: string;
  title: string;
  amount: number;
  categoryId?: string;
  date?: string;
  notes?: string;
}) {
  if (!data.id || !data.title || data.amount <= 0) {
    throw new Error("Datos de gasto personal inválidos");
  }

  await prisma.personalExpense.update({
    where: { id: data.id },
    data: {
      title: data.title,
      amount: data.amount,
      categoryId: data.categoryId,
      notes: data.notes ?? null,
      ...(data.date ? { date: new Date(data.date) } : {}),
    },
  });

  await touchCategory(data.categoryId);

  revalidatePath("/");
  return { success: true };
}

export async function duplicatePersonalExpenseAction(expenseId: string) {
  const existing = await prisma.personalExpense.findUnique({
    where: { id: expenseId },
  });

  if (!existing) throw new Error("Gasto personal no encontrado");

  await prisma.personalExpense.create({
    data: {
      userId: existing.userId,
      year: existing.year,
      month: existing.month,
      title: `${existing.title} (Copia)`,
      amount: existing.amount,
      categoryId: existing.categoryId,
      notes: existing.notes,
      date: new Date(),
    },
  });

  await touchCategory(existing.categoryId);

  revalidatePath("/");
  return { success: true };
}

export async function createPersonalRecurringExpenseAction(data: {
  userId: string;
  title: string;
  installmentAmount: number;
  totalInstallments?: number | null;
  startYear: number;
  startMonth: number;
  categoryId?: string;
  notes?: string;
}) {
  if (!data.title || data.installmentAmount <= 0) {
    throw new Error("Datos de cuota personal inválidos");
  }

  await prisma.personalRecurringExpense.create({
    data: {
      userId: data.userId,
      title: data.title,
      installmentAmount: data.installmentAmount,
      totalInstallments: data.totalInstallments,
      startYear: data.startYear,
      startMonth: data.startMonth,
      categoryId: data.categoryId,
      notes: data.notes,
      isActive: true,
    },
  });

  await touchCategory(data.categoryId);

  revalidatePath("/");
  return { success: true };
}

export async function deletePersonalRecurringExpenseAction(id: string) {
  await prisma.personalRecurringExpense.delete({
    where: { id },
  });
  revalidatePath("/");
  return { success: true };
}

export async function applyPersonalRecurringExpenseAction(data: {
  userId: string;
  year: number;
  month: number;
  recurringId: string;
  title: string;
  amount: number;
  categoryId?: string;
  installmentNumber?: number;
  totalInstallments?: number | null;
}) {
  const fullTitle = data.totalInstallments
    ? `${data.title} (Cuota ${data.installmentNumber}/${data.totalInstallments})`
    : data.title;

  await prisma.personalExpense.create({
    data: {
      userId: data.userId,
      year: data.year,
      month: data.month,
      title: fullTitle,
      amount: data.amount,
      categoryId: data.categoryId,
      personalRecurringId: data.recurringId,
      installmentNumber: data.installmentNumber,
      totalInstallments: data.totalInstallments,
      date: new Date(),
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function unapplyPersonalRecurringExpenseAction(expenseId: string) {
  await prisma.personalExpense.delete({
    where: { id: expenseId },
  });
  revalidatePath("/");
  return { success: true };
}

export async function closePersonalMonthAction(
  userId: string,
  year: number,
  month: number
) {
  const household = await ensureDefaultHousehold();
  const period = await prisma.monthlyPeriod.findUnique({
    where: {
      householdId_year_month: {
        householdId: household.id,
        year,
        month,
      },
    },
    include: { incomes: true },
  });

  const income = period?.incomes.find((i) => i.userId === userId);
  const salary = income?.amount ?? 0;
  const contributionPct = income?.contributionPct ?? 0.60;
  const base40 = salary * (1 - contributionPct);

  const personalIncome = await prisma.personalIncome.findUnique({
    where: {
      userId_year_month: {
        userId,
        year,
        month,
      },
    },
  });

  const extra = personalIncome?.extraAmount ?? 0;
  const carried = personalIncome?.carriedOverBalance ?? 0;
  const totalAvailable = base40 + extra + carried;

  const expenses = await prisma.personalExpense.findMany({
    where: { userId, year, month },
  });
  const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0);
  const unspent = Math.max(0, totalAvailable - totalSpent);

  await prisma.personalIncome.upsert({
    where: {
      userId_year_month: {
        userId,
        year,
        month,
      },
    },
    update: {
      status: "CLOSED",
      closedAt: new Date(),
    },
    create: {
      userId,
      year,
      month,
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  // Próximo mes: arrastrar saldo no gastado
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  await prisma.personalIncome.upsert({
    where: {
      userId_year_month: {
        userId,
        year: nextYear,
        month: nextMonth,
      },
    },
    update: {
      carriedOverBalance: unspent,
    },
    create: {
      userId,
      year: nextYear,
      month: nextMonth,
      carriedOverBalance: unspent,
    },
  });

  revalidatePath("/");
  return { success: true, unspent };
}

export async function reopenPersonalMonthAction(
  userId: string,
  year: number,
  month: number
) {
  await prisma.personalIncome.update({
    where: {
      userId_year_month: {
        userId,
        year,
        month,
      },
    },
    data: {
      status: "OPEN",
      closedAt: null,
    },
  });

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const nextIncome = await prisma.personalIncome.findUnique({
    where: {
      userId_year_month: {
        userId,
        year: nextYear,
        month: nextMonth,
      },
    },
  });

  if (nextIncome && nextIncome.status === "OPEN") {
    await prisma.personalIncome.update({
      where: { id: nextIncome.id },
      data: { carriedOverBalance: 0 },
    });
  }

  revalidatePath("/");
  return { success: true };
}

// ==========================================
// GESTIÓN DE CATEGORÍAS (CRUD & RECIENTES)
// ==========================================

export async function createCategoryAction(data: {
  name: string;
  icon?: string;
  color?: string;
}) {
  const household = await ensureDefaultHousehold();
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("El nombre de la categoría es requerido");
  }

  // Si ya existe una con el mismo nombre (case-insensitive), la actualizamos y la ponemos primera
  const existing = await prisma.category.findFirst({
    where: {
      householdId: household.id,
      name: { equals: trimmedName },
    },
  });

  if (existing) {
    const updated = await prisma.category.update({
      where: { id: existing.id },
      data: {
        lastUsedAt: new Date(),
        ...(data.icon ? { icon: data.icon } : {}),
        ...(data.color ? { color: data.color } : {}),
      },
    });
    revalidatePath("/");
    return updated;
  }

  const category = await prisma.category.create({
    data: {
      name: trimmedName,
      icon: data.icon || "Tag",
      color: data.color || "#6366f1",
      householdId: household.id,
      lastUsedAt: new Date(),
    },
  });

  revalidatePath("/");
  return category;
}

export async function updateCategoryAction(data: {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}) {
  const trimmedName = data.name.trim();
  if (!data.id || !trimmedName) {
    throw new Error("ID y nombre de categoría son requeridos");
  }

  const updated = await prisma.category.update({
    where: { id: data.id },
    data: {
      name: trimmedName,
      ...(data.icon ? { icon: data.icon } : {}),
      ...(data.color ? { color: data.color } : {}),
      lastUsedAt: new Date(),
    },
  });

  revalidatePath("/");
  return updated;
}

export async function deleteCategoryAction(id: string) {
  if (!id) throw new Error("ID de categoría requerido");

  const [expenseCount, personalExpenseCount, recurringCount, personalRecCount] =
    await Promise.all([
      prisma.expense.count({ where: { categoryId: id } }),
      prisma.personalExpense.count({ where: { categoryId: id } }),
      prisma.recurringExpense.count({ where: { categoryId: id } }),
      prisma.personalRecurringExpense.count({ where: { categoryId: id } }),
    ]);

  const total =
    expenseCount + personalExpenseCount + recurringCount + personalRecCount;

  if (total > 0) {
    throw new Error(
      `No se puede eliminar la categoría porque tiene ${total} gasto(s) vinculado(s). Podés editar su nombre o ícono.`
    );
  }

  await prisma.category.delete({
    where: { id },
  });

  revalidatePath("/");
  return { success: true };
}

// ==========================================
// INVERSIONES PERSONALES (ACCIONES, CEDEARS, FCIS, CRIPTO)
// ==========================================

export async function searchMarketTickersAction(query: string) {
  try {
    return await searchTickers(query);
  } catch (err) {
    console.error("Error searching tickers:", err);
    return [];
  }
}

export async function fetchMarketQuoteAction(ticker: string) {
  try {
    return await fetchTickerQuote(ticker);
  } catch (err) {
    console.error(`Error fetching quote for ${ticker}:`, err);
    return null;
  }
}

export async function getExchangeRatesAction() {
  try {
    return await getExchangeRates();
  } catch (err) {
    console.error("Error getting exchange rates:", err);
    return {
      mep: 1535,
      ccl: 1615,
      blue: 1545,
      oficial: 1520,
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function savePersonalInvestmentAction(data: {
  id?: string;
  userId: string;
  ticker: string;
  name: string;
  assetType: string;
  quantity: number;
  buyPrice?: number | null;
  currency?: string;
  manualPrice?: number | null;
  notes?: string | null;
}) {
  const ticker = data.ticker.trim().toUpperCase();
  const name = data.name.trim() || ticker;
  const quantity = Number(data.quantity);
  const buyPrice = typeof data.buyPrice === "number" && !isNaN(data.buyPrice) && data.buyPrice > 0 ? data.buyPrice : null;
  const manualPrice = typeof data.manualPrice === "number" && !isNaN(data.manualPrice) && data.manualPrice > 0 ? data.manualPrice : null;
  const currency = (data.currency || "ARS").toUpperCase();

  if (!data.userId || !ticker || isNaN(quantity) || quantity <= 0) {
    throw new Error("Datos de inversión incompletos o cantidad inválida.");
  }

  if (data.id) {
    // Actualizar inversión existente
    const updated = await prisma.personalInvestment.update({
      where: { id: data.id },
      data: {
        ticker,
        name,
        assetType: data.assetType || "CEDEAR",
        quantity,
        buyPrice,
        currency,
        manualPrice,
        notes: data.notes?.trim() || null,
      },
    });
    revalidatePath("/");
    return updated;
  } else {
    // Crear nueva inversión
    const created = await prisma.personalInvestment.create({
      data: {
        userId: data.userId,
        ticker,
        name,
        assetType: data.assetType || "CEDEAR",
        quantity,
        buyPrice,
        currency,
        manualPrice,
        notes: data.notes?.trim() || null,
      },
    });
    revalidatePath("/");
    return created;
  }
}

export async function deletePersonalInvestmentAction(id: string) {
  if (!id) throw new Error("ID de inversión requerido");

  await prisma.personalInvestment.delete({
    where: { id },
  });

  revalidatePath("/");
  return { success: true };
}

export async function refreshPersonalInvestmentsAction(userId: string) {
  if (!userId) throw new Error("ID de usuario requerido");

  const rawInvestments = await prisma.personalInvestment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const hydrated = await hydrateInvestments(rawInvestments);
  return hydrated;
}



