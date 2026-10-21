import { prisma } from "@/lib/prisma";
import { ensureDefaultHousehold } from "@/lib/db-init";
import { calculateMonthlyPool } from "@/lib/finance-engine";
import { getCardsForUserAndMonth, ensureDefaultCardsForUser } from "@/lib/cards-service";
import { addReviewFlag } from "@/lib/expense-review";
import { revalidatePath } from "next/cache";

const DEFAULT_SECRET_KEY = process.env.GEMINI_GEM_API_KEY || "hogar-gem-secret-2026";

export function validateGemAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("x-api-key");
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key") || url.searchParams.get("token");

  const expectedKey = process.env.GEMINI_GEM_API_KEY || DEFAULT_SECRET_KEY;

  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === expectedKey) return true;
  }

  if (apiKeyHeader && apiKeyHeader.trim() === expectedKey) {
    return true;
  }

  if (queryKey && queryKey.trim() === expectedKey) {
    return true;
  }

  return false;
}

export function getGemApiKey(): string {
  return process.env.GEMINI_GEM_API_KEY || DEFAULT_SECRET_KEY;
}

// Resuelve el usuario a partir de nombres o variantes comunes
export function resolveUser(userInput: string, users: Array<{ id: string; name: string; email?: string | null }>) {
  if (!userInput) return users[0] || null;
  const inputNorm = userInput.toLowerCase().trim();

  // Coincidencias comunes
  if (inputNorm.includes("augusto") || inputNorm === "yo" || inputNorm === "él" || inputNorm === "el") {
    const found = users.find((u) => u.name.toLowerCase().includes("augusto"));
    if (found) return found;
  }

  if (inputNorm.includes("agus") || inputNorm.includes("agustina") || inputNorm.includes("pareja") || inputNorm.includes("ella")) {
    const found = users.find((u) => u.name.toLowerCase().includes("agus"));
    if (found) return found;
  }

  const byName = users.find((u) => u.name.toLowerCase().includes(inputNorm) || inputNorm.includes(u.name.toLowerCase()));
  if (byName) return byName;

  const byEmail = users.find((u) => u.email && u.email.toLowerCase().includes(inputNorm));
  if (byEmail) return byEmail;

  return users[0] || null;
}

// Resuelve la categoría adecuada (con fuzzy matching inteligente)
export function resolveCategory(categoryInput: string | undefined, categories: Array<{ id: string; name: string }>) {
  if (!categoryInput) {
    return categories.find((c) => c.name.toLowerCase() === "varios") || categories[0];
  }

  const catNorm = categoryInput.toLowerCase().trim();

  // Match exacto
  const exact = categories.find((c) => c.name.toLowerCase() === catNorm);
  if (exact) return exact;

  // Substring match
  const sub = categories.find((c) => c.name.toLowerCase().includes(catNorm) || catNorm.includes(c.name.toLowerCase()));
  if (sub) return sub;

  // Mapeos semánticos comunes en bancos / comercios
  const aliases: Record<string, string[]> = {
    "Supermercado": ["super", "coto", "carrefour", "dia", "jumbo", "disco", "vea", "almacen", "verduleria", "carniceria", "comestibles"],
    "Alquiler & Expensas": ["alquiler", "expensas", "consorcio", "cochera", "administracion"],
    "Servicios (Luz, Gas, Wifi)": ["edenor", "edesur", "metrogas", "naturgy", "aysa", "fibertel", "personal flow", "telecentro", "claro", "movistar", "luz", "gas", "agua", "internet", "wifi", "servicio"],
    "Salidas & Delivery": ["pedidosya", "rappi", "mcdonalds", "burger", "mostaza", "cafe", "starbucks", "bar", "cerveceria", "cena", "almuerzo", "restaurante", "delivery", "helado", "salida"],
    "Farmacia & Salud": ["farmacity", "farmacia", "medicamento", "remedio", "swiss medical", "osde", "galeno", "medico", "dentista", "odontologo", "salud"],
    "Transporte & Combustible": ["ypf", "shell", "axion", "combustible", "nafta", "gasoil", "uber", "cabify", "didi", "sube", "peaje", "estacionamiento", "taller", "mecanico"],
    "Hogar & Arreglos": ["easy", "sodimac", "ferreteria", "pintureria", "limpieza", "bazar", "mueble", "electrodomestico", "plomero", "electricista"],
    "Varios": ["varios", "otros", "compra", "kiosco", "libreria"],
  };

  for (const [targetCat, keywords] of Object.entries(aliases)) {
    if (keywords.some((k) => catNorm.includes(k))) {
      const match = categories.find((c) => c.name.toLowerCase().includes(targetCat.toLowerCase()));
      if (match) return match;
    }
  }

  return categories.find((c) => c.name.toLowerCase() === "varios") || categories[0];
}

