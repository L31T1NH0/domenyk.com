export function parseWritingInput(body: unknown): { title: string; progress: number } {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Dados inválidos.")
  const { title, progress } = body as Record<string, unknown>
  if (typeof title !== "string" || !title.trim() || title.trim().length > 180) {
    throw new Error("Informe um título de até 180 caracteres.")
  }
  if (typeof progress !== "number" || !Number.isInteger(progress) || progress < 0 || progress > 100) {
    throw new Error("Informe uma porcentagem inteira entre 0 e 100.")
  }
  return { title: title.trim(), progress }
}
