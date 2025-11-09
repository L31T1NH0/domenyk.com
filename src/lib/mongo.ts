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

type GlobalWithMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoClientPromiseLock?: Promise<void>;
};

const globalWithMongo = global as GlobalWithMongo;

let clientPromise: Promise<MongoClient>;

function createTrackedClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(MONGODB_URI, options);
  const trackedPromise = client.connect().catch((error) => {
    if (globalWithMongo._mongoClientPromise === trackedPromise) {
      delete globalWithMongo._mongoClientPromise;
    }
    throw error;
  });

  globalWithMongo._mongoClientPromise = trackedPromise;
  clientPromise = trackedPromise;

  return trackedPromise;
}

function withClientLock<T>(factory: () => T): T {
  const previousLock = globalWithMongo._mongoClientPromiseLock;
  let releaseCurrent: (() => void) | undefined;

  const currentLock = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });

  globalWithMongo._mongoClientPromiseLock = currentLock;

  const run = () => {
    try {
      return factory();
    } finally {
      releaseCurrent?.();
      if (globalWithMongo._mongoClientPromiseLock === currentLock) {
        delete globalWithMongo._mongoClientPromiseLock;
      }
    }
  };

  if (previousLock) {
    return previousLock.then(run) as unknown as T;
  }

  return run();
}

function ensureClientPromise(forceReset = false): Promise<MongoClient> {
  return withClientLock(() => {
    if (!forceReset && globalWithMongo._mongoClientPromise) {
      clientPromise = globalWithMongo._mongoClientPromise;
      return globalWithMongo._mongoClientPromise;
    }

    if (forceReset) {
      delete globalWithMongo._mongoClientPromise;
    }

    return createTrackedClientPromise();
  });
}

clientPromise =
  globalWithMongo._mongoClientPromise ?? createTrackedClientPromise();

export { clientPromise };

export async function getMongoClient() {
  try {
    const client = await ensureClientPromise();
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

    try {
      await ensureClientPromise(true);
    } catch (retryError) {
      console.error("Erro ao reconectar ao MongoDB:", retryError);
      if (retryError instanceof Error) {
        throw new Error("Falha na conexão com o MongoDB: " + retryError.message);
      } else {
        throw new Error("Falha na conexão com o MongoDB: " + String(retryError));
      }
    }

    if (error instanceof Error) {
      throw new Error("Falha na conexão com o MongoDB: " + error.message);
    }
    throw new Error("Falha na conexão com o MongoDB: " + String(error));
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

