/**
 * Motor de Cálculo para Finanzas de Pareja
 * Fondo Común Proporcional (60%) + Saldo Arrastrado + FCI + Cierre Mensual
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
  salaryPool: number; // 60% de ambos sueldos
  carriedOverBalance: number; // Saldo no invertido arrastrado del mes anterior
  totalAvailablePool: number; // salaryPool + carriedOverBalance
  totalExpenses: number;
  investedInFCI: number; // Monto que ya fue transferido/marcado como invertido al FCI
  remainingPool: number; // Saldo disponible libre del mes (totalAvailablePool - totalExpenses - investedInFCI)
  burnRatePct: number; // % del fondo consumido por gastos + inversiones
  memberBalances: Array<{
    userId: string;
    name: string;
    committedAmount: number;
    outOfPocketPaid: number;
    netBalance: number; // outOfPocketPaid - committedAmount
    fciQuotaSharePct: number; // % que le corresponde de ahorros/FCI
  }>;
}

export function calculateMonthlyPool(
  members: Array<{
    userId: string;
    name: string;
    salary: number;
    contributionPct?: number;
    outOfPocketPaid: number;
  }>,
  poolExpensesPaidFromCommonFund: number = 0,
  carriedOverBalance: number = 0,
  investedInFCI: number = 0
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
  const salaryPool = memberContributions.reduce((acc, m) => acc + m.committedAmount, 0);
  
  // Fondo disponible total = 60% de este mes + saldo a favor no invertido del mes anterior
  const totalAvailablePool = salaryPool + Math.max(0, carriedOverBalance);

  const totalOutOfPocket = memberContributions.reduce((acc, m) => acc + m.outOfPocketPaid, 0);
  const totalExpenses = totalOutOfPocket + poolExpensesPaidFromCommonFund;

  // Si ya se invirtió en FCI, ese dinero ya NO está como saldo disponible del mes
  const remainingPool = Math.max(0, totalAvailablePool - totalExpenses - investedInFCI);

  // Tasa de uso del fondo (gastos + lo ya invertido)
  const totalCommittedOrSpent = totalExpenses + investedInFCI;
  const burnRatePct = totalAvailablePool > 0 ? (totalCommittedOrSpent / totalAvailablePool) * 100 : 0;

  // Calculamos balances individuales
  const memberBalances = memberContributions.map((m) => {
    const netBalance = m.outOfPocketPaid - m.committedAmount;
    const fciQuotaSharePct =
      salaryPool > 0 ? (m.committedAmount / salaryPool) * 100 : 50;

    return {
      userId: m.userId,
      name: m.name,
      committedAmount: m.committedAmount,
      outOfPocketPaid: m.outOfPocketPaid,
      netBalance,
      fciQuotaSharePct,
    };
  });

  return {
    totalSalaries,
    salaryPool,
    carriedOverBalance,
    totalAvailablePool,
    totalExpenses,
    investedInFCI,
    remainingPool,
    burnRatePct,
    memberBalances,
  };
}
