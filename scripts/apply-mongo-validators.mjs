import { MongoClient } from "mongodb"

const apply = process.argv.includes("--apply")
const confirmed = process.argv.includes("--confirm=APLICAR-VALIDADORES")
const uri = apply ? process.env.MONGODB_ADMIN_URI : process.env.MONGODB_URI
if (!uri) throw new Error(apply ? "MONGODB_ADMIN_URI não definida." : "MONGODB_URI não definida.")
if (apply && !confirmed) throw new Error("Use --confirm=APLICAR-VALIDADORES junto com --apply.")

const objectId = { bsonType: "objectId" }
const string = { bsonType: "string" }
const stringOrNull = { bsonType: ["string", "null"] }
const date = { bsonType: "date" }
const bool = { bsonType: "bool" }
const number = { bsonType: ["int", "long", "double", "decimal"] }
const numberOrNull = { bsonType: ["int", "long", "double", "decimal", "null"] }
const object = { bsonType: "object" }
const array = { bsonType: "array" }

function schema(required = ["_id"], properties = {}) {
  return { bsonType: "object", required, properties: { _id: objectId, ...properties } }
}

const validators = {
  activity_events: schema(
    ["_id", "type", "occurredAt", "visitorKey", "isAuthenticated", "retentionUntil"],
    { type: string, occurredAt: date, visitorKey: string, isAuthenticated: bool, retentionUntil: date }
  ),
  analytics_events: schema(
    ["_id", "name", "clientTs", "serverTs"],
    {
      name: string, session: string, clientTs: date, serverTs: date,
      page: object, viewport: object, flags: object, device: string,
      clientTimeZone: string, userAgent: string, origin: string,
      version: number, ipHash: stringOrNull,
    }
  ),
  "auth-comments": schema(
    ["_id", "postId", "userId", "comentario", "createdAt"],
    {
      postId: string, firstName: string, role: string, userId: string,
      imageURL: string, hasImage: bool, comentario: string, ip: string,
      createdAt: string, parentId: stringOrNull,
    }
  ),
  comment_uploads: schema(
    ["_id", "url", "ownerId", "createdAt", "expiresAt"],
    { url: string, ownerId: string, createdAt: date, expiresAt: date, state: string }
  ),
  comments: schema(
    ["_id", "postId", "authorId", "authorName", "content", "createdAt", "updatedAt"],
    {
      postId: objectId, paragraphId: string, authorId: string, authorName: string,
      authorImageUrl: string, content: string, createdAt: date, updatedAt: date,
    }
  ),
  message_threads: schema(
    ["_id", "ownerId", "ownerName", "subject", "category", "status", "entries", "createdAt", "updatedAt"],
    {
      ownerId: string, ownerName: string, subject: string, category: string,
      status: string, entries: array, createdAt: date, updatedAt: date,
    }
  ),
  note_metrics: schema(
    ["_id", "noteId", "directViews", "homeImpressions", "notesImpressions"],
    {
      noteId: objectId, directViews: number, homeImpressions: number,
      notesImpressions: number, updatedAt: date,
    }
  ),
  note_view_events: schema(
    ["_id", "noteId", "visitorKey", "source", "day", "createdAt"],
    { noteId: objectId, visitorKey: string, source: string, day: string, createdAt: date }
  ),
  notes: schema(
    ["_id", "content", "publishedAt", "createdAt"],
    { content: string, publishedAt: date, createdAt: date, updatedAt: date }
  ),
  notifications: schema(
    ["_id", "recipientId", "kind", "title", "description", "href", "count", "createdAt", "updatedAt"],
    { recipientId: string, kind: string, title: string, description: string, href: string, count: number, createdAt: date, updatedAt: date }
  ),
  "paragraph-comments": schema(
    ["_id", "postId", "paragraphId", "userId", "content", "createdAt", "updatedAt"],
    {
      postId: string, paragraphId: string, userId: string, authorName: string,
      authorImageUrl: string, content: string, createdAt: string, updatedAt: string,
    }
  ),
  "paragraph-highlights": schema(
    ["_id", "postId", "paragraphId", "userId", "selectedText", "startOffset", "endOffset", "createdAt"],
    {
      postId: string, paragraphId: string, userId: string, authorName: string,
      selectedText: string, startOffset: number, endOffset: number, createdAt: string,
    }
  ),
  postViews: schema(
    ["_id", "postId", "viewerId", "createdAt", "lastViewedAt"],
    { postId: string, viewerId: string, createdAt: date, lastViewedAt: date }
  ),
  post_views: schema(
    ["_id", "publicId", "visitorKey", "createdAt"],
    { publicId: string, visitorKey: string, createdAt: date }
  ),
  posts: schema(
    [
      "_id", "publicId", "slug", "title", "content", "tags", "pinned",
      "published", "readingTimeMinutes", "style", "createdAt", "updatedAt",
    ],
    {
      publicId: string, slug: string, title: string, content: string, tags: array,
      pinned: bool, published: bool, readingTimeMinutes: number, style: string,
      createdAt: date, updatedAt: date,
    }
  ),
  push_campaigns: schema(
    ["_id", "dedupeKey", "topic", "status", "createdAt", "retentionUntil"],
    { dedupeKey: string, topic: string, status: string, createdAt: date, retentionUntil: date }
  ),
  push_subscriptions: schema(
    [
      "_id", "endpoint", "expirationTime", "keys", "topics", "adminEvents",
      "messageEvents", "failureCount", "createdAt", "updatedAt", "retentionUntil",
    ],
    {
      endpoint: string, expirationTime: numberOrNull, keys: object, topics: array,
      adminEvents: bool, messageEvents: bool, failureCount: number,
      createdAt: date, updatedAt: date, retentionUntil: date,
    }
  ),
  rate_limits: schema(
    ["_id", "count", "expiresAt"],
    { _id: string, count: number, expiresAt: date }
  ),
  settings: schema(
    ["_id", "value", "updatedAt"],
    { _id: string, value: bool, updatedAt: date }
  ),
  themes: schema(
    ["_id", "name", "slug", "description", "active", "postIds", "createdAt", "updatedAt"],
    {
      name: string, slug: string, description: string, active: bool,
      postIds: array, createdAt: date, updatedAt: date,
    }
  ),
}

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db("blog")
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort()
  const plan = collections.map((name) => ({ name, specific: Object.hasOwn(validators, name) }))
  const missingValidators = plan.filter(({ specific }) => !specific).map(({ name }) => name)

  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      validationLevel: "moderate",
      collections: plan,
      readyToApply: missingValidators.length === 0,
    }, null, 2))
  } else {
    if (missingValidators.length > 0) {
      throw new Error(`Faltam validadores específicos para: ${missingValidators.join(", ")}`)
    }
    for (const name of collections) {
      await db.command({
        collMod: name,
        validator: { $jsonSchema: validators[name] },
        validationLevel: "moderate",
        validationAction: "error",
      })
    }
    console.log(JSON.stringify({ mode: "apply", updated: collections.length }, null, 2))
  }
} finally {
  await client.close()
}
