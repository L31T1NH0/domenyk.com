export const POST_VIEW_MIN_ACTIVE_SECONDS = 10
export const POST_VIEW_MIN_PROGRESS = 0.01

export type PostViewQualification = {
  activeSeconds: number
  progress: number
  interacted: boolean
}

export function qualifiesPostView({ activeSeconds, progress, interacted }: PostViewQualification) {
  return Number.isFinite(activeSeconds)
    && activeSeconds >= POST_VIEW_MIN_ACTIVE_SECONDS
    && Number.isFinite(progress)
    && progress >= 0
    && progress <= 1
    && (progress >= POST_VIEW_MIN_PROGRESS || interacted)
}
