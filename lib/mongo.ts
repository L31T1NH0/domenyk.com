import { MongoClient } from "mongodb";

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
  throw new Error("Please add MONGODB_URI to .env.local");
}

const uri = process.env.MONGODB_URI;
let globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise: Promise<MongoClient>;
};

if (!globalWithMongo._mongoClientPromise) {
  client = new MongoClient(uri);
  globalWithMongo._mongoClientPromise = client.connect();
}
clientPromise = globalWithMongo._mongoClientPromise;

export default clientPromise;
