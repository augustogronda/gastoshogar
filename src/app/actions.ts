"use server";

import { prisma } from "@/lib/prisma";
import { ensureDefaultHousehold } from "@/lib/db-init";
import { calculateMonthlyPool } from "@/lib/finance-engine";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

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

  const investedInFCI = period.investmentTransfer ? period.investmentTransfer.amount : 0;
  const carriedOver = period.carriedOverBalance || 0;

  const poolSummary = calculateMonthlyPool(
    engineMembers,
    poolFundExpenses,
    carriedOver,
    investedInFCI
  );

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

  // Autenticación: Identificar usuario conectado (Augusto o Agus)
  const cookieStore = await cookies();
  const loggedUserId = cookieStore.get("auth_user_id")?.value;
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
      isClosed: personalIncome.status === "CLOSED",
    };
  }

  return {
    household,
    users: household.users,
    currentUser,
    categories: household.categories,
    period,
    poolSummary,
    investmentFund,
    recurringExpenses: activeInstallmentsWithStatus,
    personalData,
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
// AUTENTICACIÓN SIMPLE (Augusto / Agus)
// ==========================================

export async function loginAction(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set("auth_user_id", userId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 año de persistencia en iPhone
    httpOnly: true,
    sameSite: "lax",
  });
  revalidatePath("/");
  return { success: true };
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


