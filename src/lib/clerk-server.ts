import { createClerkClient, type ClerkClient } from "@clerk/backend";
import { clerkClient as runtimeClerkClient } from "@clerk/nextjs/server";

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
  try {
    return await runtimeClerkClient();
  } catch (error) {
    console.error("Failed to resolve Clerk client from request context. Falling back to secret key.", error);
    return createFallbackClient();
  }
}
