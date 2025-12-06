import assert from "node:assert/strict";
import React, { ReactNode } from "react";
import { test } from "node:test";

import { loadModuleWithMocks } from "./helpers/load-module";

const clerkServerStub = `
  export const auth = async () => globalThis.__TEST_AUTH_STATE;
`;

const adminStub = `
  export const resolveAdminStatus = async (...args) => globalThis.__TEST_RESOLVE_ADMIN(...args);
`;

const analyticsProviderStub = `
  export default function AnalyticsProvider({ children, isAdmin, isAuthenticated, analyticsEnabled }) {
    globalThis.__TEST_ANALYTICS_IS_ADMIN = isAdmin;
    globalThis.__TEST_ANALYTICS_IS_AUTHENTICATED = isAuthenticated;
    globalThis.__TEST_ANALYTICS_ENABLED = analyticsEnabled;
    return children;
  }
`;

const clerkStub = `
  export const ClerkProvider = ({ children }) => children;
`;

const analyticsConfigStub = `
  export const getAnalyticsClientConfig = () => ({
    endpoint: "/",
    enabledEvents: [],
    flushIntervalMs: 0,
    maxBatchSize: 0,
    maxQueueSize: 0,
  });
  export const getAnalyticsEnabled = async () => globalThis.__TEST_ANALYTICS_ENABLED_VALUE ?? true;
`;

const analyticsComponentStub = `
  export const Analytics = () => null;
`;

const speedInsightsStub = `
  export const SpeedInsights = () => null;
`;

void test("RootLayout skips admin resolution for anonymous users", async () => {
  let resolveCalls = 0;

  (globalThis as typeof globalThis & {
    __TEST_AUTH_STATE?: unknown;
    __TEST_RESOLVE_ADMIN?: (...args: unknown[]) => Promise<{ isAdmin: boolean; userId: string | null }>;
    __TEST_ANALYTICS_IS_ADMIN?: boolean;
    __TEST_ANALYTICS_IS_AUTHENTICATED?: boolean;
    __TEST_ANALYTICS_ENABLED?: boolean;
    __TEST_ANALYTICS_ENABLED_VALUE?: boolean;
  }).__TEST_AUTH_STATE = { userId: null, sessionClaims: null };

  (globalThis as typeof globalThis & { __TEST_RESOLVE_ADMIN?: (...args: unknown[]) => Promise<{ isAdmin: boolean; userId: string | null }> }).__TEST_RESOLVE_ADMIN = async () => {
    resolveCalls += 1;
    return { isAdmin: true, userId: null };
  };

  const module = await loadModuleWithMocks("src/app/layout.tsx", {
    "@clerk/nextjs/server": clerkServerStub,
    "@lib/admin": adminStub,
    "@components/analytics/AnalyticsProvider": analyticsProviderStub,
    "@clerk/nextjs": clerkStub,
    "@lib/analytics/config": analyticsConfigStub,
    "@vercel/analytics/react": analyticsComponentStub,
    "@vercel/speed-insights/next": speedInsightsStub,
  });

  const RootLayout = module.default as ({ children }: { children: ReactNode }) => Promise<React.ReactNode>;

  await RootLayout({ children: <div /> });

  assert.equal(resolveCalls, 0);
  assert.equal((globalThis as typeof globalThis & { __TEST_ANALYTICS_IS_ADMIN?: boolean }).__TEST_ANALYTICS_IS_ADMIN, false);
  assert.equal(
    (globalThis as typeof globalThis & { __TEST_ANALYTICS_IS_AUTHENTICATED?: boolean }).__TEST_ANALYTICS_IS_AUTHENTICATED,
    false,
  );
  assert.equal((globalThis as typeof globalThis & { __TEST_ANALYTICS_ENABLED?: boolean }).__TEST_ANALYTICS_ENABLED, true);

  delete (globalThis as typeof globalThis & {
    __TEST_AUTH_STATE?: unknown;
    __TEST_RESOLVE_ADMIN?: (...args: unknown[]) => Promise<{ isAdmin: boolean; userId: string | null }>;
    __TEST_ANALYTICS_IS_ADMIN?: boolean;
    __TEST_ANALYTICS_IS_AUTHENTICATED?: boolean;
    __TEST_ANALYTICS_ENABLED?: boolean;
    __TEST_ANALYTICS_ENABLED_VALUE?: boolean;
  }).__TEST_AUTH_STATE;
  delete (globalThis as typeof globalThis & { __TEST_RESOLVE_ADMIN?: (...args: unknown[]) => Promise<{ isAdmin: boolean; userId: string | null }> }).__TEST_RESOLVE_ADMIN;
  delete (globalThis as typeof globalThis & { __TEST_ANALYTICS_IS_ADMIN?: boolean }).__TEST_ANALYTICS_IS_ADMIN;
  delete (globalThis as typeof globalThis & { __TEST_ANALYTICS_IS_AUTHENTICATED?: boolean }).__TEST_ANALYTICS_IS_AUTHENTICATED;
  delete (globalThis as typeof globalThis & { __TEST_ANALYTICS_ENABLED?: boolean }).__TEST_ANALYTICS_ENABLED;
  delete (globalThis as typeof globalThis & { __TEST_ANALYTICS_ENABLED_VALUE?: boolean }).__TEST_ANALYTICS_ENABLED_VALUE;
});

