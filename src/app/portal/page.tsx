import { redirect } from "next/navigation";
import { portalDestination, resolvePortalAccess } from "@/lib/backend/session-access";

export const metadata = { title: "Account Portal - Summit HVAC Supply" };

/**
 * Routes by ACCESS state, not just role: a signed-in person whose profile is
 * missing, whose application is pending, or whose account is paused lands on
 * /portal/status with an explanation -- never back on the login form.
 */
export default async function PortalPage() {
  const access = await resolvePortalAccess();
  if (access.kind === "signedOut") redirect("/portal/login?next=/portal");
  redirect(portalDestination(access));
}
