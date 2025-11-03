import { MongoClient } from "mongodb";

const RAW_MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "blog";

if (!RAW_MONGODB_URI || !MONGODB_DB) {
  throw new Error("Defina MONGODB_URI e MONGODB_DB no ambiente (.env)");
}

// Normaliza "localhost" para 127.0.0.1 (evita problemas de resolução/IPv6 em alguns ambientes)
const MONGODB_URI = RAW_MONGODB_URI.replace(
  /^mongodb:\/\/localhost(?=[:/])/i,
  "mongodb://127.0.0.1"
);

// Opções do cliente (timeouts ajustados para produção)
const options = {
  serverSelectionTimeoutMS:
    Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 30000,
  connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS) || 10000,
  maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 10,
  retryReads: true,
  retryWrites: true,
} as const;

let globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

if (!globalWithMongo._mongoClientPromise) {
  const client = new MongoClient(MONGODB_URI, options);
  globalWithMongo._mongoClientPromise = client.connect();
}

export const clientPromise: Promise<MongoClient> =
  globalWithMongo._mongoClientPromise!;

export async function getMongoClient() {
  try {
    const client = await clientPromise;
    return client;
  } catch (error) {
    if (
      process.env.NODE_ENV === "production" &&
      /mongodb:\/\/(127\.0\.0\.1|localhost)/i.test(MONGODB_URI)
    ) {
      console.error(
        "MONGODB_URI aponta para localhost em produção. Verifique as variáveis de ambiente do deploy."
      );
    }
    console.error("Erro ao conectar ao MongoDB:", error);
    if (error instanceof Error) {
      throw new Error("Falha na conexão com o MongoDB: " + error.message);
    } else {
      throw new Error("Falha na conexão com o MongoDB: " + String(error));
    }
  }
}

export async function getMongoDb() {
  try {
    const client = await getMongoClient();
    return client.db(MONGODB_DB);
  } catch (error) {
    console.error("Erro ao acessar o banco de dados MongoDB:", error);
    throw error;
  }
}

