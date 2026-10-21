import { prisma } from "@/lib/prisma";

export interface CardBrandInfo {
  name: string;
  logo: "visa" | "mastercard" | "amex" | "other";
}

export interface BankTheme {
  name: string;
  gradient: string;
  accentColor: string;
  chipColor: string;
}

export const BANK_THEMES: Record<string, BankTheme> = {
  Santander: {
    name: "Santander",
    gradient: "from-red-600 via-rose-700 to-zinc-950",
    accentColor: "#ec0000",
    chipColor: "from-amber-200 to-yellow-500",
  },
  Galicia: {
    name: "Galicia",
    gradient: "from-orange-500 via-amber-600 to-zinc-950",
    accentColor: "#ff6a00",
    chipColor: "from-amber-200 to-yellow-500",
  },
  BBVA: {
    name: "BBVA",
    gradient: "from-blue-700 via-indigo-900 to-zinc-950",
    accentColor: "#004481",
    chipColor: "from-amber-200 to-yellow-500",
  },
  "Mercado Pago": {
    name: "Mercado Pago",
    gradient: "from-sky-500 via-blue-600 to-zinc-950",
    accentColor: "#009ee3",
    chipColor: "from-amber-200 to-yellow-500",
  },
  Otro: {
    name: "Otro Banco",
    gradient: "from-zinc-700 via-zinc-800 to-zinc-950",
    accentColor: "#6366f1",
    chipColor: "from-amber-200 to-yellow-500",
  },
};

export const DEFAULT_USER_CARDS: Record<
  string,
  Array<{
    bank: string;
    brand: "VISA" | "AMEX" | "MASTERCARD";
    colorTheme: string;
    defaultClosingDay: number;
    defaultDueDay: number;
  }>
> = {
  // Augusto
  augusto: [
    { bank: "Santander", brand: "VISA", colorTheme: "Santander", defaultClosingDay: 22, defaultDueDay: 4 },
    { bank: "Santander", brand: "AMEX", colorTheme: "Santander", defaultClosingDay: 22, defaultDueDay: 4 },
    { bank: "Galicia", brand: "VISA", colorTheme: "Galicia", defaultClosingDay: 20, defaultDueDay: 6 },
    { bank: "Galicia", brand: "AMEX", colorTheme: "Galicia", defaultClosingDay: 20, defaultDueDay: 6 },
    { bank: "BBVA", brand: "VISA", colorTheme: "BBVA", defaultClosingDay: 24, defaultDueDay: 8 },
    { bank: "BBVA", brand: "MASTERCARD", colorTheme: "BBVA", defaultClosingDay: 24, defaultDueDay: 8 },
    { bank: "Mercado Pago", brand: "MASTERCARD", colorTheme: "Mercado Pago", defaultClosingDay: 24, defaultDueDay: 6 },
  ],
  // Agustina / Agus
  agus: [
    { bank: "Galicia", brand: "VISA", colorTheme: "Galicia", defaultClosingDay: 20, defaultDueDay: 6 },
    { bank: "Galicia", brand: "AMEX", colorTheme: "Galicia", defaultClosingDay: 20, defaultDueDay: 6 },
    { bank: "BBVA", brand: "VISA", colorTheme: "BBVA", defaultClosingDay: 24, defaultDueDay: 8 },
    { bank: "BBVA", brand: "MASTERCARD", colorTheme: "BBVA", defaultClosingDay: 24, defaultDueDay: 8 },
    { bank: "Mercado Pago", brand: "MASTERCARD", colorTheme: "Mercado Pago", defaultClosingDay: 24, defaultDueDay: 6 },
  ],
};

const BRAND_PRIORITY: Record<string, number> = {
  VISA: 1,
  MASTERCARD: 2,
  AMEX: 3,
};

const verifiedCardsUsers = new Set<string>();
const cardsDataCache = new Map<string, { data: any; timestamp: number }>();
const CARDS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos

export function invalidateCardsCache(userId?: string) {
  if (userId) {
    verifiedCardsUsers.delete(userId);
    cardsDataCache.delete(userId);
  } else {
    verifiedCardsUsers.clear();
    cardsDataCache.clear();
  }
}

export async function ensureDefaultCardsForUser(userId: string, userName: string) {
  if (verifiedCardsUsers.has(userId)) return;

  const existingCards = await prisma.personalCreditCard.findMany({
    where: { userId },
    select: { bank: true, brand: true },
  });

  const normalized = userName.toLowerCase();
  const isAgus = normalized.includes("agus") && !normalized.includes("august");
  const defaults = isAgus ? DEFAULT_USER_CARDS.agus : DEFAULT_USER_CARDS.augusto;

  for (const c of defaults) {
    const alreadyExists = existingCards.some(
      (ex) =>
        ex.bank.toLowerCase() === c.bank.toLowerCase() &&
        ex.brand.toUpperCase() === c.brand.toUpperCase()
    );
    if (!alreadyExists) {
      await prisma.personalCreditCard.create({
        data: {
          userId,
          bank: c.bank,
          brand: c.brand,
          colorTheme: c.colorTheme,
          defaultClosingDay: c.defaultClosingDay,
          defaultDueDay: c.defaultDueDay,
        },
      });
    }
  }

  verifiedCardsUsers.add(userId);
}

