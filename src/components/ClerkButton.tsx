"use client"

import { SignInButton, UserButton, useUser } from "@clerk/nextjs"

export function ClerkButton() {
  const { isSignedIn } = useUser()
  return (
    <div className="flex items-center">
      {isSignedIn ? <UserButton /> : <SignInButton />}
    </div>
  )
}
