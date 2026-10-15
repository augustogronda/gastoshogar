/**
 * Motor de Cálculo para Finanzas de Pareja
 * Fondo Común Proporcional (60%) y Remanente para FCI
 */

export interface MemberContribution {
  userId: string;
  name: string;
  salary: number;
  contributionPct: number; // Ej. 0.60
  committedAmount: number; // salary * contributionPct
  outOfPocketPaid: number; // Lo que pagó con su tarjeta/efectivo
}

export interface PoolSummary {
  totalSalaries: number;
  totalCommittedPool: number; // 60% de ambos
  totalExpenses: number;
  remainingPool: number; // totalCommittedPool - totalExpenses (Remanente para FCI)
  burnRatePct: number; // (totalExpenses / totalCommittedPool) * 100
  memberBalances: Array<{
    userId: string;
    name: string;
    committedAmount: number;
    outOfPocketPaid: number;
    netBalance: number; // outOfPocketPaid - committedAmount (positivo = pagó de más, negativo = debe)
    fciQuotaSharePct: number; // % que le corresponde del FCI generado
  }>;
  settlementSuggestion: {
    fromUserId?: string;
    fromUserName?: string;
    toUserId?: string;
    toUserName?: string;
    amount: number;
    explanation: string;
  };
}

export function calculateMonthlyPool(
  members: Array<{
    userId: string;
    name: string;
    salary: number;
    contributionPct?: number;
    outOfPocketPaid: number;
  }>,
  poolExpensesPaidFromCommonFund: number = 0
): PoolSummary {
  const memberContributions: MemberContribution[] = members.map((m) => {
    const pct = m.contributionPct ?? 0.60;
    return {
      userId: m.userId,
      name: m.name,
      salary: m.salary,
      contributionPct: pct,
      committedAmount: m.salary * pct,
      outOfPocketPaid: m.outOfPocketPaid,
    };
  });

  const totalSalaries = memberContributions.reduce((acc, m) => acc + m.salary, 0);
  const totalCommittedPool = memberContributions.reduce((acc, m) => acc + m.committedAmount, 0);
  
  const totalOutOfPocket = memberContributions.reduce((acc, m) => acc + m.outOfPocketPaid, 0);
  const totalExpenses = totalOutOfPocket + poolExpensesPaidFromCommonFund;

  const remainingPool = Math.max(0, totalCommittedPool - totalExpenses);
  const burnRatePct = totalCommittedPool > 0 ? (totalExpenses / totalCommittedPool) * 100 : 0;

  // Calculamos balances individuales
  const memberBalances = memberContributions.map((m) => {
    const netBalance = m.outOfPocketPaid - m.committedAmount;
    const fciQuotaSharePct =
      totalCommittedPool > 0 ? (m.committedAmount / totalCommittedPool) * 100 : 50;

    return {
      userId: m.userId,
      name: m.name,
      committedAmount: m.committedAmount,
      outOfPocketPaid: m.outOfPocketPaid,
      netBalance,
      fciQuotaSharePct,
    };
  });

  // Cálculo de compensación si son 2 personas
  let settlementSuggestion: PoolSummary["settlementSuggestion"] = {
    amount: 0,
    explanation: "Las cuentas están niveladas.",
  };

  if (memberBalances.length === 2) {
    const [userA, userB] = memberBalances;

    // Si los gastos no superan el fondo, cada uno aporta proporcional al gasto real
    // Proporción de gasto real que le toca a cada uno:
    const shareA = totalCommittedPool > 0 ? userA.committedAmount / totalCommittedPool : 0.5;
    const shareB = totalCommittedPool > 0 ? userB.committedAmount / totalCommittedPool : 0.5;

    const shouldHavePaidA = totalExpenses * shareA;
    const shouldHavePaidB = totalExpenses * shareB;

    const diffA = userA.outOfPocketPaid - shouldHavePaidA;

    if (diffA > 1) {
      // A pagó más de su cuota real del gasto
      settlementSuggestion = {
        fromUserId: userB.userId,
        fromUserName: userB.name,
        toUserId: userA.userId,
        toUserName: userA.name,
        amount: Math.round(diffA),
        explanation: `${userB.name} le transfiere $${Math.round(diffA).toLocaleString("es-AR")} a ${userA.name} para nivelar los gastos del mes al 60% proporcional.`,
      };
    } else if (diffA < -1) {
      // B pagó más de su cuota real del gasto
      const diffB = Math.abs(diffA);
      settlementSuggestion = {
        fromUserId: userA.userId,
        fromUserName: userA.name,
        toUserId: userB.userId,
        toUserName: userB.name,
        amount: Math.round(diffB),
        explanation: `${userA.name} le transfiere $${Math.round(diffB).toLocaleString("es-AR")} a ${userB.name} para nivelar los gastos del mes al 60% proporcional.`,
      };
    }
  }

  return {
    totalSalaries,
    totalCommittedPool,
    totalExpenses,
    remainingPool,
    burnRatePct,
    memberBalances,
    settlementSuggestion,
  };
}
