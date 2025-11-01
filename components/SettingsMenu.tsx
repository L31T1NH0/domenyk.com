"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function SettingsMenu() {

  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="border border-neutral-800 px-3 py-2 transition-colors hover:border-neutral-500 hover:text-neutral-100">
            entrar
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton appearance={{ variables: { colorPrimary: "#8b8b8b" } }} />
      </SignedIn>
    </div>
  );
}