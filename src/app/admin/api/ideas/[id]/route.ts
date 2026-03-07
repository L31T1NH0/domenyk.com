import { NextResponse } from "next/server";
import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";
import { ObjectId } from "mongodb";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin, userId } = await resolveAdminStatus();
  if (!isAdmin || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const db = await getMongoDb();
  await db.collection("ideas").updateOne(
    { _id: new ObjectId(id), userId },
    { $set: body }
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin, userId } = await resolveAdminStatus();
  if (!isAdmin || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getMongoDb();
  await db.collection("ideas").deleteOne({ _id: new ObjectId(id), userId });
  return NextResponse.json({ ok: true });
}
