export const BLOB_PUBLIC_HOSTNAME = "x4ceaxoe9soax6vc.public.blob.vercel-storage.com"

export function isProjectBlobHostname(hostname) {
  return hostname.toLowerCase() === BLOB_PUBLIC_HOSTNAME
}
