import { Suspense } from "react";
import { getDashboardData } from "./actions";
import { DashboardClient } from "@/components/DashboardClient";
import { AppSplashScreen } from "@/components/AppSplashScreen";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  return (
    <Suspense fallback={<AppSplashScreen message="Sincronizando tus finanzas..." />}>
      <DashboardDataLoader searchParamsPromise={searchParams} />
    </Suspense>
  );
}

async function DashboardDataLoader({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParamsPromise;
  const year = params.year ? parseInt(params.year) : undefined;
  const month = params.month ? parseInt(params.month) : undefined;

  try {
    const data = await getDashboardData(year, month);
    return <DashboardClient initialData={data} />;
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    const fallbackYear = year || new Date().getFullYear();
    const fallbackMonth = month || new Date().getMonth() + 1;
    return (
      <DashboardClient
        initialData={{
          household: { id: "", name: "Finanzas Hogar", currency: "ARS" },
          users: [],
          currentUser: null,
          categories: [],
          period: {
            id: "",
            year: fallbackYear,
            month: fallbackMonth,
            status: "OPEN",
            carriedOverBalance: 0,
            incomes: [],
            expenses: [],
            investmentTransfer: null,
          },
          poolSummary: {
            totalSalaries: 0,
            salaryPool: 0,
            carriedOverBalance: 0,
            totalAvailablePool: 0,
            fciWithdrawnToPool: 0,
            investedInFCI: 0,
            totalExpenses: 0,
            remainingPool: 0,
            burnRatePct: 0,
            memberBalances: [],
          },
          investmentFund: null,
          recurringExpenses: [],
          personalData: null,
          sharedInvestments: [],
          sharedInvestmentsSummary: null,
          currentYear: fallbackYear,
          currentMonth: fallbackMonth,
        }}
      />
    );
  }
}
