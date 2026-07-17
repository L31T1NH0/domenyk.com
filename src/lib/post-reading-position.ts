export type ReadingPosition = {
  contentOffset: number
  progress: number
}

export const POST_READING_POSITION_STORAGE_PREFIX = "domenyk:post-reading-position:"
export const POST_READING_POSITION_SKIP_RESTORE_KEY = "domenyk:post-reading-position:skip-restore"
export const READING_COMPLETION_THRESHOLD = 0.96

const minimumReadingOffset = 320
const maximumReadingOffset = 560
const viewportReadingRatio = 0.5

export function getMinimumRestorableOffset(viewportHeight: number) {
  const safeViewportHeight = Number.isFinite(viewportHeight) && viewportHeight > 0
    ? viewportHeight
    : 0

  return Math.max(
    minimumReadingOffset,
    Math.min(maximumReadingOffset, safeViewportHeight * viewportReadingRatio)
  )
}

export function isRestorableReadingPosition(position: ReadingPosition, viewportHeight: number) {
  return Number.isFinite(position.contentOffset)
    && Number.isFinite(position.progress)
    && position.contentOffset >= getMinimumRestorableOffset(viewportHeight)
    && position.progress >= 0
    && position.progress < READING_COMPLETION_THRESHOLD
}
