"use server";

import { revalidatePath } from "next/cache";
import { getClerkServerClient } from "../../../lib/clerk-server";

export async function setRole(formData: FormData) {
  const id = formData.get("id");
  const role = formData.get("role");
  if (!id || typeof id !== "string") throw new Error("Missing user id");
  if (!role || typeof role !== "string") throw new Error("Missing role");

  const client = await getClerkServerClient();
  await client.users.updateUser(id, {
    publicMetadata: { role },
  });

  revalidatePath("/admin/users");
}

export async function removeRole(formData: FormData) {
  const id = formData.get("id");
  if (!id || typeof id !== "string") throw new Error("Missing user id");

  const client = await getClerkServerClient();
  await client.users.updateUser(id, {
    publicMetadata: { role: null },
  });

  revalidatePath("/admin/users");
}
