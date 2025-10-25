import { createClerkClient, type ClerkClient } from "@clerk/backend";
import { clerkClient as runtimeClerkClient } from "@clerk/nextjs/server";

function isStaticGenerationEnvironment(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function isDynamicServerUsageError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in (error as Record<string, unknown>) &&
    (error as Record<string, unknown>).digest === "DYNAMIC_SERVER_USAGE"
  );
}

let fallbackClient: ClerkClient | null = null;

async function createFallbackClient(): Promise<ClerkClient> {
  if (fallbackClient) {
    return fallbackClient;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;

  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is not configured and Clerk client is unavailable.");
  }

  fallbackClient = createClerkClient({
    secretKey,
    publishableKey,
  });

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "Using fallback Clerk client. Ensure middleware is configured so clerkClient() can access request data."
    );
  }

  return fallbackClient;
}

export async function getClerkServerClient(): Promise<ClerkClient> {
  if (isStaticGenerationEnvironment()) {
    return createFallbackClient();
  }

  try {
    return await runtimeClerkClient();
  } catch (error) {
    if (!isDynamicServerUsageError(error)) {
      console.error("Failed to resolve Clerk client from request context. Falling back to secret key.", error);
    }
    return createFallbackClient();
  }
}
