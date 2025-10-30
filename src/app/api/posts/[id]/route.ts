import type { NextRequest } from "next/server";
import { defaultDependencies, resolvePostResponse } from "./handler";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return resolvePostResponse(req, params, defaultDependencies);
}
