import "server-only"

export type SharpFactory = typeof import("sharp").default

let sharpPromise: Promise<SharpFactory> | undefined

export function loadSharp(): Promise<SharpFactory> {
  if (!sharpPromise) {
    sharpPromise = import("sharp").then(({ default: sharp }) => sharp)
  }
  return sharpPromise
}

export async function loadSharpForSvg(): Promise<SharpFactory> {
  const sharp = await loadSharp()

  // Next 16.3 blocks libvips loaders process-wide when next/image initializes.
  // Re-enable only SVG for sanitized uploads and ImageResponse's trusted SVG.
  sharp.unblock({ operation: ["VipsForeignLoadSvg"] })
  return sharp
}
