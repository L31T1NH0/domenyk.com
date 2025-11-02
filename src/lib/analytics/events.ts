export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "read_progress",
  "read_complete",
  "para_open",
  "comment_submit",
  "search_query",
  "sort_change",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

const DEFAULT_EVENTS: AnalyticsEventName[] = [
  "page_view",
  "read_progress",
  "read_complete",
  "comment_submit",
];

export function parseEnabledEvents(value: string | null | undefined): AnalyticsEventName[] {
  if (!value) {
    return DEFAULT_EVENTS;
  }

  const requested = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as string[];

  const enabled = new Set<AnalyticsEventName>();
  for (const candidate of requested) {
    if (isKnownEvent(candidate)) {
      enabled.add(candidate);
    }
  }

  if (enabled.size === 0) {
    return DEFAULT_EVENTS;
  }

  return Array.from(enabled);
}

export function isKnownEvent(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

export function getDefaultEnabledEvents(): AnalyticsEventName[] {
  return [...DEFAULT_EVENTS];
}
