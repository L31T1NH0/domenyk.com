import assert from "node:assert/strict"
import test from "node:test"

import { decryptBackup, encryptBackup } from "../scripts/secure-mongo-backup.mjs"

test("migration backups are encrypted and authenticated", () => {
  const plaintext = '{"private":"conteúdo sensível"}'
  const encrypted = encryptBackup(plaintext, "uma-frase-secreta-de-teste")

  assert.equal(encrypted.includes(Buffer.from(plaintext)), false)
  assert.equal(decryptBackup(encrypted, "uma-frase-secreta-de-teste"), plaintext)
  assert.throws(() => decryptBackup(encrypted, "uma-frase-secreta-incorreta"))
})
