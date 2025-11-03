"use client";

import { useState } from "react";
import { EllipsisVerticalIcon, XMarkIcon } from "@heroicons/react/20/solid";
import {
  useUser,  
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton, 
} from "@lib/clerk-frontend";	

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