// 1. Obtener estado financiero completo para que Gemini responda preguntas de todo tipo
export async function getGemFinancialStatus(yearParam?: number, monthParam?: number) {
  const household = await ensureDefaultHousehold();
  const now = new Date();
  const year = yearParam ?? now.getFullYear();
  const month = monthParam ?? (now.getMonth() + 1);

  // Período de Hogar
  let period = await prisma.monthlyPeriod.findUnique({
    where: {
      householdId_year_month: {
        householdId: household.id,
        year,
        month,
      },
    },
    include: {
      incomes: { include: { user: true } },
      expenses: {
        include: { paidBy: true, category: true },
        orderBy: { date: "desc" },
      },
      investmentTransfer: true,
      fciWithdrawals: true,
    },
  });

  if (!period) {
    period = await prisma.monthlyPeriod.create({
      data: {
        householdId: household.id,
        year,
        month,
      },
      include: {
        incomes: { include: { user: true } },
        expenses: {
          include: { paidBy: true, category: true },
          orderBy: { date: "desc" },
        },
        investmentTransfer: true,
        fciWithdrawals: true,
      },
    });
  }

  // Recurrentes compartidos
  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: { householdId: household.id, isActive: true },
    include: { paidBy: true, category: true },
  });

  // Salarios default si no están en el mes
  const incomesWithDefaults = household.users.map((u: any) => {
    const existing = period?.incomes.find((i: any) => i.userId === u.id);
    if (existing) return existing;
    const isAugusto = u.name.toLowerCase().includes("augusto");
    const defaultAmount = isAugusto ? 1200000 : 900000;
    return {
      userId: u.id,
      amount: defaultAmount,
      contributionPct: 0.6,
      targetPoolAmount: defaultAmount * 0.6,
      user: u,
    };
  });

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

  const engineMembers = household.users.map((u: any) => {
    const incomeRecord = incomesWithDefaults.find((i: any) => i.userId === u.id);
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
    .filter((w: any) => w.destination === "POOL_FUND")
    .reduce((acc: number, w: any) => acc + w.amount, 0);

  const poolSummary = calculateMonthlyPool(
    engineMembers,
    poolFundExpenses,
    carriedOver,
    investedInFCI,
    fciWithdrawnToPool
  );

  // Datos personales de cada usuario
  const usersPersonalData = await Promise.all(
    household.users.map(async (u: any) => {
      const pIncome = await prisma.personalIncome.findUnique({
        where: { userId_year_month: { userId: u.id, year, month } },
      });
      const pExpenses = await prisma.personalExpense.findMany({
        where: { userId: u.id, year, month },
        include: { category: true },
        orderBy: { date: "desc" },
      });
      const pRecurring = await prisma.personalRecurringExpense.findMany({
        where: { userId: u.id, isActive: true },
        include: { category: true, creditCard: true },
      });
      const pCardsResult = await getCardsForUserAndMonth(u.id, u.name, year, month);

      const isAugusto = u.name.toLowerCase().includes("augusto");
      const defaultSalary = isAugusto ? 1200000 : 900000;
      const baseSalary = incomesWithDefaults.find((i: any) => i.userId === u.id)?.amount || defaultSalary;
      const personalPool = baseSalary * 0.4 + (pIncome?.extraAmount || 0) + (pIncome?.carriedOverBalance || 0);
      const totalPersonalExpenses = pExpenses.reduce((sum, e) => sum + e.amount, 0);

      return {
        userId: u.id,
        userName: u.name,
        baseSalary,
        personalBudget40Pct: baseSalary * 0.4,
        extraIncome: pIncome?.extraAmount || 0,
        carriedOverBalance: pIncome?.carriedOverBalance || 0,
        totalAvailablePersonal: personalPool,
        totalPersonalExpenses,
        remainingPersonal: Math.max(0, personalPool - totalPersonalExpenses),
        expensesCount: pExpenses.length,
        recentExpenses: pExpenses.slice(0, 5).map((e) => ({
          id: e.id,
          title: e.title,
          amount: e.amount,
          date: e.date.toISOString().split("T")[0],
          category: e.category?.name || "Varios",
          notes: e.notes,
        })),
        activeRecurringCount: pRecurring.length,
        creditCards: pCardsResult.cards.map((c: any) => ({
          id: c.id,
          bank: c.bank,
          brand: c.brand,
          lastDigits: c.lastDigits,
          statementAmount: c.period?.statementAmount || 0,
          statementAmountUsd: c.period?.statementAmountUsd || 0,
          isPaid: c.period?.isPaid || false,
          dueDate: c.period?.dueDate ? new Date(c.period.dueDate).toISOString().split("T")[0] : null,
          closingDate: c.period?.closingDate ? new Date(c.period.closingDate).toISOString().split("T")[0] : null,
          pendingInstallmentsAmount: c.applicableInstallments?.totalAmount || 0,
        })),
      };
    })
  );

  // FCI y Portafolio compartido
  const investmentFund = await prisma.investmentFund.findFirst({
    where: { householdId: household.id },
    include: {
      contributions: { orderBy: { investedAt: "desc" }, take: 5 },
      withdrawals: { orderBy: { withdrawnAt: "desc" }, take: 5 },
    },
  });

  return {
    success: true,
    period: {
      year,
      month,
      status: period.status,
    },
    household: {
      id: household.id,
      name: household.name,
      currency: household.currency,
      totalSalaries: poolSummary.totalSalaries,
      budget60PctAvailable: poolSummary.totalAvailablePool,
      totalExpensesHogar: poolSummary.totalExpenses,
      remainingPoolHogar: poolSummary.remainingPool,
      burnRatePct: Math.round(poolSummary.burnRatePct),
      investedInFCI: poolSummary.investedInFCI,
      fciWithdrawnToPool: poolSummary.fciWithdrawnToPool || 0,
      memberPocketBalances: poolSummary.memberBalances.map((mb) => ({
        userId: mb.userId,
        name: mb.name,
        committedAmount: mb.committedAmount,
        outOfPocketPaid: mb.outOfPocketPaid,
        netBalance: mb.netBalance,
      })),
      recentExpenses: period.expenses.slice(0, 8).map((e) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        date: e.date.toISOString().split("T")[0],
        category: e.category.name,
        paidBy: e.paidBy.name,
        notes: e.notes,
      })),
      activeRecurringCount: recurringExpenses.length,
    },
    personalUsers: usersPersonalData,
    fciFund: {
      currentValue: investmentFund?.currentValue || 0,
    },
    categories: household.categories.map((c: any) => ({
      id: c.id,
      name: c.name,
    })),
    users: household.users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
    })),
  };
}

