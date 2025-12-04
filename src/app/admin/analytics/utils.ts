export type RangeKey = "24h" | "7d" | "30d";

export function parseRange(input: unknown): RangeKey {
  const value = typeof input === "string" ? (input as string).toLowerCase() : "";
  if (value === "24h" || value === "7d" || value === "30d") return value;
  return "7d";
}

export function getFromDate(range: RangeKey): Date {
  const now = new Date();
  const from = new Date(now);
  if (range === "24h") {
    from.setTime(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (range === "30d") {
    from.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    from.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return from;
}
