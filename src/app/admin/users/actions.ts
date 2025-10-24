"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function setRole(formData: FormData) {
  const id = formData.get("id");
  const role = formData.get("role");
  if (!id || typeof id !== "string") throw new Error("Missing user id");
  if (!role || typeof role !== "string") throw new Error("Missing role");

  await clerkClient.users.updateUser(id, {
    publicMetadata: { role },
  });

  revalidatePath("/admin/users");
}

export async function removeRole(formData: FormData) {
  const id = formData.get("id");
  if (!id || typeof id !== "string") throw new Error("Missing user id");

  await clerkClient.users.updateUser(id, {
    publicMetadata: { role: null },
  });

  revalidatePath("/admin/users");
}
