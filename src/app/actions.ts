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
    period = await prisma.monthlyPeriod.create({
      data: {
        year,
        month,
        householdId: household.id,
        incomes: {
          create: household.users.map((u) => ({
            userId: u.id,
            amount: 0,
            contributionPct: 0.60,
            targetPoolAmount: 0,
          })),
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

  return {
    household,
    users: household.users,
    categories: household.categories,
    period,
    poolSummary,
    investmentFund,
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
