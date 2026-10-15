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

export function invalidateCardsCache(userId?: string) {
  if (userId) {
    verifiedCardsUsers.delete(userId);
  } else {
    verifiedCardsUsers.clear();
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

export async function getCardsForUserAndMonth(
  userId: string,
  userName: string,
  year: number,
  month: number
) {
  // Asegurar que existan las tarjetas por defecto (incluyendo nuevas agregadas como Mercado Pago)
  await ensureDefaultCardsForUser(userId, userName);

  const cards = await prisma.personalCreditCard.findMany({
    where: { userId },
    include: {
      periods: {
        where: {
          OR: [
            { year, month },
            { year: { lt: year } },
            { year, month: { lt: month } },
          ],
        },
        orderBy: [
          { year: "desc" },
          { month: "desc" },
        ],
      },
    },
    orderBy: [
      { bank: "asc" },
    ],
  });

  // Para cada tarjeta, asegurar que tenga el registro del mes usando el mes anterior como base
  const cardsWithMonthData = await Promise.all(
    cards.map(async (c) => {
      let currentPeriod = c.periods.find((p) => p.year === year && p.month === month);
      const prevPeriod = c.periods.find(
        (p) => p.year < year || (p.year === year && p.month < month)
      );

      if (!currentPeriod) {
        let closingDay = c.defaultClosingDay || 20;
        let dueDay = c.defaultDueDay || 5;
        let dueMonthOffset = dueDay < closingDay ? 1 : 0;

        if (prevPeriod) {
          if (prevPeriod.closingDate) {
            const prevClose = new Date(prevPeriod.closingDate);
            closingDay = prevClose.getUTCDate();
          }
          if (prevPeriod.dueDate) {
            const prevDue = new Date(prevPeriod.dueDate);
            dueDay = prevDue.getUTCDate();
            if (prevPeriod.closingDate) {
              const prevClose = new Date(prevPeriod.closingDate);
              const diff =
                (prevDue.getUTCFullYear() - prevClose.getUTCFullYear()) * 12 +
                (prevDue.getUTCMonth() - prevClose.getUTCMonth());
              dueMonthOffset = Math.max(0, diff);
            }
          }
        }

        // Fecha de cierre tentativa para este mes
        const maxCloseDays = new Date(year, month, 0).getDate();
        const validCloseDay = Math.min(closingDay, maxCloseDays);
        const closingDate = new Date(Date.UTC(year, month - 1, validCloseDay, 12, 0, 0));

        // Fecha de vencimiento tentativa
        const targetDueMonthIndex = (month - 1) + dueMonthOffset;
        const targetDueYear = year + Math.floor(targetDueMonthIndex / 12);
        const targetDueMonth = (targetDueMonthIndex % 12 + 12) % 12;
        const maxDueDays = new Date(targetDueYear, targetDueMonth + 1, 0).getDate();
        const validDueDay = Math.min(dueDay, maxDueDays);
        const dueDate = new Date(Date.UTC(targetDueYear, targetDueMonth, validDueDay, 12, 0, 0));

        currentPeriod = await prisma.cardMonthlyPeriod.create({
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
        period: currentPeriod,
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
