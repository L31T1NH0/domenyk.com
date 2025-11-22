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

export type UserRole = "admin" | "moderator" | null;

function extractRole(metadata: unknown): UserRole {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const role = (metadata as Record<string, unknown>).role;
  if (role === "admin") return "admin";
  if (role === "moderator") return "moderator";
  return null;
}

export function claimsContainAdmin(sessionClaims: SessionClaimsLike): boolean {
  return getRoleFromSessionClaims(sessionClaims) === "admin";
}

export function getRoleFromSessionClaims(sessionClaims: SessionClaimsLike): UserRole {
  if (!sessionClaims) {
    return null;
  }
  return (
    extractRole((sessionClaims as any).metadata) ||
    extractRole((sessionClaims as any).publicMetadata) ||
    extractRole((sessionClaims as any).privateMetadata)
  );
}

export function userContainsAdminRole(user: Pick<User, "publicMetadata" | "privateMetadata" | "unsafeMetadata"> | null | undefined): boolean {
  return getRoleFromUser(user) === "admin";
}

export function getRoleFromUser(
  user: Pick<User, "publicMetadata" | "privateMetadata" | "unsafeMetadata"> | null | undefined
): UserRole {
  if (!user) {
    return null;
  }
  return (
    extractRole(user.publicMetadata) ||
    extractRole(user.privateMetadata) ||
    extractRole(user.unsafeMetadata)
  );
}

export type RolePrivileges = {
  canAccessAdmin: boolean;
  canModerateComments: boolean;
};

export const ROLE_PRIVILEGES: Record<Exclude<UserRole, null>, RolePrivileges> = {
  admin: { canAccessAdmin: true, canModerateComments: true },
  moderator: { canAccessAdmin: false, canModerateComments: true },
};

export function roleHasPrivilege(role: UserRole, required: "admin" | "moderator"): boolean {
  if (!role) return false;
  if (required === "moderator") return role === "moderator" || role === "admin";
  return role === "admin";
}

export type RoleResolution = {
  role: UserRole;
  userId: string | null;
};

export type AdminResolution = {
  isAdmin: boolean;
  userId: string | null;
};

type AdminResolutionOptions = {
  sessionClaims?: SessionClaimsLike;
  userId?: string | null | undefined;
};

export async function resolveUserRole(
  options: AdminResolutionOptions = {}
): Promise<RoleResolution> {
  if (isStaticGenerationEnvironment()) {
    return { role: null, userId: null };
  }

  if (options.sessionClaims === null && !options.userId) {
    return { role: null, userId: null };
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

  const sessionRole = getRoleFromSessionClaims(providedSessionClaims);
  if (sessionRole) {
    return { role: sessionRole, userId: providedUserId ?? null };
  }

  let user = null;
  try {
    user = await currentUser();
    const derivedRole = getRoleFromUser(user);
    if (user && derivedRole) {
      return { role: derivedRole, userId: user.id ?? providedUserId ?? null };
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
      const derivedRole = getRoleFromUser(fallbackUser);
      if (derivedRole) {
        return { role: derivedRole, userId: finalUserId };
      }
    } catch (error) {
      // ignore, final fallback below
    }
  }

  return { role: null, userId: finalUserId ?? null };
}

export async function resolveAdminStatus(
  options: AdminResolutionOptions = {}
): Promise<AdminResolution> {
  const { role, userId } = await resolveUserRole(options);
  return { isAdmin: role === "admin", userId };
}

export async function assertAdminAccess(): Promise<void> {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    throw new Error("FORBIDDEN_ADMIN_ONLY");
  }
}

export async function assertRole(required: "admin" | "moderator"): Promise<void> {
  const { role } = await resolveUserRole();
  if (!roleHasPrivilege(role, required)) {
    throw new Error("FORBIDDEN_INSUFFICIENT_ROLE");
  }
}
