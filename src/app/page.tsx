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

  const data = await getDashboardData(year, month);

  return <DashboardClient initialData={data} />;
}
