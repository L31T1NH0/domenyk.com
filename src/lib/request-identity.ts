import "server-only"

import { createHash, createHmac } from "crypto"
import type { NextRequest } from "next/server"

type HeaderReader = Pick<Headers, "get">

function firstHeaderIp(value: string | null): string | null {
  const ip = value?.split(",").at(-1)?.trim()
  return ip || null
}

function clientIpFromHeaders(headers: HeaderReader): string {
  return (
    firstHeaderIp(headers.get("x-vercel-forwarded-for")) ??
    firstHeaderIp(headers.get("cf-connecting-ip")) ??
    firstHeaderIp(headers.get("true-client-ip")) ??
    firstHeaderIp(headers.get("x-real-ip")) ??
    firstHeaderIp(headers.get("x-forwarded-for")) ??
    "unknown"
  )
}

export function clientIp(req: NextRequest): string {
  return clientIpFromHeaders(req.headers)
}

function identityForIp(ip: string): string {
  const secret = process.env.REQUEST_IDENTITY_SECRET ?? process.env.CLERK_SECRET_KEY

  if (secret) {
    return createHmac("sha256", secret)
      .update("domenyk:request-identity:v1\0")
      .update(ip)
      .digest("hex")
      .slice(0, 32)
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("REQUEST_IDENTITY_SECRET ou CLERK_SECRET_KEY deve estar configurado")
  }

  return createHash("sha256").update(ip).digest("hex").slice(0, 32)
}

export function requestIdentity(req: NextRequest): string {
  return identityForIp(clientIp(req))
}

export function requestIdentityFromHeaders(headers: HeaderReader): string {
  return identityForIp(clientIpFromHeaders(headers))
}
