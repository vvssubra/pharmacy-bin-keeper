export function quotaStatus(
  remaining: number | null,
  total: number | null,
): "critical" | "warning" | "healthy" | "no-quota" {
  if (total === null || remaining === null) return "no-quota";
  if (total === 0) return "critical";
  const pct = remaining / total;
  if (pct <= 0.1) return "critical";
  if (pct <= 0.25) return "warning";
  return "healthy";
}

export function forecastStatus(days: number | null): "critical" | "warning" | "healthy" | "no-data" {
  if (days === null) return "no-data";
  if (days < 7) return "critical";
  if (days < 14) return "warning";
  return "healthy";
}

export function daysRemaining(stock: number, avgDaily: number): number | null {
  if (avgDaily === 0) return null;
  return Math.floor(stock / avgDaily);
}

export function projectedExhaustion(remaining: number, avgPerMonth: number): string {
  if (remaining <= 0) return "Exhausted";
  if (avgPerMonth === 0) return "No usage data";
  const monthsLeft = remaining / avgPerMonth;
  const date = new Date();
  date.setDate(date.getDate() + Math.ceil(monthsLeft * 30));
  return date.toLocaleDateString("en-MY", { month: "short", year: "numeric" });
}
