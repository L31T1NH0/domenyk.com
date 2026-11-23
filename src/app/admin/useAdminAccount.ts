"use client"

import { useClerk, useUser } from "@clerk/nextjs";
import { useThemeSwitcher } from "@/components/ThemeSwitcher";
import { revokePrivatePushForCurrentDevice } from "@/lib/client-push";

export function useAdminAccount() {
  const clerk = useClerk()
  const { isLoaded, isSignedIn, user } = useUser()
  const { darkMode, toggleTheme } = useThemeSwitcher()

  async function signOut() {
    if (isSignedIn) await revokePrivatePushForCurrentDevice().catch(() => undefined)
    await clerk.signOut({ redirectUrl: "/" })
  }

  return {
    isLoaded,
    isSignedIn,
    user,
    darkMode,
    toggleTheme,
    openUserProfile: () => clerk.openUserProfile(),
    signOut,
  }
}
