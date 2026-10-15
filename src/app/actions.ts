"use server";

import { prisma } from "@/lib/prisma";
import { ensureDefaultHousehold } from "@/lib/db-init";
import { calculateMonthlyPool } from "@/lib/finance-engine";
import { revalidatePath } from "next/cache";

export async function getDashboardData(targetYear?: number, targetMonth?: number) {
  const household = await ensureDefaultHousehold();

  const now = new Date();
  const year = targetYear ?? now.getFullYear();
  const month = targetMonth ?? (now.getMonth() + 1);

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

  const poolSummary = calculateMonthlyPool(engineMembers, poolFundExpenses);

  // Obtener Fondo de Inversión
  const investmentFund = await prisma.investmentFund.findFirst({
    where: { householdId: household.id },
    include: {
      contributions: {
        orderBy: { investedAt: "desc" },
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

  return {
    household,
    users: household.users,
    categories: household.categories,
    period,
    poolSummary,
    investmentFund,
    recurringExpenses: activeInstallmentsWithStatus,
    currentYear: year,
    currentMonth: month,
  };
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

  const totalPool = period.incomes.reduce((acc, i) => acc + i.targetPoolAmount, 0);
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
