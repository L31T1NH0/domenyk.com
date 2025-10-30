import type { NextRequest } from "next/server";
import { defaultDependencies, resolvePostResponse } from "./handler";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return resolvePostResponse(req, params, defaultDependencies);
}
