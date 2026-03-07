import { NextResponse } from "next/server";
import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";

export async function GET() {
  const { isAdmin, userId } = await resolveAdminStatus();
  if (!isAdmin || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getMongoDb();
  const ideas = await db
    .collection("ideas")
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  return NextResponse.json(ideas);
}

export async function POST(req: Request) {
  const { isAdmin, userId } = await resolveAdminStatus();
  if (!isAdmin || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const db = await getMongoDb();
  const doc = {
    userId,
    title: body.title,
    gatilhoTipo: body.gatilhoTipo,
    gatilho: body.gatilho,
    tags: body.tags ?? [],
    notas: body.notas ?? "",
    outline: null,
    outlineAt: null,
    createdAt: new Date().toISOString(),
  };
  const result = await db.collection("ideas").insertOne(doc);
  return NextResponse.json({ ...doc, _id: result.insertedId }, { status: 201 });
}
