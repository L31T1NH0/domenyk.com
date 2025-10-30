import { defaultDependencies, resolvePostResponse } from "./handler";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  return resolvePostResponse(req, params, defaultDependencies);
}
