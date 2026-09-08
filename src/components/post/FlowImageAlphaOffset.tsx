"use client"

import { useEffect } from "react"
import {
  geometryFromAlphaPixels,
  MAX_FLOW_ALPHA_SAMPLE_DIMENSION,
  type FlowImageAlphaGeometry,
} from "./flow-image-alpha"

export type { FlowImageAlphaGeometry } from "./flow-image-alpha"

type FlowSide = "left" | "right"
type TrackedImage = {
  abortController: AbortController
  alphaInsets: FlowImageAlphaGeometry | null
  resizeObserver: ResizeObserver
  side: FlowSide
  source: string
}
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

function flowSideForImage(image: HTMLImageElement): FlowSide | null {
  const side = image.closest<HTMLElement>("figure[data-flow-image]")?.dataset.flowImage
  return side === "left" || side === "right" ? side : null
}

function applyOuterOffset(image: HTMLImageElement, side: FlowSide, alphaInsets: FlowImageAlphaGeometry | null) {
  const offset = Math.max(0, image.getBoundingClientRect().width * (alphaInsets?.[side] ?? 0))
  const figure = image.closest<HTMLElement>("figure[data-flow-image]")
  image.style.setProperty("--flow-image-outer-alpha-offset", `${offset.toFixed(2)}px`)
  figure?.style.setProperty("--flow-image-outer-alpha-offset", `${offset.toFixed(2)}px`)
  image.dataset.flowAlphaMeasured = alphaInsets ? "true" : "unavailable"
}

/** Keeps the original alpha-edge offset working even when Pretext cannot own a paragraph. */
export function FlowImageAlphaOffset() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-public-shell]")
    if (!root) return
    const trackedImages = new Map<HTMLImageElement, TrackedImage>()
    let disposed = false

    const untrack = (image: HTMLImageElement) => {
      const tracked = trackedImages.get(image)
      if (!tracked) return
      tracked.abortController.abort()
      tracked.resizeObserver.disconnect()
      image.style.removeProperty("--flow-image-outer-alpha-offset")
      image.closest<HTMLElement>("figure[data-flow-image]")?.style.removeProperty("--flow-image-outer-alpha-offset")
      delete image.dataset.flowAlphaMeasured
      trackedImages.delete(image)
    }
    const track = (image: HTMLImageElement) => {
      const side = flowSideForImage(image)
      const source = image.currentSrc || image.src
      const current = trackedImages.get(image)
      if (!side || !source) return untrack(image)
      if (current?.side === side && current.source === source) return
      untrack(image)
      const tracked: TrackedImage = {
        abortController: new AbortController(),
        alphaInsets: null,
        side,
        source,
        resizeObserver: new ResizeObserver(() => applyOuterOffset(image, tracked.side, tracked.alphaInsets)),
      }
      trackedImages.set(image, tracked)
      tracked.resizeObserver.observe(image)
      void measureFlowImageAlpha(source, tracked.abortController.signal).then(alphaInsets => {
        if (disposed || trackedImages.get(image) !== tracked) return
        tracked.alphaInsets = alphaInsets
        applyOuterOffset(image, side, alphaInsets)
      })
    }
    const scan = () => {
      for (const image of root.querySelectorAll<HTMLImageElement>("figure[data-flow-image] > img")) track(image)
      for (const image of trackedImages.keys()) {
        if (!image.isConnected || !root.contains(image)) untrack(image)
      }
    }
    const mutationObserver = new MutationObserver(scan)
    mutationObserver.observe(root, {
      attributeFilter: ["data-flow-image", "src", "srcset"],
      attributes: true,
      childList: true,
      subtree: true,
    })
    scan()
    return () => {
      disposed = true
      mutationObserver.disconnect()
      for (const image of [...trackedImages.keys()]) untrack(image)
    }
  }, [])

  return null
}
