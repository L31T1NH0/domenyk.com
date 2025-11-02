"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import type { AnalyticsClientConfig } from "@lib/analytics/config";
import type { AnalyticsEventName } from "@lib/analytics/events";

type AnalyticsEventPayload = {
  name: AnalyticsEventName;
  clientTs: number;
  page: {
    path: string;
    search?: string;
    referrer?: string;
    title?: string;
  };
  data?: Record<string, unknown>;
  viewport?: {
    width?: number;
    height?: number;
  };
  flags?: {
    isSampled?: boolean;
  };
};

type TrackEventOptions = {
  immediate?: boolean;
  flags?: {
    isSampled?: boolean;
  };
};

type AnalyticsContextValue = {
  trackEvent: (
    name: AnalyticsEventName,
    data?: Record<string, unknown>,
    options?: TrackEventOptions
  ) => void;
  isTrackingEnabled: boolean;
  isEventEnabled: (name: AnalyticsEventName) => boolean;
  config: AnalyticsClientConfig;
};

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

type AnalyticsProviderProps = {
  children: ReactNode;
  isAdmin: boolean;
  config: AnalyticsClientConfig;
};

type FlushReason = "scheduled" | "visibility" | "immediate";

function shouldRespectDoNotTrack(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorAny = window.navigator as typeof window.navigator & {
    msDoNotTrack?: string | null;
    globalPrivacyControl?: boolean;
  };
  const windowAny = window as typeof window & { doNotTrack?: string | null };

  const dntValue =
    navigatorAny.doNotTrack ??
    windowAny.doNotTrack ??
    navigatorAny.msDoNotTrack ??
    null;

  if (typeof dntValue === "string") {
    const normalized = dntValue.toLowerCase();
    if (normalized === "1" || normalized === "yes") {
      return true;
    }
  }

  if (navigatorAny.globalPrivacyControl === true) {
    return true;
  }

  return false;
}

function isLikelyBotClient(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent ?? "";
  if (!userAgent) {
    return false;
  }

  if (/bot|crawler|spider|crawling|headless|playwright|puppeteer|selenium/i.test(userAgent)) {
    return true;
  }

  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) {
    return true;
  }

  return false;
}

function sanitizeClientData(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value).slice(0, 20);
  for (const [key, raw] of entries) {
    const trimmedKey = key.trim().slice(0, 64);
    if (!trimmedKey || trimmedKey.startsWith("__proto__")) {
      continue;
    }
    const sanitized = sanitizeValue(raw, 0);
    if (sanitized !== undefined) {
      result[trimmedKey] = sanitized;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 2) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.slice(0, 256);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    return Number(value.toFixed(6));
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth > 1) {
      return undefined;
    }
    const output: unknown[] = [];
    for (const item of value.slice(0, 10)) {
      const sanitized = sanitizeValue(item, depth + 1);
      if (sanitized !== undefined) {
        output.push(sanitized);
      }
    }
    return output.length > 0 ? output : undefined;
  }

  if (typeof value === "object" && value) {
    return sanitizeClientData(value as Record<string, unknown>);
  }

  return undefined;
}

