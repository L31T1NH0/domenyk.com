export type FlowImageAlphaRow = {
  left: number
  right: number
}

export type FlowImageAlphaGeometry = {
  height: number
  left: number
  right: number
  rows: Array<FlowImageAlphaRow | null>
  width: number
}

export const MAX_FLOW_ALPHA_SAMPLE_DIMENSION = 512
export const FLOW_ALPHA_THRESHOLD = Math.ceil(255 * 0.12)

export function geometryFromAlphaPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  naturalWidth: number,
  naturalHeight: number,
  threshold = FLOW_ALPHA_THRESHOLD
): FlowImageAlphaGeometry {
  if (width < 1 || height < 1 || pixels.length < width * height * 4) {
    throw new Error("Invalid alpha pixel buffer")
  }

  let firstVisibleColumn = width
  let lastVisibleColumn = -1
  const rows: Array<FlowImageAlphaRow | null> = new Array(height).fill(null)

  for (let y = 0; y < height; y += 1) {
    let rowLeft = width
    let rowRight = -1
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3]
      if (alpha < threshold) continue
      rowLeft = Math.min(rowLeft, x)
      rowRight = Math.max(rowRight, x)
      firstVisibleColumn = Math.min(firstVisibleColumn, x)
      lastVisibleColumn = Math.max(lastVisibleColumn, x)
    }
    if (rowRight >= rowLeft) {
      rows[y] = {
        left: rowLeft / width,
        right: (rowRight + 1) / width,
      }
    }
  }

  if (lastVisibleColumn < firstVisibleColumn) {
    return { height: naturalHeight, left: 0, right: 0, rows, width: naturalWidth }
  }

  return {
    height: naturalHeight,
    left: firstVisibleColumn / width,
    right: (width - 1 - lastVisibleColumn) / width,
    rows,
    width: naturalWidth,
  }
}
