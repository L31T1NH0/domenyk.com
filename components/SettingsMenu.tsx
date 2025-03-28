"use client";

import { useState } from "react";
import { EllipsisVerticalIcon, XMarkIcon } from "@heroicons/react/20/solid";
import {
  useUser,  
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton, 
} from "@clerk/nextjs";	

export default function SettingsMenu() {

  return (
    <div className="">
                <SignedOut>
                  <SignInButton />
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
    </div>
  );
}