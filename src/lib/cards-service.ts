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
  ],
  // Agustina / Agus
  agus: [
    { bank: "Galicia", brand: "VISA", colorTheme: "Galicia", defaultClosingDay: 20, defaultDueDay: 6 },
    { bank: "Galicia", brand: "AMEX", colorTheme: "Galicia", defaultClosingDay: 20, defaultDueDay: 6 },
    { bank: "BBVA", brand: "VISA", colorTheme: "BBVA", defaultClosingDay: 24, defaultDueDay: 8 },
    { bank: "BBVA", brand: "MASTERCARD", colorTheme: "BBVA", defaultClosingDay: 24, defaultDueDay: 8 },
  ],
};

const verifiedCardsUsers = new Set<string>();

export function invalidateCardsCache(userId?: string) {
  if (userId) {
    verifiedCardsUsers.delete(userId);
  } else {
    verifiedCardsUsers.clear();
  }
}

export async function ensureDefaultCardsForUser(userId: string, userName: string) {
  if (verifiedCardsUsers.has(userId)) return;

  const existingCount = await prisma.personalCreditCard.count({
    where: { userId },
  });

  if (existingCount > 0) {
    verifiedCardsUsers.add(userId);
    return;
  }

  const normalized = userName.toLowerCase();
  const isAgus = normalized.includes("agus") && !normalized.includes("august");
  const defaults = isAgus ? DEFAULT_USER_CARDS.agus : DEFAULT_USER_CARDS.augusto;

  for (const c of defaults) {
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

export async function getCardsForUserAndMonth(
  userId: string,
  userName: string,
  year: number,
  month: number
) {
  // Asegurar que existan las tarjetas por defecto si es la primera vez
  await ensureDefaultCardsForUser(userId, userName);

  const cards = await prisma.personalCreditCard.findMany({
    where: { userId },
    include: {
      periods: {
        where: { year, month },
      },
    },
    orderBy: [
      { bank: "asc" },
      { brand: "asc" },
    ],
  });

  // Para cada tarjeta, asegurar que tenga el registro del mes
  const cardsWithMonthData = await Promise.all(
    cards.map(async (c) => {
      let period = c.periods[0];
      if (!period) {
        // Calcular fechas estimadas basadas en defaultClosingDay y defaultDueDay
        const closingDay = c.defaultClosingDay || 20;
        const dueDay = c.defaultDueDay || 5;

        // Fecha de cierre tentativa (mismo mes)
        const closingDate = new Date(year, month - 1, closingDay);

        // Fecha de vencimiento tentativa (mes siguiente si dueDay < closingDay)
        const dueMonth = dueDay < closingDay ? (month === 12 ? 0 : month) : month - 1;
        const dueYear = dueDay < closingDay && month === 12 ? year + 1 : year;
        const dueDate = new Date(dueYear, dueMonth, dueDay);

        period = await prisma.cardMonthlyPeriod.create({
          data: {
            cardId: c.id,
            year,
            month,
            closingDate,
            dueDate,
            statementAmount: 0,
            statementAmountUsd: 0,
            isPaid: false,
          },
        });
      }

      return {
        ...c,
        period,
      };
    })
  );

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

  return {
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
}
