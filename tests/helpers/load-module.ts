import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const TEMP_PREFIX = "module-mock-";

type StubSources = Record<string, string>;

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
    const pattern = new RegExp(`from\\s+(["'])${escapeRegExp(specifier)}\\1`, "g");
    transformed = transformed.replace(pattern, `from "${fileUrl}"`);
  }
  return transformed;
}

export async function loadModuleWithMocks(specifier: string, stubs: StubSources) {
  const tempDir = await mkdtemp(path.join(tmpdir(), TEMP_PREFIX));
  const stubEntries = await writeStubModules(tempDir, stubs);

  const absolutePath = path.resolve(process.cwd(), specifier);
  const originalSource = await readFile(absolutePath, "utf8");
  const transformedSource = replaceImportSpecifiers(originalSource, stubEntries);

  const targetPath = path.join(tempDir, "module-under-test.ts");
  await writeFile(targetPath, transformedSource, "utf8");

  const moduleUrl = pathToFileURL(targetPath).href + `?t=${Date.now()}`;
  return import(moduleUrl);
}
