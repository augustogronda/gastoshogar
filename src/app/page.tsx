import { DashboardWrapper } from "@/components/DashboardWrapper";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const year = params?.year ? parseInt(params.year) : undefined;
  const month = params?.month ? parseInt(params.month) : undefined;

  return <DashboardWrapper targetYear={year} targetMonth={month} />;
}
