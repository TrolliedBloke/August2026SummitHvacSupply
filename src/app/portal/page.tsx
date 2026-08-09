import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/backend/auth";

export const metadata = { title: "Account Portal - Summit HVAC Supply" };

export default async function PortalPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/portal/login?next=/portal");
  if (profile.role === "staff") redirect("/admin");
  if (profile.role === "dealer") redirect("/portal/dealer");
  if (profile.role === "installer") redirect("/portal/installer");
  redirect("/portal/homeowner");
}
