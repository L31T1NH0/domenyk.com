export function resetOnRejection<T>(
  promise: Promise<T>,
  reset: () => void | Promise<void>
): Promise<T> {
  return promise.catch(async (error: unknown) => {
    try {
      await reset()
    } catch {
      // Preserve the initialization error that callers need to handle.
    }
    throw error
  })
}