// 2. Consultar gastos en detalle con filtros
export async function queryGemExpenses(params: {
  scope?: "hogar" | "personal" | "all";
  year?: number;
  month?: number;
  user?: string;
  category?: string;
  search?: string;
  limit?: number;
}) {
  const household = await ensureDefaultHousehold();
  const now = new Date();
  const year = params.year ?? now.getFullYear();
  const month = params.month ?? (now.getMonth() + 1);
  const scope = params.scope || "all";
  const limit = Math.min(params.limit || 50, 100);

  const matchedUser = params.user ? resolveUser(params.user, household.users) : null;
  const matchedCategory = params.category ? resolveCategory(params.category, household.categories) : null;
  const searchQ = params.search?.toLowerCase().trim();

  const results: any[] = [];

  // Buscar en Hogar si corresponde
  if (scope === "hogar" || scope === "all") {
    const period = await prisma.monthlyPeriod.findUnique({
      where: { householdId_year_month: { householdId: household.id, year, month } },
      include: {
        expenses: {
          include: { paidBy: true, category: true },
          orderBy: { date: "desc" },
        },
      },
    });

    if (period) {
      for (const e of period.expenses) {
        if (matchedUser && e.paidById !== matchedUser.id) continue;
        if (matchedCategory && e.categoryId !== matchedCategory.id) continue;
        if (searchQ) {
          const matchTitle = e.title.toLowerCase().includes(searchQ);
          const matchNotes = e.notes?.toLowerCase().includes(searchQ);
          const matchCat = e.category.name.toLowerCase().includes(searchQ);
          if (!matchTitle && !matchNotes && !matchCat) continue;
        }

        results.push({
          id: e.id,
          scope: "hogar",
          title: e.title,
          amount: e.amount,
          date: e.date.toISOString().split("T")[0],
          category: e.category.name,
          paidBy: e.paidBy.name,
          notes: e.notes,
          installmentNumber: e.installmentNumber,
          totalInstallments: e.totalInstallments,
        });
      }
    }
  }

  // Buscar en Personal si corresponde
  if (scope === "personal" || scope === "all") {
    const userIds = matchedUser ? [matchedUser.id] : household.users.map((u: any) => u.id);
    const personalExpenses = await prisma.personalExpense.findMany({
      where: {
        userId: { in: userIds },
        year,
        month,
      },
      include: { user: true, category: true },
      orderBy: { date: "desc" },
      take: limit,
    });

    for (const e of personalExpenses) {
      if (matchedCategory && e.categoryId !== matchedCategory.id) continue;
      if (searchQ) {
        const matchTitle = e.title.toLowerCase().includes(searchQ);
        const matchNotes = e.notes?.toLowerCase().includes(searchQ);
        const matchCat = e.category?.name.toLowerCase().includes(searchQ);
        if (!matchTitle && !matchNotes && !matchCat) continue;
      }

      results.push({
        id: e.id,
        scope: "personal",
        title: e.title,
        amount: e.amount,
        date: e.date.toISOString().split("T")[0],
        category: e.category?.name || "Varios",
        paidBy: e.user.name,
        notes: e.notes,
        installmentNumber: e.installmentNumber,
        totalInstallments: e.totalInstallments,
      });
    }
  }

  // Ordenar por fecha desc
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const finalExpenses = results.slice(0, limit);
  const subtotal = finalExpenses.reduce((s, e) => s + e.amount, 0);

  return {
    success: true,
    year,
    month,
    totalExpensesCount: finalExpenses.length,
    subtotalAmount: subtotal,
    expenses: finalExpenses,
  };
}

