"use server";
import { Roles } from "types/globals";
import { revalidatePath } from "next/cache";
import { getClerkServerClient } from "../../lib/clerk-server";
import { resolveAdminStatus } from "../../lib/admin";

export async function setRole(formData: FormData) {
  const { isAdmin } = await resolveAdminStatus();

  // Check that the user trying to set the role is an admin
  if (!isAdmin) {
    throw new Error("Not Authorized");
  }

  const id = formData.get("id") as string;
  const role = formData.get("role") as Roles;

  try {
    const client = await getClerkServerClient();
    await client.users.updateUser(id, {
      publicMetadata: { role },
    });
    revalidatePath("/admin");
  } catch {
    throw new Error("Failed to set role");
  }
}

export async function removeRole(formData: FormData) {
  const { isAdmin } = await resolveAdminStatus();

  if (!isAdmin) {
    throw new Error("Not Authorized");
  }

  const id = formData.get("id") as string;

  try {
    const client = await getClerkServerClient();
    await client.users.updateUser(id, {
      publicMetadata: { role: null },
    });
    revalidatePath("/admin");
  } catch {
    throw new Error("Failed to remove role");
  }
}
