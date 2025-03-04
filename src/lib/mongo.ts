import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "blog";

if (!MONGODB_URI || !MONGODB_DB) {
  throw new Error("Defina MONGODB_URI e MONGODB_DB no .env.local");
}

// Configurações adicionais para MongoDB Atlas
const options = {};

let globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise: Promise<MongoClient>;
};

if (!globalWithMongo._mongoClientPromise) {
  const client = new MongoClient(MONGODB_URI, options);
  globalWithMongo._mongoClientPromise = client.connect();
}

export const clientPromise = globalWithMongo._mongoClientPromise;

// Funções assíncronas para o App Router
export async function getMongoClient() {
  try {
    const client = await clientPromise;
    return client;
  } catch (error) {
    console.error("Erro ao conectar ao MongoDB Atlas:", error);
    if (error instanceof Error) {
      throw new Error("Falha na conexão com o MongoDB Atlas: " + error.message);
    } else {
      throw new Error("Falha na conexão com o MongoDB Atlas: " + String(error));
    }
  }
}

export async function getMongoDb() {
  try {
    const client = await getMongoClient();
    return client.db(MONGODB_DB);
  } catch (error) {
    console.error("Erro ao acessar o banco de dados MongoDB Atlas:", error);
    throw error;
  }
}
