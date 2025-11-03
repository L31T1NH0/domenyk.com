"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  ClerkProvider as RealClerkProvider,
  SignedIn as RealSignedIn,
  SignedOut as RealSignedOut,
  SignInButton as RealSignInButton,
  UserButton as RealUserButton,
  useAuth as realUseAuth,
  useClerk as realUseClerk,
  useUser as realUseUser,
} from "@clerk/nextjs";
import type { UseAuthReturn, UseUserReturn } from "@clerk/types";

const envPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? "";

let frontendEnabled = envPublishableKey.trim().length > 0;

function resolveKey(input?: string | null): string | undefined {
  const candidate = input ?? envPublishableKey;
  if (!candidate) return undefined;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

type ProviderProps = {
  publishableKey?: string;
  children: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export function ClerkProvider({ publishableKey, children, ...rest }: ProviderProps) {
  const resolvedKey = resolveKey(publishableKey);
  if (resolvedKey) {
    frontendEnabled = true;
    return (
      <RealClerkProvider publishableKey={resolvedKey} {...rest}>
        {children}
      </RealClerkProvider>
    );
  }

  frontendEnabled = false;
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "Clerk publishable key não configurada; renderizando layout sem contexto de autenticação."
    );
  }

  return <>{children}</>;
}

const authStub: UseAuthReturn = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
  sessionClaims: null,
  actor: null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
  has: () => false,
  signOut: async () => undefined,
  getToken: async () => null,
};

export function useAuth(...args: Parameters<typeof realUseAuth>): UseAuthReturn {
  if (frontendEnabled) {
    return realUseAuth(...args);
  }
  return authStub;
}

const userStub: UseUserReturn = {
  isLoaded: true,
  isSignedIn: false,
  user: null,
};

export function useUser(): UseUserReturn {
  if (frontendEnabled) {
    return realUseUser();
  }
  return userStub;
}

type UseClerkReturn = ReturnType<typeof realUseClerk>;

const clerkStub = new Proxy(
  {
    loaded: false,
    client: null,
  } as Record<string, unknown>,
  {
    get(target, prop) {
      if (Object.prototype.hasOwnProperty.call(target, prop)) {
        return Reflect.get(target, prop);
      }
      if (prop === "openSignIn") {
        return (options?: { redirectUrl?: string }) => {
          if (typeof window !== "undefined") {
            window.location.href = options?.redirectUrl ?? "/sign-in";
          }
        };
      }
      if (prop === "openSignUp") {
        return (options?: { redirectUrl?: string }) => {
          if (typeof window !== "undefined") {
            window.location.href = options?.redirectUrl ?? "/sign-up";
          }
        };
      }
      if (prop === "openUserProfile") {
        return () => {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Clerk indisponível; ignorando openUserProfile().");
          }
        };
      }
      return (..._args: unknown[]) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`Clerk indisponível; chamada ignorada (${String(prop)}).`);
        }
        return undefined;
      };
    },
  }
) as unknown as UseClerkReturn;

export function useClerk(): UseClerkReturn {
  if (frontendEnabled) {
    return realUseClerk();
  }
  return clerkStub;
}

type SignedInProps = React.ComponentProps<typeof RealSignedIn>;

type SignedOutProps = React.ComponentProps<typeof RealSignedOut>;

type SignInBtnProps = ComponentProps<typeof RealSignInButton>;

type UserBtnProps = ComponentProps<typeof RealUserButton>;

export function SignedIn(props: SignedInProps) {
  if (frontendEnabled) {
    return <RealSignedIn {...props} />;
  }
  return null;
}

export function SignedOut({ children }: SignedOutProps) {
  if (frontendEnabled) {
    return <RealSignedOut>{children}</RealSignedOut>;
  }
  return <>{children}</>;
}

export function SignInButton(props: SignInBtnProps) {
  if (frontendEnabled) {
    return <RealSignInButton {...props} />;
  }
  return null;
}

export function UserButton(props: UserBtnProps) {
  if (frontendEnabled) {
    return <RealUserButton {...props} />;
  }
  return null;
}