// 3. Crear gasto desde captura bancaria o prompt de Gemini
export async function createGemExpense(payload: {
  title: string;
  amount: number;
  scope?: "hogar" | "personal";
  user?: string;
  category?: string;
  date?: string;
  notes?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  creditCardName?: string;
  markForReview?: boolean;
}) {
  const household = await ensureDefaultHousehold();
  if (!payload.title || typeof payload.amount !== "number" || payload.amount <= 0) {
    throw new Error("Debe especificar un comercio/título válido y un monto mayor a 0.");
  }

  const assignedUser = resolveUser(payload.user || "Augusto", household.users);
  if (!assignedUser) {
    throw new Error("No se pudo resolver el usuario para asignar el gasto.");
  }

  const assignedCategory = resolveCategory(payload.category, household.categories);

  const dateObj = payload.date ? new Date(payload.date) : new Date();
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const scope = payload.scope || "hogar";

  let finalNotes = payload.notes?.trim() || null;
  if (scope === "personal" && (payload.markForReview || payload.creditCardName)) {
    finalNotes = addReviewFlag(finalNotes, payload.creditCardName);
  }

  if (scope === "personal") {
    // Buscar o asegurar período personal
    await prisma.personalIncome.upsert({
      where: { userId_year_month: { userId: assignedUser.id, year, month } },
      update: {},
      create: { userId: assignedUser.id, year, month },
    });

    const newExpense = await prisma.personalExpense.create({
      data: {
        userId: assignedUser.id,
        year,
        month,
        title: payload.title.trim(),
        amount: payload.amount,
        date: dateObj,
        categoryId: assignedCategory.id,
        installmentNumber: payload.installmentNumber,
        totalInstallments: payload.totalInstallments,
        notes: finalNotes,
      },
      include: { category: true, user: true },
    });

    revalidatePath("/");
    return {
      success: true,
      message: `Gasto personal de $${Math.round(payload.amount).toLocaleString("es-AR")} en "${newExpense.title}" registrado para ${assignedUser.name}${payload.markForReview ? " (con flag de revisión pendiente)" : ""}.`,
      expense: {
        id: newExpense.id,
        scope: "personal",
        title: newExpense.title,
        amount: newExpense.amount,
        date: newExpense.date.toISOString().split("T")[0],
        category: newExpense.category?.name || "Varios",
        user: newExpense.user.name,
        needsReview: !!payload.markForReview,
      },
    };
  } else {
    // Hogar compartido (60%)
    let period = await prisma.monthlyPeriod.findUnique({
      where: { householdId_year_month: { householdId: household.id, year, month } },
    });

    if (!period) {
      period = await prisma.monthlyPeriod.create({
        data: { householdId: household.id, year, month },
      });
    }

    const newExpense = await prisma.expense.create({
      data: {
        periodId: period.id,
        title: payload.title.trim(),
        amount: payload.amount,
        date: dateObj,
        categoryId: assignedCategory.id,
        paidById: assignedUser.id,
        isFromPoolFund: false,
        installmentNumber: payload.installmentNumber,
        totalInstallments: payload.totalInstallments,
        notes: finalNotes,
      },
      include: { category: true, paidBy: true },
    });

    revalidatePath("/");
    return {
      success: true,
      message: `Gasto compartido de $${Math.round(payload.amount).toLocaleString("es-AR")} en "${newExpense.title}" registrado con éxito (pagó ${assignedUser.name}).`,
      expense: {
        id: newExpense.id,
        scope: "hogar",
        title: newExpense.title,
        amount: newExpense.amount,
        date: newExpense.date.toISOString().split("T")[0],
        category: newExpense.category.name,
        paidBy: newExpense.paidBy.name,
      },
    };
  }
}