export function computeApplicableCardInstallments(
  recurringExpenses: Array<{
    id: string;
    title: string;
    installmentAmount: number;
    totalInstallments: number | null;
    startYear: number;
    startMonth: number;
    isActive: boolean;
  }>,
  targetYear: number,
  targetMonth: number
) {
  const items: Array<{
    id: string;
    title: string;
    installmentAmount: number;
    installmentNumber: number;
    totalInstallments: number | null;
  }> = [];
  let totalAmount = 0;

  for (const rec of recurringExpenses) {
    if (!rec.isActive) continue;
    const monthsElapsed = (targetYear - rec.startYear) * 12 + (targetMonth - rec.startMonth);
    const installmentNumber = monthsElapsed + 1;
    const isApplicable =
      monthsElapsed >= 0 &&
      (!rec.totalInstallments || installmentNumber <= rec.totalInstallments);

    if (isApplicable) {
      items.push({
        id: rec.id,
        title: rec.title,
        installmentAmount: rec.installmentAmount,
        installmentNumber,
        totalInstallments: rec.totalInstallments,
      });
      totalAmount += rec.installmentAmount;
    }
  }

  return { items, totalAmount };
}

export async function getCardsForUserAndMonth(
  userId: string,
  userName: string,
  _year?: number,
  _month?: number
) {
  const nowMs = Date.now();
  const cached = cardsDataCache.get(userId);
  if (cached && nowMs - cached.timestamp < CARDS_CACHE_TTL_MS) {
    return cached.data;
  }

  // Asegurar que existan las tarjetas por defecto (incluyendo Mercado Pago)
  await ensureDefaultCardsForUser(userId, userName);

  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  // Traer tarjetas con su último resumen activo (independiente del mes seleccionado arriba) y sus cuotas asociadas
  const cards = await prisma.personalCreditCard.findMany({
    where: { userId },
    include: {
      periods: {
        orderBy: [
          { year: "desc" },
          { month: "desc" },
        ],
        take: 2,
      },
      recurringExpenses: {
        where: { isActive: true },
      },
    },
    orderBy: [
      { bank: "asc" },
    ],
  });

  const cardsWithMonthData = await Promise.all(
    cards.map(async (c) => {
      // El resumen activo de la tarjeta es siempre el más reciente (periods[0])
      let activePeriod = c.periods[0];

      if (!activePeriod) {
        const closingDay = c.defaultClosingDay || 20;
        const dueDay = c.defaultDueDay || 5;
        const dueMonthOffset = dueDay < closingDay ? 1 : 0;

        const maxCloseDays = new Date(defaultYear, defaultMonth, 0).getDate();
        const validCloseDay = Math.min(closingDay, maxCloseDays);
        const closingDate = new Date(Date.UTC(defaultYear, defaultMonth - 1, validCloseDay, 12, 0, 0));

        const targetDueMonthIndex = (defaultMonth - 1) + dueMonthOffset;
        const targetDueYear = defaultYear + Math.floor(targetDueMonthIndex / 12);
        const targetDueMonth = ((targetDueMonthIndex % 12) + 12) % 12;
        const maxDueDays = new Date(targetDueYear, targetDueMonth + 1, 0).getDate();
        const validDueDay = Math.min(dueDay, maxDueDays);
        const dueDate = new Date(Date.UTC(targetDueYear, targetDueMonth, validDueDay, 12, 0, 0));

        const { items: instItems, totalAmount: instTotal } = computeApplicableCardInstallments(
          c.recurringExpenses || [],
          defaultYear,
          defaultMonth
        );

        activePeriod = await prisma.cardMonthlyPeriod.create({
          data: {
            cardId: c.id,
            year: defaultYear,
            month: defaultMonth,
            closingDate,
            dueDate,
            statementAmount: instTotal,
            statementAmountUsd: 0,
            isPaid: false,
            notes:
              instItems.length > 0
                ? "Cuotas incluidas: " +
                  instItems
                    .map((i) =>
                      i.totalInstallments
                        ? `${i.title} (${i.installmentNumber}/${i.totalInstallments})`
                        : i.title
                    )
                    .join(", ")
                : null,
          },
        });
      }

      const { items: linkedInstallments, totalAmount: linkedInstallmentsTotal } =
        computeApplicableCardInstallments(
          c.recurringExpenses || [],
          activePeriod.year,
          activePeriod.month
        );

      return {
        ...c,
        period: activePeriod,
        linkedInstallments,
        linkedInstallmentsTotal,
      };
    })
  );

  // Ordenar por banco y dentro de cada banco poner siempre VISA primero (principal)
  cardsWithMonthData.sort((a, b) => {
    const bankCmp = a.bank.localeCompare(b.bank, "es");
    if (bankCmp !== 0) return bankCmp;
    const prioA = BRAND_PRIORITY[a.brand.toUpperCase()] ?? 99;
    const prioB = BRAND_PRIORITY[b.brand.toUpperCase()] ?? 99;
    return prioA - prioB;
  });

  let totalStatementArs = 0;
  let totalPaidArs = 0;
  let totalPendingArs = 0;
  let paidCount = 0;
  let pendingCount = 0;

  for (const item of cardsWithMonthData) {
    const amt = item.period.statementAmount || 0;
    totalStatementArs += amt;
    if (item.period.isPaid) {
      totalPaidArs += amt;
      paidCount++;
    } else {
      totalPendingArs += amt;
      pendingCount++;
    }
  }

  const result = {
    cards: cardsWithMonthData,
    summary: {
      totalStatementArs,
      totalPaidArs,
      totalPendingArs,
      paidCount,
      pendingCount,
      totalCards: cardsWithMonthData.length,
    },
  };

  cardsDataCache.set(userId, { data: result, timestamp: Date.now() });
  return result;
}
