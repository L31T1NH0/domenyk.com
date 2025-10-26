import { MongoClient } from "mongodb";

const RAW_MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "blog";

if (!RAW_MONGODB_URI || !MONGODB_DB) {
  throw new Error("Defina MONGODB_URI e MONGODB_DB no .env.local");
}

// Normaliza "localhost" para 127.0.0.1 (evita problemas de resolução/IPv6 em alguns ambientes Windows)
const MONGODB_URI = RAW_MONGODB_URI.replace(
  /^mongodb:\/\/localhost(?=[:/])/i,
  "mongodb://127.0.0.1"
);

// Configurações para falhar mais rápido quando o servidor não está acessível
const options = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  maxPoolSize: 10,
} as const;

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