function getViewport() {
  if (typeof window === "undefined") {
    return undefined;
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const viewport: { width?: number; height?: number } = {};
  if (Number.isFinite(width) && width > 0) {
    viewport.width = Math.round(width);
  }
  if (Number.isFinite(height) && height > 0) {
    viewport.height = Math.round(height);
  }
  return Object.keys(viewport).length > 0 ? viewport : undefined;
}

export function AnalyticsProvider({ children, isAdmin, config }: AnalyticsProviderProps) {
  const [trackingReady, setTrackingReady] = useState(false);
  const [trackingAllowed, setTrackingAllowed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);

  const enabledEvents = useMemo(() => new Set(config.enabledEvents), [config.enabledEvents]);

  const queueRef = useRef<AnalyticsEventPayload[]>([]);
  const flushTimeoutRef = useRef<number | null>(null);
  const flushInProgressRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (isAdmin) {
      setTrackingAllowed(false);
      setTrackingReady(true);
      return;
    }

    if (shouldRespectDoNotTrack() || isLikelyBotClient()) {
      setTrackingAllowed(false);
      setTrackingReady(true);
      return;
    }

    setTrackingAllowed(true);
    setTrackingReady(true);
  }, [isAdmin]);

  const clearFlushTimeout = useCallback(() => {
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, []);

  const sendBatch = useCallback(
    async (events: AnalyticsEventPayload[], reason: FlushReason) => {
      if (events.length === 0) {
        return;
      }

      const body = JSON.stringify({ events });

      if (reason !== "scheduled" && typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        const sent = navigator.sendBeacon(config.endpoint, blob);
        if (sent) {
          return;
        }
      }

      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        credentials: "same-origin",
        keepalive: reason !== "scheduled",
      });

      if (!response.ok && response.status >= 500) {
        throw new Error("Failed to send analytics batch");
      }
    },
    [config.endpoint]
  );

  const flushQueue = useCallback(
    (reason: FlushReason) => {
      if (!trackingAllowed || queueRef.current.length === 0 || flushInProgressRef.current) {
        return;
      }

      flushInProgressRef.current = true;
      clearFlushTimeout();

      const eventsToSend = queueRef.current.splice(0, config.maxBatchSize);

      void sendBatch(eventsToSend, reason)
        .catch(() => {
          queueRef.current = [...eventsToSend, ...queueRef.current].slice(-config.maxQueueSize);
        })
        .finally(() => {
          flushInProgressRef.current = false;
          if (queueRef.current.length > 0 && flushTimeoutRef.current === null) {
            flushTimeoutRef.current = window.setTimeout(() => {
              flushTimeoutRef.current = null;
              flushQueue("scheduled");
            }, 200);
          }
        });
    },
    [
      trackingAllowed,
      clearFlushTimeout,
      sendBatch,
      config.maxBatchSize,
      config.maxQueueSize,
    ]
  );

  const scheduleFlush = useCallback(
    (delay?: number) => {
      if (!trackingAllowed) {
        return;
      }
      if (flushTimeoutRef.current !== null) {
        return;
      }
      flushTimeoutRef.current = window.setTimeout(() => {
        flushTimeoutRef.current = null;
        flushQueue("scheduled");
      }, typeof delay === "number" ? delay : config.flushIntervalMs);
    },
    [trackingAllowed, config.flushIntervalMs, flushQueue]
  );

  const trackEvent = useCallback<
    AnalyticsContextValue["trackEvent"]
  >(
    (name, data, options) => {
      if (!trackingAllowed || !trackingReady || typeof window === "undefined") {
        return;
      }

      if (!enabledEvents.has(name)) {
        return;
      }

      if (
        name === "read_progress" &&
        config.readProgressSampleRate >= 0 &&
        config.readProgressSampleRate < 1 &&
        Math.random() > config.readProgressSampleRate
      ) {
        return;
      }

      const sanitizedData = sanitizeClientData(data);
      const flags = options?.flags;
      const sanitizedFlags =
        flags && typeof flags.isSampled === "boolean"
          ? { isSampled: flags.isSampled }
          : undefined;

      const path = window.location.pathname.slice(0, 512);
      const search = window.location.search.slice(0, 256);
      const referrer = document.referrer ? document.referrer.slice(0, 512) : undefined;
      const title = document.title ? document.title.slice(0, 256) : undefined;

      const payload: AnalyticsEventPayload = {
        name,
        clientTs: Date.now(),
        page: {
          path,
          ...(search ? { search } : {}),
          ...(referrer ? { referrer } : {}),
          ...(title ? { title } : {}),
        },
        ...(sanitizedData ? { data: sanitizedData } : {}),
        ...(sanitizedFlags ? { flags: sanitizedFlags } : {}),
      };

      const viewport = getViewport();
      if (viewport) {
        payload.viewport = viewport;
      }

      queueRef.current.push(payload);
      if (queueRef.current.length > config.maxQueueSize) {
        queueRef.current.splice(0, queueRef.current.length - config.maxQueueSize);
      }

      if (queueRef.current.length >= config.maxBatchSize || options?.immediate) {
        flushQueue(options?.immediate ? "immediate" : "scheduled");
      } else {
        scheduleFlush();
      }
    },
    [
      trackingAllowed,
      trackingReady,
      enabledEvents,
      config.maxBatchSize,
      config.maxQueueSize,
      config.readProgressSampleRate,
      flushQueue,
      scheduleFlush,
    ]
  );

  useEffect(() => {
    if (!trackingAllowed) {
      return;
    }
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushQueue("visibility");
      }
    };
    const handlePageHide = () => {
      flushQueue("visibility");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [trackingAllowed, flushQueue]);

  useEffect(() => {
    return () => {
      clearFlushTimeout();
      if (queueRef.current.length > 0) {
        flushQueue("visibility");
      }
    };
  }, [clearFlushTimeout, flushQueue]);

  const search = searchParams?.toString() ?? "";
  useEffect(() => {
    if (!trackingAllowed || !trackingReady) {
      return;
    }
    const current = `${pathname}?${search}`;
    if (lastTrackedPath.current === current) {
      return;
    }
    lastTrackedPath.current = current;
    trackEvent("page_view");
  }, [pathname, search, trackingAllowed, trackingReady, trackEvent]);

  const contextValue = useMemo<AnalyticsContextValue>(() => {
    const isEventEnabled = (name: AnalyticsEventName) => enabledEvents.has(name);
    return {
      trackEvent,
      isTrackingEnabled: trackingAllowed && trackingReady,
      isEventEnabled,
      config,
    };
  }, [trackEvent, trackingAllowed, trackingReady, enabledEvents, config]);

  return <AnalyticsContext.Provider value={contextValue}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalytics must be used within AnalyticsProvider");
  }
  return context;
}

export default AnalyticsProvider;
