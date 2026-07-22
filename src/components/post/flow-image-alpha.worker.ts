/// <reference lib="webworker" />

import { geometryFromAlphaPixels } from "./flow-image-alpha"

type FlowAlphaWorkerRequest = {
  bitmap: ImageBitmap
  naturalHeight: number
  naturalWidth: number
  sampleHeight: number
  sampleWidth: number
}

self.addEventListener("message", (event: MessageEvent<FlowAlphaWorkerRequest>) => {
  const { bitmap, naturalHeight, naturalWidth, sampleHeight, sampleWidth } = event.data
  try {
    const canvas = new OffscreenCanvas(sampleWidth, sampleHeight)
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("Canvas 2D is unavailable")
    context.drawImage(bitmap, 0, 0, sampleWidth, sampleHeight)
    bitmap.close()
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data
    self.postMessage({
      geometry: geometryFromAlphaPixels(
        pixels,
        sampleWidth,
        sampleHeight,
        naturalWidth,
        naturalHeight
      ),
    })
  } catch (error) {
    bitmap.close()
    self.postMessage({ error: error instanceof Error ? error.message : "Alpha measurement failed" })
  }
})

export {}