// 3.b Cargar lote de gastos (ideal para resúmenes completos de tarjeta de crédito)
export async function createGemExpensesBatch(payload: {
  user?: string;
  scope?: "hogar" | "personal";
  creditCardName?: string;
  markForReview?: boolean;
  expenses: Array<{
    title: string;
    amount: number;
    category?: string;
    date?: string;
    notes?: string;
    installmentNumber?: number;
    totalInstallments?: number;
  }>;
}) {
  const household = await ensureDefaultHousehold();
  const assignedUser = resolveUser(payload.user || "Augusto", household.users);
  if (!assignedUser) {
    throw new Error("No se pudo resolver el usuario para asignar los gastos.");
  }

  const scope = payload.scope || "personal";
  const markForReview = payload.markForReview ?? (scope === "personal");
  const items = payload.expenses;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("El lote debe contener al menos un gasto en la lista 'expenses'.");
  }

  const createdExpenses: Array<{
    id: string;
    title: string;
    amount: number;
    date: string;
    category: string;
    needsReview?: boolean;
  }> = [];
  let totalAmount = 0;

  for (const item of items) {
    if (!item.title || typeof item.amount !== "number" || item.amount <= 0) {
      continue;
    }

    const assignedCategory = resolveCategory(item.category, household.categories);
    const dateObj = item.date ? new Date(item.date) : new Date();
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    let finalNotes = item.notes?.trim() || null;
    if (scope === "personal" && (markForReview || payload.creditCardName)) {
      finalNotes = addReviewFlag(finalNotes, payload.creditCardName);
    }

    if (scope === "personal") {
      await prisma.personalIncome.upsert({
        where: { userId_year_month: { userId: assignedUser.id, year, month } },
        update: {},
        create: { userId: assignedUser.id, year, month },
      });

      const newExpense = await prisma.personalExpense.create({
        data: {
          userId: assignedUser.id,
          year,
          month,
          title: item.title.trim(),
          amount: item.amount,
          date: dateObj,
          categoryId: assignedCategory.id,
          installmentNumber: item.installmentNumber,
          totalInstallments: item.totalInstallments,
          notes: finalNotes,
        },
        include: { category: true, user: true },
      });

      createdExpenses.push({
        id: newExpense.id,
        title: newExpense.title,
        amount: newExpense.amount,
        date: newExpense.date.toISOString().split("T")[0],
        category: newExpense.category?.name || "Varios",
        needsReview: markForReview,
      });
      totalAmount += newExpense.amount;
    } else {
      let period = await prisma.monthlyPeriod.findUnique({
        where: { householdId_year_month: { householdId: household.id, year, month } },
      });

      if (!period) {
        period = await prisma.monthlyPeriod.create({
          data: { householdId: household.id, year, month },
        });
      }

      const newExpense = await prisma.expense.create({
        data: {
          periodId: period.id,
          title: item.title.trim(),
          amount: item.amount,
          date: dateObj,
          categoryId: assignedCategory.id,
          paidById: assignedUser.id,
          isFromPoolFund: false,
          installmentNumber: item.installmentNumber,
          totalInstallments: item.totalInstallments,
          notes: finalNotes,
        },
        include: { category: true, paidBy: true },
      });

      createdExpenses.push({
        id: newExpense.id,
        title: newExpense.title,
        amount: newExpense.amount,
        date: newExpense.date.toISOString().split("T")[0],
        category: newExpense.category.name,
      });
      totalAmount += newExpense.amount;
    }
  }

  revalidatePath("/");

  return {
    success: true,
    message: `Se cargaron con éxito ${createdExpenses.length} gastos (${scope === "personal" ? "Personales" : "Compartidos"}) por un total de $${Math.round(totalAmount).toLocaleString("es-AR")} para ${assignedUser.name}${markForReview && scope === "personal" ? " (marcados con distintivo de revisión para verificar si son compartidos)" : ""}.`,
    user: assignedUser.name,
    scope,
    createdCount: createdExpenses.length,
    totalAmount,
    expenses: createdExpenses,
  };
}

