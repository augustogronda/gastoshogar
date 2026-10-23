"use server";

import { prisma } from "@/lib/prisma";
import { ensureDefaultHousehold, invalidateHouseholdCache } from "@/lib/db-init";
import { calculateMonthlyPool } from "@/lib/finance-engine";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  hydrateInvestments,
  searchTickers,
  fetchTickerQuote,
  getExchangeRates,
  POPULAR_ARGENTINA_ASSETS,
  invalidatePortfolioCache,
} from "@/lib/investments-service";
import {
  getCardsForUserAndMonth,
  invalidateCardsCache,
  computeApplicableCardInstallments,
} from "@/lib/cards-service";
import {
  hasReviewFlag,
  addReviewFlag,
  removeReviewFlag,
} from "@/lib/expense-review";

let categoriesBackfilled = false;

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
      sharedInvestments: [],
      sharedInvestmentsSummary: null,
      currentYear: year,
      currentMonth: month,
    };
  }

  const household = await ensureDefaultHousehold();

  // Identificar usuario conectado (Augusto o Agus) antes de lanzar la ola paralela
  const currentUser = household.users.find((u: any) => u.id === loggedUserId) || null;

  // Ejecutar TODAS las consultas de base de datos en una sola ola paralela (1 roundtrip en vez de 2)
  const periodPromise = prisma.monthlyPeriod.findUnique({
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

  const investmentFundPromise = prisma.investmentFund.findFirst({
    where: { householdId: household.id },
    include: {
      contributions: { orderBy: { investedAt: "desc" } },
      withdrawals: { orderBy: { withdrawnAt: "desc" } },
    },
  });

  const recurringExpensesPromise = prisma.recurringExpense.findMany({
    where: { householdId: household.id, isActive: true },
    include: { paidBy: true, category: true },
    orderBy: { createdAt: "desc" },
  });

  const sortedCategoriesPromise = prisma.category.findMany({
    where: { householdId: household.id },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
  });

  const rawSharedInvestmentsPromise = prisma.sharedInvestment.findMany({
    where: { householdId: household.id },
    orderBy: { createdAt: "desc" },
  });

  const personalQueriesPromise = currentUser
    ? Promise.all([
        prisma.personalIncome.findUnique({
          where: { userId_year_month: { userId: currentUser.id, year, month } },
        }),
        prisma.personalExpense.findMany({
          where: { userId: currentUser.id, year, month },
          include: { category: true },
          orderBy: { date: "desc" },
        }),
        prisma.personalRecurringExpense.findMany({
          where: { userId: currentUser.id, isActive: true },
          include: { category: true, creditCard: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.personalInvestment.findMany({
          where: { userId: currentUser.id },
          orderBy: { createdAt: "desc" },
        }),
        getCardsForUserAndMonth(currentUser.id, currentUser.name, year, month),
      ])
    : Promise.resolve(null);

  const [
    existingPeriod,
    investmentFund,
    recurringExpenses,
    sortedCategories,
    rawSharedInvestments,
    personalRawResults,
  ] = await Promise.all([
    periodPromise,
    investmentFundPromise,
    recurringExpensesPromise,
    sortedCategoriesPromise,
    rawSharedInvestmentsPromise,
    personalQueriesPromise,
  ]);

  let period = existingPeriod;

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
          create: household.users.map((u: any) => {
            const prevIncome = prevPeriod?.incomes.find((i) => i.userId === u.id);
            const amount = prevIncome?.amount ?? 0;
            const pct = prevIncome?.contributionPct ?? household.defaultRate ?? 0.60;
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
  const engineMembers = household.users.map((u: any) => {
    const incomeRecord = period.incomes.find((i) => i.userId === u.id);
    return {
      userId: u.id,
      name: u.name,
      salary: incomeRecord?.amount ?? 0,
      contributionPct: incomeRecord?.contributionPct ?? household.defaultRate ?? 0.60,
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

  // Calcular si cada cuota recurrente del hogar ya fue cargada o qué número de cuota toca este mes
  const activeInstallmentsWithStatus = recurringExpenses.map((rec) => {
    const monthsElapsed = (year - rec.startYear) * 12 + (month - rec.startMonth);
    const installmentNumber = monthsElapsed + 1;
    const isApplicableThisMonth =
      monthsElapsed >= 0 &&
      (!rec.totalInstallments || installmentNumber <= rec.totalInstallments);

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

  // Procesar espacio personal e hidratar cotizaciones concurrentemente
  let personalData: any = null;
  let rawPersonalInvestments: any[] = [];

  if (currentUser && personalRawResults) {
    let [
      personalIncome,
      personalExpenses,
      personalRecurringExpenses,
      personalInvestments,
      cardsData,
    ] = personalRawResults;

    rawPersonalInvestments = personalInvestments;

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

    const userHogarIncome = period.incomes.find((i) => i.userId === currentUser.id);
    const hogarSalary = userHogarIncome?.amount ?? 0;
    const contributionPct = userHogarIncome?.contributionPct ?? household.defaultRate ?? 0.60;
    const personalRate = Math.max(0, 1 - contributionPct);
    const basePersonalSalary = hogarSalary * personalRate;
    const extraIncome = personalIncome.extraAmount || 0;
    const carriedOverPersonal = personalIncome.carriedOverBalance || 0;
    const totalPersonalAvailable = basePersonalSalary + extraIncome + carriedOverPersonal;

    const totalPersonalExpenses = personalExpenses.reduce((acc, e) => acc + e.amount, 0);
    const remainingPersonalPool = Math.max(0, totalPersonalAvailable - totalPersonalExpenses);
    const personalBurnRatePct = totalPersonalAvailable > 0
      ? (totalPersonalExpenses / totalPersonalAvailable) * 100
      : 0;

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
      investments: [],
      investmentsSummary: null,
      cardsData,
      isClosed: personalIncome.status === "CLOSED",
    };
  }

  // Hidratar cotizaciones de inversiones personales y compartidas en paralelo
  const [hydratedPersonal, hydratedShared] = await Promise.all([
    rawPersonalInvestments.length > 0
      ? hydrateInvestments(rawPersonalInvestments)
      : Promise.resolve({ investments: [], summary: null }),
    rawSharedInvestments.length > 0
      ? hydrateInvestments(rawSharedInvestments)
      : Promise.resolve({
          investments: [],
          summary: {
            totalValuationArs: 0,
            totalValuationUsd: 0,
            totalCostArs: 0,
            totalGainLossArs: 0,
            totalGainLossPct: 0,
            rates: { mep: 1530, ccl: 1610, blue: 1540, oficial: 1500, updatedAt: "" },
            assetTypeBreakdown: [],
          },
        }),
  ]);

  if (personalData) {
    personalData.investments = hydratedPersonal.investments;
    personalData.investmentsSummary = hydratedPersonal.summary;
  }

  const sharedInvestments = hydratedShared.investments;
  const sharedInvestmentsSummary = hydratedShared.summary;

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
    sharedInvestments,
    sharedInvestmentsSummary,
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

  const [expense] = await Promise.all([
    prisma.expense.create({
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
      include: {
        paidBy: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    }),
    touchCategory(data.categoryId),
  ]);

  revalidatePath("/");
  return { success: true, expense };
}

export async function deleteExpenseAction(expenseId: string) {
  if (!expenseId) throw new Error("ID de gasto requerido");

  try {
    const shared = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (shared) {
      await prisma.expense.delete({
        where: { id: expenseId },
      });
      revalidatePath("/");
      return { success: true };
    }

    // Fallback: si el ID pertenecía a un gasto personal
    const personal = await prisma.personalExpense.findUnique({
      where: { id: expenseId },
    });

    if (personal) {
      await prisma.personalExpense.delete({
        where: { id: expenseId },
      });
      revalidatePath("/");
      return { success: true };
    }

    // Si no existe en ninguna (ya fue eliminado), devolver éxito de forma idempotente
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error en deleteExpenseAction:", err);
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2025") {
      revalidatePath("/");
      return { success: true };
    }
    throw err;
  }
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

export async function duplicateSharedToPersonalExpenseAction(data: {
  expenseId: string;
  targetUserId?: string;
  move?: boolean;
}) {
  const existing = await prisma.expense.findUnique({
    where: { id: data.expenseId },
    include: { period: true },
  });

  if (!existing) throw new Error("Gasto compartido no encontrado");

  const household = await ensureDefaultHousehold();
  const targetUserId = data.targetUserId || existing.paidById || household.users[0]?.id;

  const expenseDate = new Date(existing.date);
  const year = existing.period?.year || expenseDate.getFullYear();
  const month = existing.period?.month || expenseDate.getMonth() + 1;

  // Asegurar registro de ingreso personal
  await prisma.personalIncome.upsert({
    where: { userId_year_month: { userId: targetUserId, year, month } },
    update: {},
    create: { userId: targetUserId, year, month },
  });

  const notesClean = existing.notes ? removeReviewFlag(existing.notes) : "";
  const finalNotes = data.move
    ? notesClean || null
    : notesClean
    ? `(Copia de Hogar) ${notesClean}`
    : "(Copia de Hogar)";

  const newPersonalExpense = await prisma.personalExpense.create({
    data: {
      userId: targetUserId,
      year,
      month,
      title: existing.title,
      amount: existing.amount,
      date: existing.date,
      categoryId: existing.categoryId,
      notes: finalNotes,
      installmentNumber: existing.installmentNumber,
      totalInstallments: existing.totalInstallments,
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  if (data.move) {
    await prisma.expense.delete({
      where: { id: existing.id },
    });
  }

  await touchCategory(existing.categoryId);

  revalidatePath("/");
  return { success: true, expense: newPersonalExpense };
}

export async function updateSalariesAction(
  periodId: string,
  salaries: Array<{ userId: string; amount: number; pct?: number }>
) {
  let latestPct: number | null = null;

  for (const s of salaries) {
    const rawPct = s.pct ?? 0.60;
    const pct = Math.min(1, Math.max(0.05, rawPct));
    latestPct = pct;
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

  if (latestPct !== null) {
    try {
      const period = await prisma.monthlyPeriod.findUnique({
        where: { id: periodId },
        select: { householdId: true },
      });
      if (period?.householdId) {
        await prisma.household.update({
          where: { id: period.householdId },
          data: { defaultRate: latestPct },
        });
        invalidateHouseholdCache();
      }
    } catch (e) {
      console.warn("No se pudo actualizar defaultRate en household:", e);
    }
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

export async function requestMagicLinkAction(inputEmail: string): Promise<{
  success: boolean;
  emailSent?: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const normalizedEmail = (inputEmail || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return {
        success: false,
        error: "Por favor ingresá un correo electrónico.",
      };
    }

    if (!AUTHORIZED_EMAILS.includes(normalizedEmail)) {
      return {
        success: false,
        error: "El correo ingresado no se encuentra autorizado en el sistema.",
      };
    }

    // Asegurar que el hogar y los usuarios estén actualizados
    await ensureDefaultHousehold();

    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    if (!user) {
      const isAugusto = normalizedEmail.includes("augusto");
      const nameMatch = isAugusto ? "Augusto" : "Agus";
      user = await prisma.user.findFirst({
        where: { name: { contains: nameMatch, mode: "insensitive" } },
      });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail },
        });
      }
    }

    if (!user) {
      return {
        success: false,
        error: "Usuario no encontrado en el sistema.",
      };
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
  } catch (err: unknown) {
    console.error("Error en requestMagicLinkAction:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error al solicitar el enlace de acceso.",
    };
  }
}

export async function loginWithMagicTokenAction(token: string): Promise<{
  success: boolean;
  error?: string;
  user?: any;
  deviceToken?: string | null;
}> {
  try {
    const cleanToken = (token || "").trim();
    if (!cleanToken) {
      return { success: false, error: "Token de acceso requerido" };
    }

    const user = await prisma.user.findUnique({
      where: { magicToken: cleanToken },
    });

    if (!user) {
      return { success: false, error: "Link o token de acceso inválido o expirado" };
    }

    const sessionLifetimeSeconds = 60 * 60 * 24 * 400; // 400 días (límite máximo permitido en navegadores)
    const cookieStore = await cookies();
    cookieStore.set("auth_user_id", user.id, {
      path: "/",
      maxAge: sessionLifetimeSeconds,
      expires: new Date(Date.now() + sessionLifetimeSeconds * 1000),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    revalidatePath("/");
    return { success: true, user, deviceToken: user.magicToken };
  } catch (err: unknown) {
    console.error("Error en loginWithMagicTokenAction:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al iniciar sesión.",
    };
  }
}

/**
 * Permite autenticar en Safari / iOS PWA ingresando:
 * 1) El código OTP numérico de 6 dígitos de Supabase ({{ .Token }} en el mail),
 * 2) El enlace completo copiado del correo (resuelve token pkce o token_hash de forma segura en servidor), o
 * 3) El magicToken personal del usuario o link de acceso directo.
 */
export async function verifyEmailOtpAction(
  inputEmail: string,
  rawInput: string
): Promise<{
  success: boolean;
  error?: string;
  user?: any;
}> {
  try {
    const normalizedEmail = (inputEmail || "").trim().toLowerCase();
    const trimmed = (rawInput || "").trim();

    if (!trimmed) {
      return {
        success: false,
        error: "Ingresá el código numérico de 6 dígitos o pegá el enlace del correo.",
      };
    }

    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);

    let extractedToken = trimmed;
    let extractedTokenHash: string | null = null;
    let extractedCode: string | null = null;
    let extractedType: EmailOtpType = "email";
    let isSupabaseVerifyUrl = false;

    // A) Si el usuario copió y pegó un enlace completo
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const parsedUrl = new URL(trimmed);
        const urlToken = parsedUrl.searchParams.get("token");
        const urlTokenHash = parsedUrl.searchParams.get("token_hash");
        const urlCode = parsedUrl.searchParams.get("code");
        const urlType = parsedUrl.searchParams.get("type") as EmailOtpType | null;

        if (urlType) {
          extractedType = urlType;
        }

        if (urlTokenHash) {
          extractedTokenHash = urlTokenHash;
        } else if (urlToken) {
          extractedToken = urlToken;
        } else if (urlCode) {
          extractedCode = urlCode;
        }

        if (parsedUrl.pathname.includes("/verify")) {
          isSupabaseVerifyUrl = true;
        }
      } catch {
        // Continuar si no fue una URL parseable
      }
    }

    // 1. Verificar si coincide con el magicToken directo de la base de datos
    const directUser = await prisma.user.findFirst({
      where: { magicToken: extractedToken },
    });
    if (directUser) {
      cookieStore.set("auth_user_id", directUser.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      revalidatePath("/");
      return { success: true, user: directUser };
    }

    let verifiedEmail: string | null = null;

    // 2. Si pegó una URL de verificación nativa de Supabase (/auth/v1/verify?token=pkce_...)
    // Consultamos server-side a Supabase para seguir el redirect y detectar si expiró o nos da el code
    if (isSupabaseVerifyUrl && trimmed.startsWith("http")) {
      try {
        const verifyRes = await fetch(trimmed, { redirect: "manual" });
        const redirectLoc = verifyRes.headers.get("location");
        if (redirectLoc) {
          const locUrl = new URL(redirectLoc);
          const errorCode = locUrl.searchParams.get("error_code") || locUrl.searchParams.get("error");
          const errorDesc = locUrl.searchParams.get("error_description");

          if (errorCode === "otp_expired" || errorDesc?.toLowerCase().includes("expired")) {
            return {
              success: false,
              error: "Este enlace de correo ya fue utilizado o ha expirado. Solicitá uno nuevo o ingresá el código de 6 dígitos.",
            };
          }

          if (errorCode || errorDesc) {
            return {
              success: false,
              error: errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, " ")) : "El enlace de correo no es válido.",
            };
          }

          const authCode = locUrl.searchParams.get("code");
          if (authCode) {
            extractedCode = authCode;
          }
        }
      } catch (fetchErr) {
        console.warn("Aviso al consultar URL de verify Supabase:", fetchErr);
      }
    }

    // 3. Si pegó una URL con ?code=... o la obtuvimos de Supabase
    if (extractedCode) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(extractedCode);
      if (!error && data.user?.email) {
        verifiedEmail = data.user.email.toLowerCase().trim();
      }
    }

    // 4. Si pegó un enlace de Supabase con token_hash clásico (no pkce)
    if (!verifiedEmail && extractedTokenHash && !extractedTokenHash.startsWith("pkce_")) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: extractedTokenHash,
        type: extractedType,
      });
      if (!error && data.user?.email) {
        verifiedEmail = data.user.email.toLowerCase().trim();
      }
    }

    // 5. Si ingresó un código OTP (numérico de 6 dígitos) o texto
    if (!verifiedEmail) {
      const cleanOtp = extractedToken.replace(/\s+/g, "");
      // Si el email no fue provisto, probar contra los integrantes del hogar autorizados
      const candidateEmails = normalizedEmail ? [normalizedEmail] : AUTHORIZED_EMAILS;

      for (const candEmail of candidateEmails) {
        // Intento 1: type = "email"
        const firstTry = await supabase.auth.verifyOtp({
          email: candEmail,
          token: cleanOtp,
          type: "email",
        });

        if (!firstTry.error && firstTry.data.user?.email) {
          verifiedEmail = firstTry.data.user.email.toLowerCase().trim();
          break;
        }

        // Intento 2: type = "magiclink"
        const secondTry = await supabase.auth.verifyOtp({
          email: candEmail,
          token: cleanOtp,
          type: "magiclink",
        });
        if (!secondTry.error && secondTry.data.user?.email) {
          verifiedEmail = secondTry.data.user.email.toLowerCase().trim();
          break;
        }
      }
    }

    if (!verifiedEmail) {
      return {
        success: false,
        error: "Código o enlace inválido o expirado. Verificá que sea el código de 6 dígitos del último mail recibido.",
      };
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: verifiedEmail, mode: "insensitive" } },
    });

    if (!user) {
      return {
        success: false,
        error: "El correo autenticado no pertenece a un integrante del hogar.",
      };
    }

    cookieStore.set("auth_user_id", user.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    revalidatePath("/");
    return { success: true, user };
  } catch (err: unknown) {
    console.error("Error en verifyEmailOtpAction:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al validar el acceso.",
    };
  }
}

/**
 * Consulta si el usuario ya tiene un PIN de 4 dígitos configurado
 */
export async function checkUserPinStatusAction(targetEmail: string): Promise<{
  success: boolean;
  hasPin: boolean;
  userName?: string;
  error?: string;
}> {
  try {
    const normalizedEmail = (targetEmail || "").trim().toLowerCase();
    if (!AUTHORIZED_EMAILS.includes(normalizedEmail)) {
      return { success: false, hasPin: false, error: "Usuario no autorizado" };
    }

    await ensureDefaultHousehold();

    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    if (!user) {
      const isAugusto = normalizedEmail.includes("augusto");
      const nameMatch = isAugusto ? "Augusto" : "Agus";
      user = await prisma.user.findFirst({
        where: { name: { contains: nameMatch, mode: "insensitive" } },
      });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail },
        });
      }
    }

    return {
      success: true,
      hasPin: Boolean(user?.pin),
      userName: user?.name,
    };
  } catch (err: unknown) {
    console.error("Error en checkUserPinStatusAction:", err);
    return { success: false, hasPin: false };
  }
}

/**
 * Autentica o crea el PIN de 4 dígitos para acceso instantáneo (sin necesidad de SMTP ni correos)
 */
export async function loginWithPinAction(
  targetEmail: string,
  pin: string,
  isSettingNewPin = false
): Promise<{
  success: boolean;
  error?: string;
  needsSetup?: boolean;
  user?: any;
  deviceToken?: string | null;
}> {
  try {
    const normalizedEmail = (targetEmail || "").trim().toLowerCase();
    const cleanPin = (pin || "").trim();

    if (!AUTHORIZED_EMAILS.includes(normalizedEmail)) {
      return { success: false, error: "Correo no autorizado en el sistema." };
    }

    if (!/^\d{4}$/.test(cleanPin)) {
      return { success: false, error: "El PIN debe ser exactamente de 4 dígitos numéricos." };
    }

    await ensureDefaultHousehold();

    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    if (!user) {
      const isAugusto = normalizedEmail.includes("augusto");
      const nameMatch = isAugusto ? "Augusto" : "Agus";
      user = await prisma.user.findFirst({
        where: { name: { contains: nameMatch, mode: "insensitive" } },
      });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail },
        });
      }
    }

    if (!user) {
      return { success: false, error: "Usuario no encontrado." };
    }

    const hashedPin = crypto
      .createHash("sha256")
      .update(cleanPin + user.id)
      .digest("hex");

    if (!user.pin) {
      // Primera vez: si aún no configuró PIN
      if (isSettingNewPin) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { pin: hashedPin },
        });
      } else {
        return {
          success: false,
          needsSetup: true,
          error: "Aún no tenés un PIN asignado. Elegí 4 dígitos para configurarlo ahora.",
        };
      }
    } else {
      // Validar PIN ingresado
      const isValid = user.pin === hashedPin || user.pin === cleanPin;
      if (!isValid) {
        return { success: false, error: "PIN incorrecto. Intentá nuevamente." };
      }
    }

    if (!user.magicToken) {
      const token = crypto.randomBytes(24).toString("hex");
      user = await prisma.user.update({
        where: { id: user.id },
        data: { magicToken: token },
      });
    }

    const sessionLifetimeSeconds = 60 * 60 * 24 * 400; // 400 días (límite máximo permitido en navegadores)
    const cookieStore = await cookies();
    cookieStore.set("auth_user_id", user.id, {
      path: "/",
      maxAge: sessionLifetimeSeconds,
      expires: new Date(Date.now() + sessionLifetimeSeconds * 1000),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    revalidatePath("/");
    return { success: true, user, deviceToken: user.magicToken };
  } catch (err: unknown) {
    console.error("Error en loginWithPinAction:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al validar PIN.",
    };
  }
}

