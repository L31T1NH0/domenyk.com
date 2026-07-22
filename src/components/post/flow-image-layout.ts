import type { FlowImageAlphaGeometry } from "./flow-image-alpha"

export type FlowSide = "left" | "right"

export type LineSlot = {
  left: number
  width: number
}

export type PaintedLineFragment = {
  gapBefore: number
  left: number
  width: number
}

export function stabilizePaintedLine(fragments: PaintedLineFragment[]) {
  let previousRight = -Infinity
  return fragments.map((fragment, index) => {
    const left = index === 0
      ? fragment.left
      : Math.max(fragment.left, previousRight + Math.max(0, fragment.gapBefore))
    previousRight = left + Math.max(0, fragment.width)
    return left
  })
}

function alphaIntervalForBand(
  geometry: FlowImageAlphaGeometry,
  bandTop: number,
  bandBottom: number,
  imageTop: number,
  imageHeight: number,
  imageLeft: number,
  imageWidth: number,
  shapeMargin: number
): { left: number; right: number } | null {
  if (imageHeight <= 0 || geometry.rows.length === 0) return null
  const expandedTop = bandTop - shapeMargin
  const expandedBottom = bandBottom + shapeMargin
  const start = Math.max(0, Math.floor(((expandedTop - imageTop) / imageHeight) * geometry.rows.length))
  const end = Math.min(
    geometry.rows.length - 1,
    Math.ceil(((expandedBottom - imageTop) / imageHeight) * geometry.rows.length)
  )
  if (end < 0 || start >= geometry.rows.length || start > end) return null

  let left = Infinity
  let right = -Infinity
  for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
    const row = geometry.rows[rowIndex]
    if (!row) continue
    left = Math.min(left, imageLeft + row.left * imageWidth)
    right = Math.max(right, imageLeft + row.right * imageWidth)
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null
  return { left: left - shapeMargin, right: right + shapeMargin }
}

export function lineSlotForAlphaBand({
  geometry,
  side,
  containerWidth,
  bandTop,
  bandBottom,
  imageTop,
  imageHeight,
  imageLeft,
  imageWidth,
  shapeMargin,
}: {
  geometry: FlowImageAlphaGeometry
  side: FlowSide
  containerWidth: number
  bandTop: number
  bandBottom: number
  imageTop: number
  imageHeight: number
  imageLeft: number
  imageWidth: number
  shapeMargin: number
}): LineSlot {
  const obstacle = alphaIntervalForBand(
    geometry,
    bandTop,
    bandBottom,
    imageTop,
    imageHeight,
    imageLeft,
    imageWidth,
    shapeMargin
  )
  if (!obstacle) return { left: 0, width: containerWidth }
  if (side === "left") {
    const left = Math.min(containerWidth, Math.max(0, obstacle.right))
    return { left, width: Math.max(0, containerWidth - left) }
  }
  return { left: 0, width: Math.max(0, Math.min(containerWidth, obstacle.left)) }
}