// 4. Crear gasto recurrente o plan de cuotas fijas
export async function createGemRecurring(payload: {
  title: string;
  installmentAmount: number;
  totalInstallments?: number | null;
  scope?: "hogar" | "personal";
  user?: string;
  category?: string;
  startYear?: number;
  startMonth?: number;
  notes?: string;
  creditCardName?: string;
}) {
  const household = await ensureDefaultHousehold();
  if (!payload.title || typeof payload.installmentAmount !== "number" || payload.installmentAmount <= 0) {
    throw new Error("Título y monto de cuota válidos requeridos.");
  }

  const assignedUser = resolveUser(payload.user || "Augusto", household.users);
  const assignedCategory = resolveCategory(payload.category, household.categories);
  const now = new Date();
  const startYear = payload.startYear || now.getFullYear();
  const startMonth = payload.startMonth || (now.getMonth() + 1);
  const scope = payload.scope || "hogar";

  if (scope === "personal") {
    let creditCardId: string | null = null;
    if (payload.creditCardName) {
      const cards = await prisma.personalCreditCard.findMany({ where: { userId: assignedUser.id } });
      const normCard = payload.creditCardName.toLowerCase();
      const match = cards.find((c) =>
        normCard.includes(c.bank.toLowerCase()) || normCard.includes(c.brand.toLowerCase())
      );
      if (match) creditCardId = match.id;
    }

    const rec = await prisma.personalRecurringExpense.create({
      data: {
        userId: assignedUser.id,
        title: payload.title.trim(),
        installmentAmount: payload.installmentAmount,
        totalInstallments: payload.totalInstallments || null,
        startYear,
        startMonth,
        categoryId: assignedCategory.id,
        creditCardId,
        notes: payload.notes?.trim() || null,
      },
    });

    revalidatePath("/");
    return {
      success: true,
      message: `Plan de cuotas personal "${rec.title}" creado ($${rec.installmentAmount}/mes ${rec.totalInstallments ? `por ${rec.totalInstallments} cuotas` : "mensual fijo"}).`,
      recurring: rec,
    };
  } else {
    const rec = await prisma.recurringExpense.create({
      data: {
        householdId: household.id,
        paidById: assignedUser.id,
        title: payload.title.trim(),
        installmentAmount: payload.installmentAmount,
        totalInstallments: payload.totalInstallments || null,
        startYear,
        startMonth,
        categoryId: assignedCategory.id,
        notes: payload.notes?.trim() || null,
      },
    });

    revalidatePath("/");
    return {
      success: true,
      message: `Cuota/Gasto recurrente de hogar "${rec.title}" registrado ($${rec.installmentAmount}/mes).`,
      recurring: rec,
    };
  }
}

// 5. Actualizar resumen de tarjeta de crédito o marcar como pagada
export async function updateGemCardStatement(payload: {
  user?: string;
  bank: string;
  brand: "VISA" | "AMEX" | "MASTERCARD" | string;
  statementAmount?: number;
  statementAmountUsd?: number;
  isPaid?: boolean;
  closingDate?: string;
  dueDate?: string;
  notes?: string;
}) {
  const household = await ensureDefaultHousehold();
  const assignedUser = resolveUser(payload.user || "Augusto", household.users);

  await ensureDefaultCardsForUser(assignedUser.id, assignedUser.name);

  const cards = await prisma.personalCreditCard.findMany({
    where: { userId: assignedUser.id },
    include: {
      periods: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 1,
      },
    },
  });

  const bNorm = payload.bank.toLowerCase();
  const brNorm = payload.brand.toUpperCase();
  const card = cards.find(
    (c) => c.bank.toLowerCase().includes(bNorm) && (c.brand.toUpperCase().includes(brNorm) || brNorm.includes(c.brand.toUpperCase()))
  ) || cards.find((c) => c.bank.toLowerCase().includes(bNorm));

  if (!card) {
    throw new Error(`No se encontró la tarjeta ${payload.bank} ${payload.brand} para ${assignedUser.name}.`);
  }

  const activePeriod = card.periods[0];
  const now = new Date();
  const year = activePeriod ? activePeriod.year : now.getFullYear();
  const month = activePeriod ? activePeriod.month : now.getMonth() + 1;

  const updatedPeriod = await prisma.cardMonthlyPeriod.upsert({
    where: { cardId_year_month: { cardId: card.id, year, month } },
    update: {
      ...(typeof payload.statementAmount === "number" ? { statementAmount: payload.statementAmount } : {}),
      ...(typeof payload.statementAmountUsd === "number" ? { statementAmountUsd: payload.statementAmountUsd } : {}),
      ...(typeof payload.isPaid === "boolean" ? { isPaid: payload.isPaid, paidAt: payload.isPaid ? new Date() : null } : {}),
      ...(payload.closingDate ? { closingDate: new Date(payload.closingDate) } : {}),
      ...(payload.dueDate ? { dueDate: new Date(payload.dueDate) } : {}),
      ...(payload.notes ? { notes: payload.notes } : {}),
    },
    create: {
      cardId: card.id,
      year,
      month,
      statementAmount: payload.statementAmount || 0,
      statementAmountUsd: payload.statementAmountUsd || 0,
      isPaid: payload.isPaid || false,
      paidAt: payload.isPaid ? new Date() : null,
      closingDate: payload.closingDate ? new Date(payload.closingDate) : null,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      notes: payload.notes || null,
    },
  });

  revalidatePath("/");
  return {
    success: true,
    message: `Resumen de ${card.bank} ${card.brand} actualizado a $${Math.round(updatedPeriod.statementAmount).toLocaleString("es-AR")}${payload.isPaid ? " (marcado como PAGADO)" : ""}.`,
    card: {
      bank: card.bank,
      brand: card.brand,
      statementAmount: updatedPeriod.statementAmount,
      statementAmountUsd: updatedPeriod.statementAmountUsd,
      isPaid: updatedPeriod.isPaid,
      dueDate: updatedPeriod.dueDate?.toISOString().split("T")[0] || null,
    },
  };
}

