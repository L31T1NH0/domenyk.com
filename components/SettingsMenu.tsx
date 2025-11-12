"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function SettingsMenu() {
  return (
    <div className="flex items-center">
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </div>
  );
}
