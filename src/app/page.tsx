import { getDashboardData } from "./actions";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();

  return <DashboardClient initialData={data} />;
}
