import { randomBytes, createHash } from "node:crypto"
import { readFile, writeFile, chmod } from "node:fs/promises"

const path = new URL("config.json", import.meta.url)
const apiOrigin = process.argv[2] || "https://domenyk-api.vercel.app"
if (!["https://domenyk-api.vercel.app", "http://localhost:8080"].includes(apiOrigin)) throw new Error("Use a API de produção ou http://localhost:8080")
let config
try { config = JSON.parse(await readFile(path, "utf8")) } catch (error) { if (error.code !== "ENOENT") throw error }
config = { ...config, apiOrigin, token: config?.token || randomBytes(32).toString("hex") }
if (!/^[a-f0-9]{64}$/.test(config.token)) throw new Error("Token local inválido; corrija o config.json antes de continuar")
await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
await chmod(path, 0o600)
console.log(`Configuração privada salva. Cadastre somente este hash na API Go:\nWATCHING_DEVICE_TOKEN_SHA256=${createHash("sha256").update(config.token).digest("hex")}`)
