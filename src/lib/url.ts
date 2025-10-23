export type SortKey = "date" | "views" | undefined;
export type OrderKey = "asc" | "desc" | undefined;

export type UrlState = {
  page?: number;
  query?: string;
  sort?: SortKey;
  order?: OrderKey;
};

export function buildQueryString(
  current: URLSearchParams | Record<string, string | string[] | undefined>,
  updates: UrlState,
  opts?: { resetPage?: boolean }
): string {
  const sp = current instanceof URLSearchParams
    ? new URLSearchParams(current)
    : new URLSearchParams(
        Object.entries(current).flatMap(([k, v]) =>
          Array.isArray(v) ? v.map((vv) => [k, vv]) : v != null ? [[k, String(v)]] : []
        ) as [string, string][]
      );

  if (typeof updates.query !== "undefined") sp.set("query", updates.query ?? "");
  if (typeof updates.sort !== "undefined") {
    if (updates.sort) sp.set("sort", updates.sort); else sp.delete("sort");
  }
  if (typeof updates.order !== "undefined") {
    if (updates.order) sp.set("order", updates.order); else sp.delete("order");
  }

  if (opts?.resetPage) {
    sp.set("page", "1");
  } else if (typeof updates.page !== "undefined") {
    sp.set("page", String(updates.page ?? 1));
  }

  // Clean empty query
  if (!sp.get("query")) sp.delete("query");

  return sp.toString();
}

export function buildUrl(
  pathname: string,
  current: URLSearchParams | Record<string, string | string[] | undefined>,
  updates: UrlState,
  opts?: { resetPage?: boolean }
): string {
  const qs = buildQueryString(current, updates, opts);
  return qs ? `${pathname}?${qs}` : pathname;
}
