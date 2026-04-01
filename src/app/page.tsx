import { DashboardClient } from "@/components/dashboard-client";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;

  return <DashboardClient initialQuery={params.q ?? ""} />;
}
