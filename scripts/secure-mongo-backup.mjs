import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto"
import { chmod, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { EJSON } from "bson"

const MAGIC = Buffer.from("DOMENYKB1", "ascii")
const SALT_BYTES = 16
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function isInsideRepository(path) {
  const relation = relative(repositoryRoot, path)
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))
}

export function backupPassphrase() {
  const passphrase = process.env.MIGRATION_BACKUP_PASSPHRASE?.trim() ?? ""
  if (passphrase.length < 16) {
    throw new Error("Defina MIGRATION_BACKUP_PASSPHRASE com pelo menos 16 caracteres.")
  }
  return passphrase
}

export function encryptBackup(contents, passphrase) {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = scryptSync(passphrase, salt, 32)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(contents, "utf8"), cipher.final()])
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ciphertext])
}

export function decryptBackup(contents, passphrase) {
  const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents)
  if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Formato de backup inválido.")
  const saltStart = MAGIC.length
  const ivStart = saltStart + SALT_BYTES
  const tagStart = ivStart + IV_BYTES
  const dataStart = tagStart + AUTH_TAG_BYTES
  const key = scryptSync(passphrase, buffer.subarray(saltStart, ivStart), 32)
  const decipher = createDecipheriv("aes-256-gcm", key, buffer.subarray(ivStart, tagStart))
  decipher.setAuthTag(buffer.subarray(tagStart, dataStart))
  return Buffer.concat([decipher.update(buffer.subarray(dataStart)), decipher.final()]).toString("utf8")
}

export async function readEncryptedBackup(path, passphrase) {
  return decryptBackup(await readFile(path), passphrase)
}

export async function backupDatabase(db, directory, passphrase) {
  const requestedTarget = resolve(directory)
  if (isInsideRepository(requestedTarget)) {
    throw new Error(`O backup deve ficar fora do repositório: ${requestedTarget}`)
  }

  await mkdir(requestedTarget, { recursive: true, mode: 0o700 })
  const target = await realpath(requestedTarget)
  if (isInsideRepository(target)) {
    throw new Error(`O destino real do backup fica dentro do repositório: ${target}`)
  }
  await chmod(target, 0o700)
  if ((await readdir(target)).length > 0) {
    throw new Error(`O diretório de backup precisa estar vazio: ${target}`)
  }

  const collections = await db.listCollections().toArray()
  const manifest = { database: db.databaseName, createdAt: new Date().toISOString(), encrypted: true, collections: [] }
  for (const collectionInfo of collections) {
    const { name } = collectionInfo
    const documents = await db.collection(name).find({}).toArray()
    const contents = EJSON.stringify(documents, null, 2, { relaxed: false })
    const indexes = await db.collection(name).listIndexes().toArray().catch(() => [])
    const file = `${name}.ejson.enc`
    await writeFile(resolve(target, file), encryptBackup(contents, passphrase), { flag: "wx", mode: 0o600 })
    manifest.collections.push({
      name,
      file,
      documents: documents.length,
      sha256: createHash("sha256").update(contents).digest("hex"),
      options: collectionInfo.options ?? {},
      indexes,
    })
  }

  const manifestContents = EJSON.stringify(manifest, null, 2, { relaxed: false })
  await writeFile(
    resolve(target, "manifest.ejson.enc"),
    encryptBackup(manifestContents, passphrase),
    { flag: "wx", mode: 0o600 }
  )
  return { target, manifest }
}