// 6. Generador del OpenAPI Specification para Custom Gems
export function getGemOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Gastos Hogar & Finanzas Personales API",
      description: "API de integración directa con Gemini para registrar comprobantes bancarios, consultar saldos del 60%, estado de tarjetas de crédito y balances de bolsillo.",
      version: "1.0.0",
    },
    servers: [
      {
        url: baseUrl,
        description: "Servidor Principal de Gastos Hogar",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "Clave de API secreta para conectar Gemini con la app Gastos Hogar.",
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
    paths: {
      "/api/gem/status": {
        get: {
          summary: "Obtener estado financiero completo actual",
          description: "Devuelve el resumen general del presupuesto del 60% del Hogar, los saldos personales del 40%, balances de bolsillo entre Augusto y Agus, estado de tarjetas de crédito con fechas de vencimiento y remanente FCI.",
          operationId: "getFinancialStatus",
          parameters: [
            {
              name: "year",
              in: "query",
              required: false,
              schema: { type: "integer" },
              description: "Año a consultar (ej: 2026). Por defecto el actual.",
            },
            {
              name: "month",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 12 },
              description: "Mes a consultar (1 al 12). Por defecto el actual.",
            },
          ],
          responses: {
            "200": {
              description: "Resumen financiero generado con éxito.",
              content: { "application/json": {} },
            },
          },
        },
      },
      "/api/gem/expenses": {
        get: {
          summary: "Consultar lista de gastos registrados",
          description: "Permite filtrar y buscar gastos cargados en el mes por categoría, pagador (Augusto o Agus), ámbito (hogar o personal) o texto de búsqueda.",
          operationId: "queryExpenses",
          parameters: [
            {
              name: "scope",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["hogar", "personal", "all"] },
              description: "Ámbito del gasto: 'hogar' (fondo común 60%), 'personal' o 'all'.",
            },
            {
              name: "user",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Nombre del pagador ('Augusto' o 'Agus').",
            },
            {
              name: "category",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Categoría (ej: Supermercado, Salidas & Delivery, etc.).",
            },
            {
              name: "search",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Texto a buscar en el título o comercio (ej: 'Coto', 'YPF').",
            },
            {
              name: "year",
              in: "query",
              required: false,
              schema: { type: "integer" },
            },
            {
              name: "month",
              in: "query",
              required: false,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": {
              description: "Gastos filtrados obtenidos con éxito.",
            },
          },
        },
        post: {
          summary: "Registrar gasto individual o lote de gastos (Resumen de tarjeta)",
          description: "Registra un gasto o un lote completo de gastos (ej: resumen de tarjeta de crédito bancaria) en la app. Soporta gastos personales con 'markForReview: true' para que el usuario luego decida si los duplica en gastos compartidos del hogar o los deja en personal.",
          operationId: "createExpense",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Comercio o concepto del gasto individual (ej: 'Coto', 'Farmacity', 'Shell', 'YPF'). Requerido si no se envía 'expenses'.",
                    },
                    amount: {
                      type: "number",
                      description: "Monto total del gasto en pesos ARS.",
                    },
                    scope: {
                      type: "string",
                      enum: ["hogar", "personal"],
                      default: "personal",
                      description: "'personal' para gastos privados (default en resúmenes de tarjeta) o 'hogar' para gasto compartido del 60%.",
                    },
                    user: {
                      type: "string",
                      description: "Quién pagó o titular: 'Augusto' o 'Agus'.",
                    },
                    category: {
                      type: "string",
                      description: "Categoría aproximada (ej: 'Supermercado', 'Salidas & Delivery', 'Transporte & Combustible', 'Farmacia & Salud', 'Alquiler & Expensas', 'Servicios', 'Hogar & Arreglos', 'Varios').",
                    },
                    date: {
                      type: "string",
                      description: "Fecha del comprobante en formato YYYY-MM-DD. Si no se especifica, usa hoy.",
                    },
                    creditCardName: {
                      type: "string",
                      description: "Nombre de la tarjeta de crédito del resumen (ej: 'Galicia Visa', 'Santander', 'Mercado Pago').",
                    },
                    markForReview: {
                      type: "boolean",
                      default: true,
                      description: "Si es true, marca el gasto con distintivo de 'revisión pendiente' en los gastos personales para ver si corresponde duplicarlo al hogar.",
                    },
                    notes: {
                      type: "string",
                      description: "Notas o número de comprobante.",
                    },
                    installmentNumber: {
                      type: "integer",
                      description: "Número de cuota actual si aplica (ej: 1).",
                    },
                    totalInstallments: {
                      type: "integer",
                      description: "Total de cuotas si aplica (ej: 3 o 6).",
                    },
                    expenses: {
                      type: "array",
                      description: "Lista de compras o consumos extraídos del resumen de tarjeta para cargarlos en lote.",
                      items: {
                        type: "object",
                        required: ["title", "amount"],
                        properties: {
                          title: { type: "string", description: "Comercio o concepto" },
                          amount: { type: "number", description: "Monto en pesos" },
                          category: { type: "string" },
                          date: { type: "string", description: "YYYY-MM-DD" },
                          installmentNumber: { type: "integer" },
                          totalInstallments: { type: "integer" },
                          notes: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Gasto(s) registrado(s) exitosamente.",
            },
          },
        },
      },
      "/api/gem/recurring": {
        post: {
          summary: "Registrar un plan de cuotas fijas o servicio recurrente",
          description: "Crea una cuota mensual recurrente (ej: 6 cuotas de electrodoméstico o servicio mensual fijo como Netflix).",
          operationId: "createRecurringExpense",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "installmentAmount"],
                  properties: {
                    title: { type: "string" },
                    installmentAmount: { type: "number", description: "Monto de la cuota mensual." },
                    totalInstallments: { type: "integer", nullable: true, description: "Total de cuotas (dejar null si es mensual fijo sin fin)." },
                    scope: { type: "string", enum: ["hogar", "personal"], default: "hogar" },
                    user: { type: "string", description: "'Augusto' o 'Agus'" },
                    category: { type: "string" },
                    creditCardName: { type: "string", description: "Opcional: nombre de la tarjeta asociada (ej: 'Galicia Visa', 'Santander', 'Mercado Pago')." },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Plan de cuotas creado con éxito.",
            },
          },
        },
      },
      "/api/gem/cards/statement": {
        post: {
          summary: "Actualizar resumen o pago de tarjeta de crédito",
          description: "Permite actualizar el monto del resumen de una tarjeta de crédito o marcarla como pagada.",
          operationId: "updateCardStatement",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["bank", "brand"],
                  properties: {
                    user: { type: "string", description: "'Augusto' o 'Agus'" },
                    bank: { type: "string", description: "Ej: 'Santander', 'Galicia', 'BBVA', 'Mercado Pago'" },
                    brand: { type: "string", description: "'VISA', 'AMEX', 'MASTERCARD'" },
                    statementAmount: { type: "number", description: "Monto total del resumen en pesos ARS." },
                    statementAmountUsd: { type: "number", description: "Monto en dólares si corresponde." },
                    isPaid: { type: "boolean", description: "True para marcar pagada." },
                    dueDate: { type: "string", description: "Fecha de vencimiento YYYY-MM-DD." },
                    closingDate: { type: "string", description: "Fecha de cierre YYYY-MM-DD." },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Resumen de tarjeta actualizado.",
            },
          },
        },
      },
    },
  };
}
