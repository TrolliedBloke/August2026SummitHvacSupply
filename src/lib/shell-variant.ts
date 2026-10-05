export type ShellVariant = "commerce" | "service" | "focused";

const FOCUSED_PREFIXES = ["/account", "/admin", "/checkout", "/portal"];
const SERVICE_PREFIXES = [
  "/about",
  "/contact",
  "/dealers",
  "/delivery",
  "/finder",
  "/guides",
  "/homeowners",
  "/locations",
  "/privacy",
  "/quote",
  "/resources",
  "/returns",
  "/review",
  "/shipping",
  "/terms",
  "/tools",
  "/warranty",
];
const CHAT_SUPPRESSED_PREFIXES = [
  ...FOCUSED_PREFIXES,
  "/contact",
  "/dealers",
  "/homeowners",
  "/quote",
  "/review",
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Route-level shell density without duplicating layout trees. */
export function shellVariantForPathname(pathname: string): ShellVariant {
  if (FOCUSED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return "focused";
  if (SERVICE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return "service";
  return "commerce";
}

export function floatingChatAllowed(pathname: string) {
  return !CHAT_SUPPRESSED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}
