export interface CardShoppingAdvice {
  cardId: string;
  bank: string;
  brand: string;
  lastDigits?: string | null;
  colorTheme?: string | null;
  daysUntilPayment: number;
  effectiveDueDate: Date;
  effectiveDueDateStr: string;
  effectiveClosingDate: Date;
  status: "CLOSED_RECENTLY" | "CLOSING_LATER" | "CLOSING_SOON";
  daysSinceClose?: number;
  daysUntilClose?: number;
  recommendationReason: string;
  isBest: boolean;
  isWorst: boolean;
}

export interface ShoppingStrategySummary {
  bestCard: CardShoppingAdvice | null;
  worstCard: CardShoppingAdvice | null;
  ranking: CardShoppingAdvice[];
}

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function parseDateAtNoon(dateVal: Date | string | null | undefined): Date | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}

function formatDateLong(date: Date): string {
  const day = date.getUTCDate();
  const month = MONTH_NAMES_ES[date.getUTCMonth()];
  return `${day} de ${month}`;
}

export function computeCardShoppingStrategy(cards: Array<{
  id: string;
  bank: string;
  brand: string;
  lastDigits?: string | null;
  colorTheme?: string | null;
  defaultClosingDay?: number | null;
  defaultDueDay?: number | null;
  period?: {
    closingDate?: Date | string | null;
    dueDate?: Date | string | null;
  } | null;
}>): ShoppingStrategySummary {
  if (!cards || cards.length === 0) {
    return { bestCard: null, worstCard: null, ranking: [] };
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));

  const adviceList: CardShoppingAdvice[] = cards.map((card) => {
    let closingDate = parseDateAtNoon(card.period?.closingDate);
    let dueDate = parseDateAtNoon(card.period?.dueDate);

    // Fallbacks si falta alguna fecha configurada
    if (!closingDate) {
      const closeDay = card.defaultClosingDay || 20;
      closingDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), closeDay, 12, 0, 0));
    }
    if (!dueDate) {
      const dueDay = card.defaultDueDay || 5;
      const dueMonth = dueDay < (card.defaultClosingDay || 20) ? now.getMonth() + 1 : now.getMonth();
      dueDate = new Date(Date.UTC(now.getFullYear(), dueMonth, dueDay, 12, 0, 0));
    }

    let effectiveCloseDate = closingDate;
    let effectiveDueDate = dueDate;
    let status: "CLOSED_RECENTLY" | "CLOSING_LATER" | "CLOSING_SOON" = "CLOSING_LATER";
    let daysSinceClose: number | undefined;
    let daysUntilClose: number | undefined;

    if (today.getTime() > closingDate.getTime()) {
      // Ya cerró: la compra de hoy entra en el resumen del próximo mes (máxima financiación)
      status = "CLOSED_RECENTLY";
      daysSinceClose = Math.round((today.getTime() - closingDate.getTime()) / (1000 * 60 * 60 * 24));

      effectiveCloseDate = new Date(
        Date.UTC(closingDate.getUTCFullYear(), closingDate.getUTCMonth() + 1, closingDate.getUTCDate(), 12, 0, 0)
      );
      effectiveDueDate = new Date(
        Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, dueDate.getUTCDate(), 12, 0, 0)
      );
    } else {
      // Aún no cerró: la compra entra en el resumen de este período
      daysUntilClose = Math.max(0, Math.round((closingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysUntilClose <= 3) {
        status = "CLOSING_SOON";
      } else {
        status = "CLOSING_LATER";
      }
    }

    const daysUntilPayment = Math.max(
      1,
      Math.round((effectiveDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    );

    const effectiveDueDateStr = formatDateLong(effectiveDueDate);

    let recommendationReason = "";
    if (status === "CLOSED_RECENTLY") {
      recommendationReason = `Cerró hace ${daysSinceClose === 0 ? "hoy" : `${daysSinceClose} día${daysSinceClose === 1 ? "" : "s"}`}. Entra en el próximo resumen y la pagás recién el ${effectiveDueDateStr}.`;
    } else if (status === "CLOSING_SOON") {
      recommendationReason = `Cierra en ${daysUntilClose === 0 ? "hoy" : `${daysUntilClose} día${daysUntilClose === 1 ? "" : "s"}`}. Si comprás hoy, entra en este resumen y vence pronto el ${effectiveDueDateStr}.`;
    } else {
      recommendationReason = `Cierra en ${daysUntilClose} días. Si comprás hoy, la pagás el ${effectiveDueDateStr}.`;
    }

    return {
      cardId: card.id,
      bank: card.bank,
      brand: card.brand,
      lastDigits: card.lastDigits,
      colorTheme: card.colorTheme,
      daysUntilPayment,
      effectiveDueDate,
      effectiveDueDateStr,
      effectiveClosingDate: effectiveCloseDate,
      status,
      daysSinceClose,
      daysUntilClose,
      recommendationReason,
      isBest: false,
      isWorst: false,
    };
  });

  // Ordenar de mayor a menor plazo de pago (los mejores primero)
  adviceList.sort((a, b) => b.daysUntilPayment - a.daysUntilPayment);

  if (adviceList.length > 0) {
    adviceList[0].isBest = true;
    if (adviceList.length > 1) {
      adviceList[adviceList.length - 1].isWorst = true;
    }
  }

  return {
    bestCard: adviceList[0] || null,
    worstCard: adviceList.length > 1 ? adviceList[adviceList.length - 1] : null,
    ranking: adviceList,
  };
}
