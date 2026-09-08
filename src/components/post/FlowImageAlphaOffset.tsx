"use client"

import {
  geometryFromAlphaPixels,
  MAX_FLOW_ALPHA_SAMPLE_DIMENSION,
  type FlowImageAlphaGeometry,
} from "./flow-image-alpha"

export type { FlowImageAlphaGeometry } from "./flow-image-alpha"

type CacheHost = typeof globalThis & {
  __domenykFlowImageAlphaCache?: Map<string, Promise<FlowImageAlphaGeometry | null>>
}

const MAX_CACHE_ENTRIES = 32
const WORKER_TIMEOUT_MS = 10_000

function cache() {
  const host = globalThis as CacheHost
  host.__domenykFlowImageAlphaCache ??= new Map()
  return host.__domenykFlowImageAlphaCache
}

function sampleDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_FLOW_ALPHA_SAMPLE_DIMENSION / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function measureWithWorker(source: string): Promise<FlowImageAlphaGeometry> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
    throw new Error("Worker image measurement is unavailable")
  }
  const response = await fetch(source, { credentials: "omit", mode: "cors" })
  if (!response.ok) throw new Error("Image could not be fetched")
  const bitmap = await createImageBitmap(await response.blob())
  const naturalWidth = bitmap.width
  const naturalHeight = bitmap.height
  if (!naturalWidth || !naturalHeight) {
    bitmap.close()
    throw new Error("Image has invalid dimensions")
  }
  const sample = sampleDimensions(naturalWidth, naturalHeight)
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./flow-image-alpha.worker.ts", import.meta.url), { type: "module" })
    const timeout = window.setTimeout(() => {
      worker.terminate()
      reject(new Error("Alpha measurement timed out"))
    }, WORKER_TIMEOUT_MS)
    const finish = () => {
      window.clearTimeout(timeout)
      worker.terminate()
    }
    worker.addEventListener("error", () => {
      finish()
      reject(new Error("Alpha measurement failed"))
    }, { once: true })
    worker.addEventListener("message", (event: MessageEvent<{ geometry?: FlowImageAlphaGeometry; error?: string }>) => {
      finish()
      if (event.data.geometry) resolve(event.data.geometry)
      else reject(new Error(event.data.error ?? "Alpha measurement failed"))
    }, { once: true })
    worker.postMessage({
      bitmap,
      naturalHeight,
      naturalWidth,
      sampleHeight: sample.height,
      sampleWidth: sample.width,
    }, [bitmap])
  })
}

function measureOnMainThread(source: string): Promise<FlowImageAlphaGeometry | null> {
  return new Promise(resolve => {
    const probe = new Image()
    probe.crossOrigin = "anonymous"
    probe.decoding = "async"
    probe.addEventListener("error", () => resolve(null), { once: true })
    probe.addEventListener("load", () => {
      try {
        if (!probe.naturalWidth || !probe.naturalHeight) return resolve(null)
        const sample = sampleDimensions(probe.naturalWidth, probe.naturalHeight)
        const canvas = document.createElement("canvas")
        canvas.width = sample.width
        canvas.height = sample.height
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) return resolve(null)
        context.drawImage(probe, 0, 0, sample.width, sample.height)
        resolve(geometryFromAlphaPixels(
          context.getImageData(0, 0, sample.width, sample.height).data,
          sample.width,
          sample.height,
          probe.naturalWidth,
          probe.naturalHeight
        ))
      } catch {
        resolve(null)
      }
    }, { once: true })
    probe.src = source
  })
}

function startMeasurement(source: string) {
  return measureWithWorker(source).catch(() => measureOnMainThread(source))
}

export function measureFlowImageAlpha(source: string, signal?: AbortSignal) {
  const entries = cache()
  let promise = entries.get(source)
  if (!promise) {
    promise = startMeasurement(source).then(geometry => {
      if (!geometry) entries.delete(source)
      return geometry
    }, () => {
      entries.delete(source)
      return null
    })
    entries.set(source, promise)
    while (entries.size > MAX_CACHE_ENTRIES) entries.delete(entries.keys().next().value as string)
  }
  if (!signal) return promise
  if (signal.aborted) return Promise.resolve(null)
  return new Promise<FlowImageAlphaGeometry | null>(resolve => {
    const abort = () => resolve(null)
    signal.addEventListener("abort", abort, { once: true })
    void promise!.then(geometry => {
      signal.removeEventListener("abort", abort)
      if (!signal.aborted) resolve(geometry)
    })
  })
}
