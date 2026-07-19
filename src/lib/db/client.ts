import "server-only"

import { MongoClient } from "mongodb"
import { resetOnRejection } from "../retryable-promise"

declare global {
  var _mongoClient: MongoClient | undefined
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI is not set")

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri)
    const retryableConnection = resetOnRejection(client.connect(), async () => {
      if (global._mongoClientPromise === retryableConnection) {
        global._mongoClient = undefined
        global._mongoClientPromise = undefined
      }
      await client.close()
    })

    global._mongoClient = client
    global._mongoClientPromise = retryableConnection
  }

  return global._mongoClientPromise
}

export async function getDb() {
  const client = await getClientPromise()
  return client.db("blog")
}