void test("RootLayout forwards admin flag when user is signed in", async () => {
  let resolveCalls = 0;
  let receivedOptions: unknown;

  (globalThis as typeof globalThis & {
    __TEST_AUTH_STATE?: unknown;
    __TEST_RESOLVE_ADMIN?: (...args: unknown[]) => Promise<{ isAdmin: boolean; userId: string | null }>;
    __TEST_ANALYTICS_IS_ADMIN?: boolean;
    __TEST_ANALYTICS_IS_AUTHENTICATED?: boolean;
    __TEST_ANALYTICS_ENABLED?: boolean;
    __TEST_ANALYTICS_ENABLED_VALUE?: boolean;
  }).__TEST_AUTH_STATE = {
    userId: "user_123",
    sessionClaims: { publicMetadata: { role: "admin" } },
  };

  (globalThis as typeof globalThis & { __TEST_RESOLVE_ADMIN?: (...args: unknown[]) => Promise<{ isAdmin: boolean; userId: string | null }> }).__TEST_RESOLVE_ADMIN = async (options: unknown) => {
    resolveCalls += 1;
    receivedOptions = options;
    return { isAdmin: true, userId: "user_123" };
  };

  const module = await loadModuleWithMocks("src/app/layout.tsx", {
    "@clerk/nextjs/server": clerkServerStub,
    "@lib/admin": adminStub,
    "@components/analytics/AnalyticsProvider": analyticsProviderStub,
    "@clerk/nextjs": clerkStub,
    "@lib/analytics/config": analyticsConfigStub,
    "@vercel/analytics/react": analyticsComponentStub,
    "@vercel/speed-insights/next": speedInsightsStub,
  });

  const RootLayout = module.default as ({ children }: { children: ReactNode }) => Promise<React.ReactNode>;

  await RootLayout({ children: <div /> });

  assert.equal(resolveCalls, 1);
  assert.deepEqual(receivedOptions, {
    sessionClaims: { publicMetadata: { role: "admin" } },
    userId: "user_123",
  });
  assert.equal((globalThis as typeof globalThis & { __TEST_ANALYTICS_IS_ADMIN?: boolean }).__TEST_ANALYTICS_IS_ADMIN, true);
  assert.equal(
    (globalThis as typeof globalThis & { __TEST_ANALYTICS_IS_AUTHENTICATED?: boolean }).__TEST_ANALYTICS_IS_AUTHENTICATED,
    true,
  );
  assert.equal((globalThis as typeof globalThis & { __TEST_ANALYTICS_ENABLED?: boolean }).__TEST_ANALYTICS_ENABLED, true);

  delete (globalThis as typeof globalThis & {
    __TEST_AUTH_STATE?: unknown;
    __TEST_RESOLVE_ADMIN?: (...args: unknown[]) => Promise<{ isAdmin: boolean; userId: string | null }>;
    __TEST_ANALYTICS_IS_ADMIN?: boolean;
    __TEST_ANALYTICS_IS_AUTHENTICATED?: boolean;
    __TEST_ANALYTICS_ENABLED?: boolean;
    __TEST_ANALYTICS_ENABLED_VALUE?: boolean;
  }).__TEST_AUTH_STATE;
  delete (globalThis as typeof globalThis & { __TEST_RESOLVE_ADMIN?: (...args: unknown[]) => Promise<{ isAdmin: boolean; userId: string | null }> }).__TEST_RESOLVE_ADMIN;
  delete (globalThis as typeof globalThis & { __TEST_ANALYTICS_IS_ADMIN?: boolean }).__TEST_ANALYTICS_IS_ADMIN;
  delete (globalThis as typeof globalThis & { __TEST_ANALYTICS_IS_AUTHENTICATED?: boolean }).__TEST_ANALYTICS_IS_AUTHENTICATED;
  delete (globalThis as typeof globalThis & { __TEST_ANALYTICS_ENABLED?: boolean }).__TEST_ANALYTICS_ENABLED;
  delete (globalThis as typeof globalThis & { __TEST_ANALYTICS_ENABLED_VALUE?: boolean }).__TEST_ANALYTICS_ENABLED_VALUE;
});
