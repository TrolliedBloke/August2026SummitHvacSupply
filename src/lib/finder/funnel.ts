export const FINDER_FUNNEL = [
  ["finder_started", "Started"],
  ["finder_completed", "Completed"],
  ["finder_results_viewed", "Viewed results"],
  ["finder_shortlist_emailed", "Emailed shortlist"],
  ["finder_marketing_optin", "Marketing opt-in"],
  ["finder_installer_requested", "Requested installer"],
] as const;

export function finderFunnel(counts: Array<{ name: string; count: number }>) {
  const count = (name: string) => counts.find((row) => row.name === name)?.count ?? 0;
  const rate = (numerator: number, denominator: number) => denominator > 0 ? `${(100 * numerator / denominator).toFixed(1)}%` : "—";
  return {
    stages: FINDER_FUNNEL.map(([name, label]) => ({ name, label, count: count(name) })),
    completionRate: rate(count("finder_completed"), count("finder_started")),
    optInRate: rate(count("finder_marketing_optin"), count("finder_completed")),
  };
}
