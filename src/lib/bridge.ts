export type BridgePlayer = { name: string; score: number; disconnected?: boolean }
export type BridgeGame = { red: BridgePlayer; blue: BridgePlayer; elapsedSeconds: number }
export type BridgeActivity = "playing" | "waiting" | "minecraft"
export type BridgeStatus = { current: { activity?: BridgeActivity; match: BridgeGame | null; updatedAt: string; expiresAt: string } | null }

function player(value: unknown): BridgePlayer {
  if (!value || typeof value !== "object") throw new Error("Jogador inválido")
  const input = value as Record<string, unknown>
  if (typeof input.name !== "string" || !/^[A-Za-z0-9_]{1,16}$/.test(input.name) || !Number.isInteger(input.score) || (input.score as number) < 0 || (input.score as number) > 5 || (input.disconnected !== undefined && typeof input.disconnected !== "boolean")) throw new Error("Jogador inválido")
  return { name: input.name, score: input.score as number, ...(input.disconnected ? { disconnected: true } : {}) }
}

export function parseBridgeStatus(value: unknown): BridgeStatus {
  if (!value || typeof value !== "object") throw new Error("Partida indisponível")
  const input = value as Record<string, unknown>
  if (input.current === null) return { current: null }
  if (!input.current || typeof input.current !== "object") throw new Error("Partida inválida")
  const current = input.current as Record<string, unknown>
  if (typeof current.updatedAt !== "string" || typeof current.expiresAt !== "string" || !Number.isFinite(Date.parse(current.updatedAt)) || !Number.isFinite(Date.parse(current.expiresAt)) || Date.parse(current.expiresAt) < Date.parse(current.updatedAt) || Date.parse(current.expiresAt) - Date.parse(current.updatedAt) > 60_000) throw new Error("Partida inválida")
  const activity = current.activity ?? "playing"
  if (activity === "waiting" || activity === "minecraft") {
    if (current.match !== null) throw new Error("Estado de jogo inválido")
    return { current: { activity, match: null, updatedAt: current.updatedAt, expiresAt: current.expiresAt } }
  }
  if (activity !== "playing" || !current.match || typeof current.match !== "object") throw new Error("Estado de jogo inválido")
  const match = current.match as Record<string, unknown>
  const red = player(match.red), blue = player(match.blue)
  if (red.name.toLowerCase() === blue.name.toLowerCase() || (red.score === 5 && blue.score === 5) || !Number.isInteger(match.elapsedSeconds) || (match.elapsedSeconds as number) < 0 || (match.elapsedSeconds as number) > 900) throw new Error("Placar inválido")
  return { current: { ...(current.activity === "playing" ? { activity: "playing" as const } : {}), match: { red, blue, elapsedSeconds: match.elapsedSeconds as number }, updatedAt: current.updatedAt, expiresAt: current.expiresAt } }
}

export function currentBridgePresence(status: BridgeStatus, now = Date.now()): BridgeStatus["current"] {
  if (!status.current) return null
  const { updatedAt, expiresAt } = status.current
  const age = now - Date.parse(updatedAt)
  if (age < -10_000 || now >= Date.parse(expiresAt) || age >= 40_000) return null
  return status.current
}

export function currentBridge(status: BridgeStatus, now = Date.now()): BridgeGame | null {
  const current = currentBridgePresence(status, now)
  if (!current?.match) return null
  const { match, updatedAt } = current
  const age = now - Date.parse(updatedAt)
  return { ...match, elapsedSeconds: Math.min(900, match.elapsedSeconds + Math.max(0, Math.floor(age / 1000))) }
}
