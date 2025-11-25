import { NextResponse } from "next/server";

import { resolveAdminStatus } from "@lib/admin";
import { generateAllSitemaps } from "@lib/sitemaps";

// Endpoint used internally after content changes to regenerate every sitemap
// variant (index + sub-sitemaps).
export async function POST() {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    await generateAllSitemaps();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to regenerate sitemaps", error);
    return NextResponse.json({ error: "Failed to regenerate sitemaps" }, { status: 500 });
  }
}
