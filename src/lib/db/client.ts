import { MongoClient } from "mongodb"

declare global {
  var _mongoClient: MongoClient | undefined
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI is not set")

  if (!global._mongoClientPromise) {
    global._mongoClient = new MongoClient(uri)
    global._mongoClientPromise = global._mongoClient.connect()
  }

  return global._mongoClientPromise
}

export async function getDb() {
  const client = await getClientPromise()
  return client.db("blog")
}