/**
 * Restaura automáticamente la sesión si la cookie fue limpiada por el navegador pero el token de dispositivo sigue en localStorage
 */
export async function autoRestoreSessionAction(deviceToken: string): Promise<{
  success: boolean;
  user?: any;
}> {
  try {
    const cleanToken = (deviceToken || "").trim();
    if (!cleanToken) return { success: false };

    const user = await prisma.user.findUnique({
      where: { magicToken: cleanToken },
    });

    if (!user) return { success: false };

    const sessionLifetimeSeconds = 60 * 60 * 24 * 400; // 400 días
    const cookieStore = await cookies();
    cookieStore.set("auth_user_id", user.id, {
      path: "/",
      maxAge: sessionLifetimeSeconds,
      expires: new Date(Date.now() + sessionLifetimeSeconds * 1000),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    revalidatePath("/");
    return { success: true, user };
  } catch (err: unknown) {
    console.warn("No se pudo autorecuperar sesión:", err);
    return { success: false };
  }
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

  const [expense] = await Promise.all([
    prisma.personalExpense.create({
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
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    }),
    touchCategory(data.categoryId),
  ]);

  revalidatePath("/");
  return { success: true, expense };
}

export async function deletePersonalExpenseAction(expenseId: string) {
  if (!expenseId) throw new Error("ID de gasto requerido");

  try {
    // 1. Buscar y borrar en personalExpense
    const personal = await prisma.personalExpense.findUnique({
      where: { id: expenseId },
    });

    if (personal) {
      await prisma.personalExpense.delete({
        where: { id: expenseId },
      });

      // Desvincular de resúmenes de tarjeta si hubiere
      await prisma.cardMonthlyPeriod.updateMany({
        where: { linkedExpenseId: expenseId },
        data: { linkedExpenseId: null, isPaid: false, paidAt: null },
      });

      revalidatePath("/");
      return { success: true };
    }

    // 2. Fallback: buscar en expense (Hogar) por si provenía de una copia o movimiento
    const shared = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (shared) {
      await prisma.expense.delete({
        where: { id: expenseId },
      });
      revalidatePath("/");
      return { success: true };
    }

    // 3. Si no existe en ninguna (ya fue eliminado), devolver éxito de forma idempotente
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error en deletePersonalExpenseAction:", err);
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2025") {
      revalidatePath("/");
      return { success: true };
    }
    throw err;
  }
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

export async function duplicatePersonalToSharedExpenseAction(data: {
  personalExpenseId: string;
  paidById?: string;
  markAsReviewed?: boolean;
  move?: boolean;
}) {
  const existing = await prisma.personalExpense.findUnique({
    where: { id: data.personalExpenseId },
    include: { category: true, user: true },
  });

  if (!existing) throw new Error("Gasto personal no encontrado");

  const household = await ensureDefaultHousehold();
  const year = existing.year;
  const month = existing.month;

  // Asegurar período de hogar para el mes correspondiente
  let period = await prisma.monthlyPeriod.findUnique({
    where: {
      householdId_year_month: {
        householdId: household.id,
        year,
        month,
      },
    },
  });

  if (!period) {
    period = await prisma.monthlyPeriod.create({
      data: {
        householdId: household.id,
        year,
        month,
      },
    });
  }

  // Resolver pagador en Hogar (por defecto el dueño del gasto personal)
  const paidById = data.paidById || existing.userId || household.users[0]?.id;

  // Resolver categoría válida en Hogar
  let categoryId: string = existing.categoryId || "";
  if (!categoryId) {
    const defaultCat =
      household.categories.find((c: { id: string; name: string }) => c.name.toLowerCase() === "varios") ||
      household.categories[0];
    categoryId = defaultCat?.id || "";
  }

  // Quitar la marca de [POR_REVISAR] para el gasto del hogar
  const sharedNotesClean = existing.notes ? removeReviewFlag(existing.notes) : "";
  const finalSharedNotes = data.move
    ? sharedNotesClean || null
    : sharedNotesClean
    ? `(Copia de Personal) ${sharedNotesClean}`
    : "(Copia de Personal)";

  const newExpense = await prisma.expense.create({
    data: {
      periodId: period.id,
      title: existing.title,
      amount: existing.amount,
      date: existing.date,
      categoryId,
      paidById,
      isFromPoolFund: false,
      notes: finalSharedNotes,
      installmentNumber: existing.installmentNumber,
      totalInstallments: existing.totalInstallments,
    },
    include: {
      paidBy: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  if (data.move) {
    await prisma.personalExpense.delete({
      where: { id: existing.id },
    });
  } else if (data.markAsReviewed !== false && existing.notes && hasReviewFlag(existing.notes)) {
    // Si se marcó para quitar la revisión del gasto personal, actualizar el original
    const cleanPersonalNotes = removeReviewFlag(existing.notes);
    await prisma.personalExpense.update({
      where: { id: existing.id },
      data: { notes: cleanPersonalNotes || null },
    });
  }

  if (categoryId) {
    await touchCategory(categoryId);
  }

  revalidatePath("/");
  return { success: true, expense: newExpense };
}

export async function markPersonalExpenseAsReviewedAction(personalExpenseId: string) {
  const existing = await prisma.personalExpense.findUnique({
    where: { id: personalExpenseId },
  });

  if (!existing) throw new Error("Gasto personal no encontrado");

  const cleanNotes = removeReviewFlag(existing.notes);
  const updated = await prisma.personalExpense.update({
    where: { id: personalExpenseId },
    data: {
      notes: cleanNotes || null,
    },
  });

  revalidatePath("/");
  return { success: true, expense: updated };
}

export async function togglePersonalExpenseReviewAction(personalExpenseId: string) {
  const existing = await prisma.personalExpense.findUnique({
    where: { id: personalExpenseId },
  });

  if (!existing) throw new Error("Gasto personal no encontrado");

  const currentlyMarked = hasReviewFlag(existing.notes);
  const newNotes = currentlyMarked
    ? removeReviewFlag(existing.notes)
    : addReviewFlag(existing.notes);

  const updated = await prisma.personalExpense.update({
    where: { id: personalExpenseId },
    data: {
      notes: newNotes || null,
    },
  });

  revalidatePath("/");
  return { success: true, needsReview: !currentlyMarked, expense: updated };
}

export async function createPersonalRecurringExpenseAction(data: {
  userId: string;
  title: string;
  installmentAmount: number;
  totalInstallments?: number | null;
  startYear: number;
  startMonth: number;
  categoryId?: string;
  creditCardId?: string | null;
  notes?: string;
}) {
  if (!data.title || data.installmentAmount <= 0) {
    throw new Error("Datos de cuota personal inválidos");
  }

  const created = await prisma.personalRecurringExpense.create({
    data: {
      userId: data.userId,
      title: data.title,
      installmentAmount: data.installmentAmount,
      totalInstallments: data.totalInstallments,
      startYear: data.startYear,
      startMonth: data.startMonth,
      categoryId: data.categoryId,
      creditCardId: data.creditCardId || null,
      notes: data.notes,
      isActive: true,
    },
  });

  // Si se asoció a una tarjeta de crédito, sumar al resumen actual abierto si corresponde a su período
  if (data.creditCardId) {
    const latestPeriod = await prisma.cardMonthlyPeriod.findFirst({
      where: { cardId: data.creditCardId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    if (latestPeriod && !latestPeriod.isPaid) {
      const { totalAmount } = computeApplicableCardInstallments(
        [created],
        latestPeriod.year,
        latestPeriod.month
      );
      if (totalAmount > 0) {
        await prisma.cardMonthlyPeriod.update({
          where: { id: latestPeriod.id },
          data: {
            statementAmount: {
              increment: totalAmount,
            },
          },
        });
      }
    }
  }

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

  invalidateHouseholdCache();
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

  invalidateHouseholdCache();
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

  invalidateHouseholdCache();
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
    invalidatePortfolioCache();
    revalidatePath("/");
    return created;
  }
}

export async function deletePersonalInvestmentAction(id: string) {
  if (!id) throw new Error("ID de inversión requerido");

  await prisma.personalInvestment.delete({
    where: { id },
  });

  invalidatePortfolioCache();
  revalidatePath("/");
  return { success: true };
}

export async function refreshPersonalInvestmentsAction(userId: string) {
  if (!userId) throw new Error("ID de usuario requerido");

  invalidatePortfolioCache();

  const rawInvestments = await prisma.personalInvestment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const hydrated = await hydrateInvestments(rawInvestments);
  return hydrated;
}

// ==========================================
// INVERSIONES COMPARTIDAS DEL HOGAR (FEATURE FLAG)
// ==========================================

export async function saveSharedInvestmentAction(data: {
  id?: string;
  householdId: string;
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

  if (!data.householdId || !ticker || isNaN(quantity) || quantity <= 0) {
    throw new Error("Datos de inversión incompletos o cantidad inválida.");
  }

  if (data.id) {
    const updated = await prisma.sharedInvestment.update({
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
    invalidatePortfolioCache();
    revalidatePath("/");
    return updated;
  } else {
    const created = await prisma.sharedInvestment.create({
      data: {
        householdId: data.householdId,
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
    invalidatePortfolioCache();
    revalidatePath("/");
    return created;
  }
}

export async function deleteSharedInvestmentAction(id: string) {
  if (!id) throw new Error("ID de inversión requerido");

  await prisma.sharedInvestment.delete({
    where: { id },
  });

  invalidatePortfolioCache();
  revalidatePath("/");
  return { success: true };
}

export async function refreshSharedInvestmentsAction(householdId: string) {
  if (!householdId) throw new Error("ID de hogar requerido");

  const rawInvestments = await prisma.sharedInvestment.findMany({
    where: { householdId },
    orderBy: { createdAt: "desc" },
  });

  const hydrated = await hydrateInvestments(rawInvestments);
  return hydrated;
}

// ==========================================
// TARJETAS DE CRÉDITO PERSONALES (CIERRES & VENCIMIENTOS)
// ==========================================

export async function updateCardStatementAction(data: {
  cardMonthlyPeriodId: string;
  statementAmount: number;
  statementAmountUsd?: number;
  closingDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}) {
  if (!data.cardMonthlyPeriodId) {
    throw new Error("ID de período de tarjeta requerido.");
  }

  const statementAmount = Number(data.statementAmount);
  const statementAmountUsd = Number(data.statementAmountUsd || 0);

  const existing = await prisma.cardMonthlyPeriod.findUnique({
    where: { id: data.cardMonthlyPeriodId },
    include: { card: true },
  });

  if (!existing) {
    throw new Error("Período de tarjeta no encontrado.");
  }

  const parseIsoDateMidday = (str?: string | null): Date | null => {
    if (!str) return null;
    const parts = str.split("T")[0].split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(Date.UTC(y, m, d, 12, 0, 0));
    }
    return new Date(str);
  };

  const newClosingDate = data.closingDate ? parseIsoDateMidday(data.closingDate) : existing.closingDate;
  const newDueDate = data.dueDate ? parseIsoDateMidday(data.dueDate) : existing.dueDate;

  const updated = await prisma.cardMonthlyPeriod.update({
    where: { id: data.cardMonthlyPeriodId },
    data: {
      statementAmount: isNaN(statementAmount) ? 0 : Math.max(0, statementAmount),
      statementAmountUsd: isNaN(statementAmountUsd) ? 0 : Math.max(0, statementAmountUsd),
      closingDate: newClosingDate,
      dueDate: newDueDate,
      notes: data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : existing.notes,
    },
  });

  // Guardar días en la tarjeta como nuevo base por defecto
  const closingDay = newClosingDate ? newClosingDate.getUTCDate() : existing.card.defaultClosingDay;
  const dueDay = newDueDate ? newDueDate.getUTCDate() : existing.card.defaultDueDay;

  if (closingDay || dueDay) {
    await prisma.personalCreditCard.update({
      where: { id: existing.card.id },
      data: {
        ...(closingDay ? { defaultClosingDay: closingDay } : {}),
        ...(dueDay ? { defaultDueDay: dueDay } : {}),
      },
    });

    // Si el mes siguiente ya existe y no está pagado ni con monto cargado, alinear sus fechas también
    const nextMonth = existing.month === 12 ? 1 : existing.month + 1;
    const nextYear = existing.month === 12 ? existing.year + 1 : existing.year;

    const nextPeriod = await prisma.cardMonthlyPeriod.findUnique({
      where: {
        cardId_year_month: {
          cardId: existing.card.id,
          year: nextYear,
          month: nextMonth,
        },
      },
    });

    if (nextPeriod && !nextPeriod.isPaid && nextPeriod.statementAmount === 0) {
      let nextClosingDate: Date | null = null;
      let nextDueDate: Date | null = null;

      if (closingDay) {
        const maxClose = new Date(nextYear, nextMonth, 0).getDate();
        const validCloseDay = Math.min(closingDay, maxClose);
        nextClosingDate = new Date(Date.UTC(nextYear, nextMonth - 1, validCloseDay, 12, 0, 0));
      }

      if (dueDay) {
        const offset =
          newDueDate && newClosingDate
            ? (newDueDate.getUTCFullYear() - newClosingDate.getUTCFullYear()) * 12 +
              (newDueDate.getUTCMonth() - newClosingDate.getUTCMonth())
            : dueDay < (closingDay || 20)
            ? 1
            : 0;

        const targetDueMonthIndex = nextMonth - 1 + Math.max(0, offset);
        const targetDueYear = nextYear + Math.floor(targetDueMonthIndex / 12);
        const targetDueMonth = ((targetDueMonthIndex % 12) + 12) % 12;
        const maxDue = new Date(targetDueYear, targetDueMonth + 1, 0).getDate();
        const validDueDay = Math.min(dueDay, maxDue);
        nextDueDate = new Date(Date.UTC(targetDueYear, targetDueMonth, validDueDay, 12, 0, 0));
      }

      await prisma.cardMonthlyPeriod.update({
        where: { id: nextPeriod.id },
        data: {
          ...(nextClosingDate ? { closingDate: nextClosingDate } : {}),
          ...(nextDueDate ? { dueDate: nextDueDate } : {}),
        },
      });
    }
  }

  // Si ya estaba marcada como pagada y tenía un gasto vinculado, actualizar el monto del gasto
  if (existing.isPaid && existing.linkedExpenseId) {
    await prisma.personalExpense.update({
      where: { id: existing.linkedExpenseId },
      data: {
        amount: isNaN(statementAmount) ? 0 : Math.max(0, statementAmount),
      },
    }).catch((err) => console.warn("No se pudo actualizar gasto vinculado:", err));
  }

  revalidatePath("/");
  return updated;
}

export async function toggleCardPaidAction(data: {
  cardMonthlyPeriodId: string;
  isPaid: boolean;
}) {
  const period = await prisma.cardMonthlyPeriod.findUnique({
    where: { id: data.cardMonthlyPeriodId },
    include: { card: { include: { user: true } } },
  });

  if (!period) throw new Error("Período de tarjeta no encontrado.");

  if (data.isPaid) {
    // Marcar como pagada y registrar como gasto personal en la cuenta del mes de la fecha de pago
    const household = await ensureDefaultHousehold();
    const paymentDate = new Date();
    const paymentYear = paymentDate.getFullYear();
    const paymentMonth = paymentDate.getMonth() + 1;

    // Buscar o crear categoría "Tarjetas"
    let tarjetasCat = await prisma.category.findFirst({
      where: {
        householdId: household.id,
        name: { in: ["Tarjetas", "Tarjeta", "Tarjeta de Crédito"] },
      },
    });

    if (!tarjetasCat) {
      tarjetasCat = await prisma.category.create({
        data: {
          name: "Tarjetas",
          icon: "CreditCard",
          color: "#6366f1",
          householdId: household.id,
          lastUsedAt: paymentDate,
        },
      });
    }

    const title = `Pago Tarjeta ${period.card.bank} ${period.card.brand}`;
    const amount = period.statementAmount > 0 ? period.statementAmount : 0;

    let linkedExpenseId = period.linkedExpenseId;

    if (!linkedExpenseId && amount > 0) {
      const createdExpense = await prisma.personalExpense.create({
        data: {
          userId: period.card.userId,
          year: paymentYear,
          month: paymentMonth,
          title,
          amount,
          categoryId: tarjetasCat.id,
          date: paymentDate,
          notes: `Resumen ${period.card.bank} ${period.card.brand} (Pagado el ${paymentDate.toLocaleDateString("es-AR")})`,
        },
      });
      linkedExpenseId = createdExpense.id;
      await touchCategory(tarjetasCat.id);
    }

    await prisma.cardMonthlyPeriod.update({
      where: { id: period.id },
      data: {
        isPaid: true,
        paidAt: paymentDate,
        linkedExpenseId,
      },
    });
  } else {
    // Desmarcar pagada: si había creado un gasto vinculado, eliminarlo
    if (period.linkedExpenseId) {
      try {
        await prisma.personalExpense.delete({
          where: { id: period.linkedExpenseId },
        });
      } catch (err) {
        console.warn("No se encontró o no se pudo eliminar gasto vinculado:", err);
      }
    }

    await prisma.cardMonthlyPeriod.update({
      where: { id: period.id },
      data: {
        isPaid: false,
        paidAt: null,
        linkedExpenseId: null,
      },
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function advanceCardToNextSummaryAction(data: {
  cardId: string;
  currentPeriodId: string;
}) {
  const card = await prisma.personalCreditCard.findUnique({
    where: { id: data.cardId },
    include: {
      recurringExpenses: {
        where: { isActive: true },
      },
    },
  });

  if (!card) throw new Error("Tarjeta no encontrada.");

  const currentPeriod = await prisma.cardMonthlyPeriod.findUnique({
    where: { id: data.currentPeriodId },
  });

  if (!currentPeriod) throw new Error("Resumen actual no encontrado.");

  const nextMonth = currentPeriod.month === 12 ? 1 : currentPeriod.month + 1;
  const nextYear = currentPeriod.month === 12 ? currentPeriod.year + 1 : currentPeriod.year;

  // Proyectar fecha de cierre (+1 mes respecto al resumen que se cierra)
  let nextClosingDate: Date;
  if (currentPeriod.closingDate) {
    const prevClose = new Date(currentPeriod.closingDate);
    const closeDay = prevClose.getUTCDate();
    const targetCloseMonthIdx = prevClose.getUTCMonth() + 1;
    const targetCloseYear = prevClose.getUTCFullYear() + Math.floor(targetCloseMonthIdx / 12);
    const targetCloseMonth = ((targetCloseMonthIdx % 12) + 12) % 12;
    const maxClose = new Date(targetCloseYear, targetCloseMonth + 1, 0).getDate();
    nextClosingDate = new Date(
      Date.UTC(targetCloseYear, targetCloseMonth, Math.min(closeDay, maxClose), 12, 0, 0)
    );
  } else {
    const closeDay = card.defaultClosingDay || 24;
    const maxClose = new Date(nextYear, nextMonth, 0).getDate();
    nextClosingDate = new Date(
      Date.UTC(nextYear, nextMonth - 1, Math.min(closeDay, maxClose), 12, 0, 0)
    );
  }

  // Proyectar fecha de vencimiento (+1 mes respecto al vencimiento del resumen que se cierra)
  let nextDueDate: Date;
  if (currentPeriod.dueDate) {
    const prevDue = new Date(currentPeriod.dueDate);
    const dueDay = prevDue.getUTCDate();
    const targetDueMonthIdx = prevDue.getUTCMonth() + 1;
    const targetDueYear = prevDue.getUTCFullYear() + Math.floor(targetDueMonthIdx / 12);
    const targetDueMonth = ((targetDueMonthIdx % 12) + 12) % 12;
    const maxDue = new Date(targetDueYear, targetDueMonth + 1, 0).getDate();
    nextDueDate = new Date(
      Date.UTC(targetDueYear, targetDueMonth, Math.min(dueDay, maxDue), 12, 0, 0)
    );
  } else {
    const dueDay = card.defaultDueDay || 5;
    const closeDay = card.defaultClosingDay || 24;
    const dueMonthOffset = dueDay < closeDay ? 1 : 0;
    const targetDueMonthIdx = nextMonth - 1 + dueMonthOffset;
    const targetDueYear = nextYear + Math.floor(targetDueMonthIdx / 12);
    const targetDueMonth = ((targetDueMonthIdx % 12) + 12) % 12;
    const maxDue = new Date(targetDueYear, targetDueMonth + 1, 0).getDate();
    nextDueDate = new Date(
      Date.UTC(targetDueYear, targetDueMonth, Math.min(dueDay, maxDue), 12, 0, 0)
    );
  }

  // Calcular cuotas y gastos recurrentes asociados a esta tarjeta para el nuevo resumen
  const { items: instItems, totalAmount: instTotal } = computeApplicableCardInstallments(
    card.recurringExpenses || [],
    nextYear,
    nextMonth
  );

  const autoNotes =
    instItems.length > 0
      ? `Cuotas/fijos incluidos: ${instItems
          .map((i) =>
            i.totalInstallments
              ? `${i.title} (${i.installmentNumber}/${i.totalInstallments})`
              : i.title
          )
          .join(", ")}`
      : null;

  const newPeriod = await prisma.cardMonthlyPeriod.upsert({
    where: {
      cardId_year_month: {
        cardId: card.id,
        year: nextYear,
        month: nextMonth,
      },
    },
    update: {
      closingDate: nextClosingDate,
      dueDate: nextDueDate,
      statementAmount: instTotal,
      statementAmountUsd: 0,
      isPaid: false,
      paidAt: null,
      linkedExpenseId: null,
      notes: autoNotes,
    },
    create: {
      cardId: card.id,
      year: nextYear,
      month: nextMonth,
      closingDate: nextClosingDate,
      dueDate: nextDueDate,
      statementAmount: instTotal,
      statementAmountUsd: 0,
      isPaid: false,
      notes: autoNotes,
    },
  });

  revalidatePath("/");
  return {
    success: true,
    newPeriod,
    linkedInstallments: instItems,
    linkedInstallmentsTotal: instTotal,
  };
}

export async function createPersonalCardAction(data: {
  userId: string;
  bank: string;
  brand: string;
  lastDigits?: string;
  colorTheme?: string;
  defaultClosingDay?: number;
  defaultDueDay?: number;
  notes?: string;
}) {
  const bank = data.bank.trim();
  const brand = data.brand.trim().toUpperCase();

  if (!data.userId || !bank || !brand) {
    throw new Error("Banco y marca de tarjeta son requeridos.");
  }

  const card = await prisma.personalCreditCard.create({
    data: {
      userId: data.userId,
      bank,
      brand,
      lastDigits: data.lastDigits?.trim() || null,
      colorTheme: data.colorTheme || bank,
      defaultClosingDay: data.defaultClosingDay || 20,
      defaultDueDay: data.defaultDueDay || 5,
      notes: data.notes?.trim() || null,
    },
  });

  revalidatePath("/");
  return card;
}

export async function deletePersonalCardAction(cardId: string) {
  if (!cardId) throw new Error("ID de tarjeta requerido");

  await prisma.personalCreditCard.delete({
    where: { id: cardId },
  });

  revalidatePath("/");
  return { success: true };
}



