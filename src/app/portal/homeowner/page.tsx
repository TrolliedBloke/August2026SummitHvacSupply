import { Container } from "@/components/ui";
import { PortalDashboard } from "@/components/portal-dashboard";
import { requireUser } from "@/lib/backend/auth";
import { getPortalOverview } from "@/lib/backend/services";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Homeowner Referral Portal - Summit HVAC Supply",
};

export default async function HomeownerPortalPage() {
  const profile = await requireUser("/portal/homeowner");
  if (profile.role !== "homeowner") redirect(profile.role === "staff" ? "/admin" : "/portal");
  const overview = await getPortalOverview(profile);
  return (
    <Container className="py-10 lg:py-14">
      <PortalDashboard overview={overview} />
    </Container>
  );
}
