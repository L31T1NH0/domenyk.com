import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"

const profileImageBase64 = await readFile(
  join(process.cwd(), "public/images/profile.jpg"),
  "base64"
)

export const ogProfileImageSrc = `data:image/jpeg;base64,${profileImageBase64}`
