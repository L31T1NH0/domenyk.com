import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { afterEach, test } from "node:test";

const TEMP_PREFIX = "post-metadata-module-";

type StubSources = Record<string, string>;

declare global {
  // eslint-disable-next-line no-var
  var __mockPost: unknown;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function writeStubModules(tempDir: string, stubs: StubSources): Promise<Map<string, string>> {
  const entries = new Map<string, string>();

  for (const [specifier, source] of Object.entries(stubs)) {
    const fileName = `${specifier.replace(/[^a-zA-Z0-9_-]+/g, "_")}.ts`;
    const filePath = path.join(tempDir, fileName);
    await writeFile(filePath, source, "utf8");
    entries.set(specifier, pathToFileURL(filePath).href);
  }

  return entries;
}

function replaceImportSpecifiers(source: string, replacements: Map<string, string>): string {
  let transformed = source;
  for (const [specifier, fileUrl] of replacements) {
    const fromPattern = new RegExp(`from\\s+(["'])${escapeRegExp(specifier)}\\1`, "g");
    transformed = transformed.replace(fromPattern, `from "${fileUrl}"`);
    const barePattern = new RegExp(`import\\s+(["'])${escapeRegExp(specifier)}\\1`, "g");
    transformed = transformed.replace(barePattern, `import "${fileUrl}"`);
  }
  return transformed;
}

async function loadPostPageModule() {
  const tempDir = await mkdtemp(path.join(tmpdir(), TEMP_PREFIX));
  const stubEntries = await writeStubModules(tempDir, {
    "next/cache": `export const unstable_cache = () => async () => (globalThis as any).__mockPost ?? null;`,
    "next/navigation": `export const notFound = () => { throw new Error('notFound'); };`,
    "@components/layout": `export const Layout = () => null;`,
    "@components/back-home": `export const BackHome = () => null;`,
    "@components/Comment": `const Comment = () => null; export default Comment;`,
    "@components/PostHeader": `export const PostHeader = () => null;`,
    "./post-content-client": `const PostContentClient = () => null; export default PostContentClient;`,
    "../../../lib/renderers/mdx": `export async function renderPostMdx() { return ""; }`,
    "../../../lib/admin": `export async function resolveAdminStatus() { return { isAdmin: false }; }`,
    "../../../lib/mongo": `export async function getMongoDb() {
      return {
        collection() {
          return {
            findOne() {
              return (globalThis as any).__mockPost ?? null;
            },
          };
        },
      };
    }`,
    remark: `export const remark = () => ({
      use() {
        return {
          process: async () => ({
            toString: () => "",
          }),
        };
      },
    });`,
    "remark-html": `const html = () => null; export default html;`,
  });

  const absolutePath = path.resolve(process.cwd(), "src/app/posts/[id]/page.tsx");
  const originalSource = await readFile(absolutePath, "utf8");
  const transformedSource = replaceImportSpecifiers(originalSource, stubEntries);

  const targetPath = path.join(tempDir, "module-under-test.tsx");
  await writeFile(targetPath, transformedSource, "utf8");

  const moduleUrl = pathToFileURL(targetPath).href + `?t=${Date.now()}`;
  return import(moduleUrl);
}

afterEach(() => {
  delete globalThis.__mockPost;
});

test("generateMetadata uses subtitle for description", async () => {
  globalThis.__mockPost = {
    postId: "with-subtitle",
    title: "Post With Subtitle",
    subtitle: "A concise summary.",
    date: "2024-01-01T00:00:00.000Z",
  };

  const module = await loadPostPageModule();
  const metadata = await module.generateMetadata({
    params: Promise.resolve({ id: "with-subtitle" }),
  });

  assert.equal(metadata.description, "A concise summary.");
  assert.equal(metadata.openGraph?.description, "A concise summary.");
  assert.equal(metadata.twitter?.description, "A concise summary.");
});

test("generateMetadata leaves description undefined without subtitle", async () => {
  globalThis.__mockPost = {
    postId: "without-subtitle",
    title: "Post Without Subtitle",
    date: "2024-01-01T00:00:00.000Z",
    htmlContent: "<p>This body should not appear in metadata.</p>",
  };

  const module = await loadPostPageModule();
  const metadata = await module.generateMetadata({
    params: Promise.resolve({ id: "without-subtitle" }),
  });

  assert.equal(metadata.description, undefined);
  assert.equal(metadata.openGraph?.description, undefined);
  assert.equal(metadata.twitter?.description, undefined);
});
