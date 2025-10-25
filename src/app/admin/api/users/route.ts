import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function GET() {
  const { sessionClaims } = await auth();
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  try {
    const client = await clerkClient();
    const list = await client.users.getUserList();
    const users = list.data.map((u) => ({
      id: u.id,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      imageUrl: u.imageUrl ?? null,
    }));
    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Error listing users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

