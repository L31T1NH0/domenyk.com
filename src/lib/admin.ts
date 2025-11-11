import { auth, currentUser } from "@clerk/nextjs/server";
import type { User } from "@clerk/backend";

import { getClerkServerClient } from "./clerk-server";

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

type SessionClaimsLike = Record<string, unknown> | null | undefined;

function hasAdminRole(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  const role = (metadata as Record<string, unknown>).role;
  return role === "admin";
}

export function claimsContainAdmin(sessionClaims: SessionClaimsLike): boolean {
  if (!sessionClaims) {
    return false;
  }
  return (
    hasAdminRole((sessionClaims as any).metadata) ||
    hasAdminRole((sessionClaims as any).publicMetadata) ||
    hasAdminRole((sessionClaims as any).privateMetadata)
  );
}

export function userContainsAdminRole(user: Pick<User, "publicMetadata" | "privateMetadata" | "unsafeMetadata"> | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return (
    hasAdminRole(user.publicMetadata) ||
    hasAdminRole(user.privateMetadata) ||
    hasAdminRole(user.unsafeMetadata)
  );
}

export type AdminResolution = {
  isAdmin: boolean;
  userId: string | null;
};

type AdminResolutionOptions = {
  sessionClaims?: SessionClaimsLike;
  userId?: string | null | undefined;
};

export async function resolveAdminStatus(
  options: AdminResolutionOptions = {}
): Promise<AdminResolution> {
  if (isStaticGenerationEnvironment()) {
    return { isAdmin: false, userId: null };
  }

  if (options.sessionClaims === null && !options.userId) {
    return { isAdmin: false, userId: null };
  }

  let providedSessionClaims = options.sessionClaims;
  let providedUserId = options.userId ?? null;

  if (typeof providedSessionClaims === "undefined") {
    try {
      const { sessionClaims, userId } = await auth();
      providedSessionClaims = sessionClaims;
      if (!providedUserId && userId) {
        providedUserId = userId;
      }
    } catch (error) {
      if (!isDynamicServerUsageError(error)) {
        throw error;
      }
    }
  }

  if (claimsContainAdmin(providedSessionClaims)) {
    return { isAdmin: true, userId: providedUserId ?? null };
  }

  let user = null;
  try {
    user = await currentUser();
    if (user && userContainsAdminRole(user)) {
      return { isAdmin: true, userId: user.id ?? providedUserId ?? null };
    }
  } catch (error) {
    if (!isDynamicServerUsageError(error)) {
      // ignore and try fallback
    }
  }

  const finalUserId = user?.id ?? providedUserId;

  if (finalUserId) {
    try {
      const client = await getClerkServerClient();
      const fallbackUser = await client.users.getUser(finalUserId);
      if (userContainsAdminRole(fallbackUser)) {
        return { isAdmin: true, userId: finalUserId };
      }
    } catch (error) {
      // ignore, final fallback below
    }
  }

  return { isAdmin: false, userId: finalUserId ?? null };
}

export async function assertAdminAccess(): Promise<void> {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    throw new Error("FORBIDDEN_ADMIN_ONLY");
  }
}
