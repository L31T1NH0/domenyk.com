export type ImageUploadBody = ArrayBuffer | Blob | Buffer

/**
 * Vercel's fetch implementation rejects ArrayBufferViews backed by a
 * SharedArrayBuffer. Native image processors can return buffers backed by
 * shared memory, so copy their bytes into an ordinary ArrayBuffer before the
 * body reaches @vercel/blob.
 */
export function unsharedImageUploadBody(data: ImageUploadBody): ArrayBuffer | Blob {
  if (data instanceof Blob) return data

  const source = data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const copy = new Uint8Array(source.byteLength)
  copy.set(source)
  return copy.buffer
}
