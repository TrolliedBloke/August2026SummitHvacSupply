import { Container } from "@/components/ui";
import { PortalDashboard } from "@/components/portal-dashboard";
import { requireUser } from "@/lib/backend/auth";
import { getPortalOverview } from "@/lib/backend/services";
import { redirect } from "next/navigation";
import { InstallerReferrals } from "@/components/installer-referrals";

export const metadata = {
  title: "Dealer Portal - Summit HVAC Supply",
};

export default async function DealerPortalPage({ searchParams }: { searchParams: Promise<{ referralNotice?: string }> }) {
  const profile = await requireUser("/portal/dealer");
  if (profile.role !== "dealer") redirect(profile.role === "staff" ? "/admin" : "/portal");
  const overview = await getPortalOverview(profile);
  const params = await searchParams;
  return (
    <Container className="py-10 lg:py-14">
      <PortalDashboard overview={overview} />
      <InstallerReferrals accountId={profile.accountId} notice={params.referralNotice} />
    </Container>
  );
}
