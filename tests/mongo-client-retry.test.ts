import assert from "node:assert/strict";
import { test } from "node:test";

import { loadModuleWithMocks } from "./helpers/load-module";

void test("getMongoClient retries after transient failure", async () => {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";
  process.env.MONGODB_DB = "blog";

  const globalAny = globalThis as typeof globalThis & {
    _mongoClientPromise?: Promise<unknown>;
    _mongoClientPromiseLock?: Promise<void>;
  };

  delete globalAny._mongoClientPromise;
  delete globalAny._mongoClientPromiseLock;

  const fakeClient = { id: "client" };
  let attempts = 0;

  const mongoStub = `
    export class MongoClient {
      connect() {
        return globalThis.__TEST_MONGO_CONNECT();
      }
    }
  `;

  (globalThis as typeof globalThis & { __TEST_MONGO_CONNECT?: () => Promise<unknown> }).__TEST_MONGO_CONNECT = () => {
    attempts += 1;
    if (attempts === 1) {
      return Promise.reject(new Error("temporary failure"));
    }
    return Promise.resolve(fakeClient);
  };

  const module = await loadModuleWithMocks("src/lib/mongo.ts", {
    mongodb: mongoStub,
  });

  const firstPromise = module.clientPromise as Promise<unknown>;
  firstPromise.catch(() => undefined);

  const globalState = globalThis as typeof globalThis & {
    _mongoClientPromise?: Promise<unknown>;
    _mongoClientPromiseLock?: Promise<void>;
  };

  globalState._mongoClientPromise = firstPromise;

  await assert.rejects(module.getMongoClient(), /Falha na conexão/);

  const secondPromise = module.clientPromise as Promise<unknown>;
  assert.notStrictEqual(firstPromise, secondPromise);

  const client = await module.getMongoClient();
  assert.equal(attempts, 2);
  assert.strictEqual(client, fakeClient);

  delete (globalThis as typeof globalThis & { __TEST_MONGO_CONNECT?: () => Promise<unknown> }).__TEST_MONGO_CONNECT;
  delete globalState._mongoClientPromise;
  delete globalState._mongoClientPromiseLock;
});
