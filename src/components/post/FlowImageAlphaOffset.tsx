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

type AlphaCacheEntry = {
  promise: Promise<FlowImageAlphaGeometry | null>
}

type FlowImageAlphaCacheHost = typeof globalThis & {
  __domenykFlowImageAlphaCache?: Map<string, AlphaCacheEntry>
}

const FLOW_IMAGE_SELECTOR = "figure[data-flow-image] > img"
const MAX_CACHE_ENTRIES = 32
const WORKER_TIMEOUT_MS = 10_000

function flowImageAlphaCache() {
  const host = globalThis as FlowImageAlphaCacheHost
  host.__domenykFlowImageAlphaCache ??= new Map()
  return host.__domenykFlowImageAlphaCache
}

function touchCacheEntry(source: string, entry: AlphaCacheEntry) {
  const cache = flowImageAlphaCache()
  cache.delete(source)
  cache.set(source, entry)
}

function evictAlphaCache() {
  const cache = flowImageAlphaCache()
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined
    if (!oldest) break
    cache.delete(oldest)
  }
}

function sampleDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_FLOW_ALPHA_SAMPLE_DIMENSION / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function measureWithWorker(source: string): Promise<FlowImageAlphaGeometry> {
  if (
    typeof Worker === "undefined" ||
    typeof OffscreenCanvas === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    throw new Error("Off-main-thread image measurement is unavailable")
  }

  const response = await fetch(source, { credentials: "omit", mode: "cors" })
  if (!response.ok) throw new Error("Image could not be fetched for alpha measurement")
  const bitmap = await createImageBitmap(await response.blob())
  const naturalWidth = bitmap.width
  const naturalHeight = bitmap.height
  if (naturalWidth === 0 || naturalHeight === 0) {
    bitmap.close()
    throw new Error("Image has invalid dimensions")
  }
  const sample = sampleDimensions(naturalWidth, naturalHeight)

  return new Promise<FlowImageAlphaGeometry>((resolve, reject) => {
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
      reject(new Error("Alpha measurement worker failed"))
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
  return new Promise((resolve) => {
    const probe = new Image()
    probe.crossOrigin = "anonymous"
    probe.decoding = "async"
    probe.addEventListener("error", () => resolve(null), { once: true })
    probe.addEventListener("load", () => {
      try {
        const naturalWidth = probe.naturalWidth
        const naturalHeight = probe.naturalHeight
        if (naturalWidth === 0 || naturalHeight === 0) {
          resolve(null)
          return
        }
        const sample = sampleDimensions(naturalWidth, naturalHeight)
        const canvas = document.createElement("canvas")
        canvas.width = sample.width
        canvas.height = sample.height
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) {
          resolve(null)
          return
        }
        context.drawImage(probe, 0, 0, sample.width, sample.height)
        resolve(geometryFromAlphaPixels(
          context.getImageData(0, 0, sample.width, sample.height).data,
          sample.width,
          sample.height,
          naturalWidth,
          naturalHeight
        ))
      } catch {
        resolve(null)
      }
    }, { once: true })
    probe.src = source
  })
}

function startAlphaMeasurement(source: string) {
  return measureWithWorker(source).catch(() => measureOnMainThread(source))
}

export function measureFlowImageAlpha(source: string, signal?: AbortSignal) {
  const cache = flowImageAlphaCache()
  let entry = cache.get(source)
  if (entry) {
    touchCacheEntry(source, entry)
  } else {
    entry = { promise: Promise.resolve(null) }
    entry.promise = startAlphaMeasurement(source).then((geometry) => {
      if (!geometry) cache.delete(source)
      else {
        touchCacheEntry(source, entry!)
        evictAlphaCache()
      }
      return geometry
    }, () => {
      cache.delete(source)
      return null
    })
    cache.set(source, entry)
  }

  if (!signal) return entry.promise
  if (signal.aborted) return Promise.resolve(null)
  return new Promise<FlowImageAlphaGeometry | null>((resolve) => {
    const onAbort = () => resolve(null)
    signal.addEventListener("abort", onAbort, { once: true })
    void entry!.promise.then((geometry) => {
      signal.removeEventListener("abort", onAbort)
      if (!signal.aborted) resolve(geometry)
    })
  })
}

function flowSideForImage(image: HTMLImageElement): FlowSide | null {
  const figure = image.closest<HTMLElement>("figure[data-flow-image]")
  const side = figure?.dataset.flowImage
  return side === "left" || side === "right" ? side : null
}

function applyOuterOffset(image: HTMLImageElement, side: FlowSide, alphaInsets: FlowImageAlphaGeometry | null) {
  const transparentFraction = alphaInsets?.[side] ?? 0
  const renderedWidth = image.getBoundingClientRect().width
  const offset = Math.max(0, renderedWidth * transparentFraction)
  image.style.setProperty("--flow-image-outer-alpha-offset", `${offset.toFixed(2)}px`)
  image.closest<HTMLElement>("figure[data-flow-image]")?.style.setProperty(
    "--flow-image-outer-alpha-offset",
    `${offset.toFixed(2)}px`
  )
  image.dataset.flowAlphaMeasured = alphaInsets ? "true" : "unavailable"
}

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
      image.closest<HTMLElement>("figure[data-flow-image]")?.style.removeProperty(
        "--flow-image-outer-alpha-offset"
      )
      delete image.dataset.flowAlphaMeasured
      trackedImages.delete(image)
    }

    const track = (image: HTMLImageElement) => {
      const side = flowSideForImage(image)
      const source = image.currentSrc || image.src
      const current = trackedImages.get(image)
      if (!side || !source) {
        untrack(image)
        return
      }
      if (current?.side === side && current.source === source) return
      untrack(image)

      const tracked: TrackedImage = {
        abortController: new AbortController(),
        alphaInsets: null,
        side,
        source,
        resizeObserver: new ResizeObserver(() => {
          applyOuterOffset(image, tracked.side, tracked.alphaInsets)
        }),
      }
      trackedImages.set(image, tracked)
      tracked.resizeObserver.observe(image)

      void measureFlowImageAlpha(source, tracked.abortController.signal).then((alphaInsets) => {
        if (disposed || trackedImages.get(image) !== tracked) return
        tracked.alphaInsets = alphaInsets
        applyOuterOffset(image, side, alphaInsets)
      })
    }

    const scan = () => {
      for (const image of root.querySelectorAll<HTMLImageElement>(FLOW_IMAGE_SELECTOR)) track(image)
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
