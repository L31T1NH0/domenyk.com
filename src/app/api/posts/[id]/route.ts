import type { NextRequest } from "next/server";
import { defaultDependencies, resolvePostResponse } from "./handler";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { params } = context;
  return resolvePostResponse(req, params, defaultDependencies);
}
