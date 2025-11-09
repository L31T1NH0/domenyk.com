import assert from "node:assert/strict";
import { test } from "node:test";

import { loadModuleWithMocks } from "./helpers/load-module";

function createRouteMatcher(patterns: string[]) {
  return (req: Request) => {
    const pathname = new URL(req.url).pathname;
    return patterns.some((pattern) => {
      if (pattern.endsWith("(.*)")) {
        const base = pattern.slice(0, -4);
        return pathname.startsWith(base);
      }
      return pathname === pattern;
    });
  };
}

test("middleware allows admin role from Clerk metadata", async () => {
  const authState = {
    userId: "user_123",
    sessionClaims: { publicMetadata: { role: "admin" } },
    redirectToSignIn: () => {
      throw new Error("redirect should not be called");
    },
  };

  const clerkServerStub = `
    export const clerkMiddleware = (handler) => {
      return async (req) => handler(async () => globalThis.__TEST_AUTH_STATE, req);
    };
    export const createRouteMatcher = (patterns) => {
      return (req) => {
        const pathname = new URL(req.url).pathname;
        return patterns.some((pattern) => {
          if (pattern.endsWith("(.*)")) {
            const base = pattern.slice(0, -4);
            return pathname.startsWith(base);
          }
          return pathname === pattern;
        });
      };
    };
  `;

  const nextServerStub = `
    class MockCookies {
      constructor() {
        this.store = new Map();
      }
      get(name) {
        const entry = this.store.get(name);
        if (!entry) {
          return undefined;
        }
        return { name, value: entry.value };
      }
      set(options) {
        this.store.set(options.name, { value: options.value });
      }
    }

    export class NextResponse {
      constructor(status) {
        this.status = status;
        this.headers = new Headers();
        this.cookies = new MockCookies();
      }

      static next() {
        return new NextResponse(200);
      }

      static redirect(url) {
        const response = new NextResponse(307);
        response.headers.set("Location", url instanceof URL ? url.toString() : url);
        return response;
      }
    }
  `;

  const analyticsStub = `
    export const ANALYTICS_SESSION_COOKIE_NAME = "dy.sid";
    export const ANALYTICS_SESSION_MAX_AGE = 3600;
    export const generateSessionId = () => "session-id";
  `;

  (globalThis as typeof globalThis & { __TEST_AUTH_STATE?: typeof authState }).__TEST_AUTH_STATE = authState;

  const module = await loadModuleWithMocks("src/middleware.ts", {
    "@clerk/nextjs/server": clerkServerStub,
    "next/server": nextServerStub,
    "@lib/analytics/session": analyticsStub,
  });

  const middleware = module.default as (req: Request) => Promise<any>;

  const request = {
    url: "https://example.com/admin",
    cookies: {
      get: () => undefined,
    },
  } as { url: string; cookies: { get: (name: string) => undefined } };

  const response = await middleware(request as unknown as Request);
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get("dy.sid")?.value, "session-id");

  delete (globalThis as typeof globalThis & { __TEST_AUTH_STATE?: typeof authState }).__TEST_AUTH_STATE;
});
