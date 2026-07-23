import assert from "node:assert/strict"
import test from "node:test"

import { geometryFromAlphaPixels } from "../src/components/post/flow-image-alpha.ts"
import {
  lineSlotForAlphaBand,
  stabilizePaintedLine,
} from "../src/components/post/flow-image-layout.ts"

test("extracts normalized alpha bounds for each sampled row", () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 2)
  const setAlpha = (x, y, alpha) => { pixels[(y * 4 + x) * 4 + 3] = alpha }
  setAlpha(1, 0, 255)
  setAlpha(2, 0, 255)
  setAlpha(2, 1, 255)

  const geometry = geometryFromAlphaPixels(pixels, 4, 2, 400, 200)

  assert.deepEqual(geometry.rows, [
    { left: 0.25, right: 0.75 },
    { left: 0.5, right: 0.75 },
  ])
  assert.equal(geometry.left, 0.25)
  assert.equal(geometry.right, 0.25)
})

test("carves the correct line slot on either side of a silhouette", () => {
  const geometry = {
    width: 100,
    height: 100,
    left: 0,
    right: 0,
    rows: Array.from({ length: 10 }, () => ({ left: 0.2, right: 0.8 })),
  }
  const base = {
    geometry,
    containerWidth: 500,
    bandTop: 20,
    bandBottom: 40,
    imageTop: 0,
    imageHeight: 100,
    imageWidth: 200,
    shapeMargin: 10,
  }

  assert.deepEqual(lineSlotForAlphaBand({ ...base, side: "left", imageLeft: 0 }), {
    left: 170,
    width: 330,
  })
  assert.deepEqual(lineSlotForAlphaBand({ ...base, side: "right", imageLeft: 300 }), {
    left: 0,
    width: 330,
  })
})

test("returns the full width outside the vertical image band", () => {
  const geometry = { width: 10, height: 10, left: 0, right: 0, rows: [{ left: 0, right: 1 }] }
  assert.deepEqual(lineSlotForAlphaBand({
    geometry,
    side: "left",
    containerWidth: 320,
    bandTop: 200,
    bandBottom: 220,
    imageTop: 0,
    imageHeight: 100,
    imageLeft: 0,
    imageWidth: 100,
    shapeMargin: 0,
  }), { left: 0, width: 320 })
})

test("keeps a readable text slot beside a 52 percent image on a narrow viewport", () => {
  const geometry = {
    width: 100,
    height: 180,
    left: 0,
    right: 0,
    rows: Array.from({ length: 18 }, () => ({ left: 0.1, right: 0.9 })),
  }
  const base = {
    geometry,
    containerWidth: 320,
    bandTop: 40,
    bandBottom: 60,
    imageTop: 0,
    imageHeight: 299.52,
    imageWidth: 166.4,
    shapeMargin: 8,
  }

  assert.ok(lineSlotForAlphaBand({ ...base, side: "left", imageLeft: 0 }).width >= 160)
  assert.ok(lineSlotForAlphaBand({ ...base, side: "right", imageLeft: 153.6 }).width >= 160)
})

test("stabilizes rich inline fragments using their painted browser widths", () => {
  assert.deepEqual(stabilizePaintedLine([
    { left: 100, width: 58, gapBefore: 0 },
    { left: 156, width: 40, gapBefore: 4 },
    { left: 205, width: 20, gapBefore: 4 },
  ]), [100, 162, 206])
})
