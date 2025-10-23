import { strict as assert } from "assert";
import { JSDOM } from "jsdom";

async function run() {
  const { window } = new JSDOM("<!DOCTYPE html>");
  (global as any).window = window;
  (global as any).document = window.document;
  Object.defineProperty(global, "navigator", {
    value: window.navigator,
    configurable: true,
  });

  const { sanitizeCommentHtml } = await import("../components/comments/utils");

  const malicious =
    "<img src=x onerror=\"alert('xss')\" /><script>alert('hack')</script><p>Seguro</p>";
  const sanitized = sanitizeCommentHtml(malicious);
  assert(!sanitized.includes("onerror"), "should remove inline event handlers");
  assert(!sanitized.includes("<script"), "should remove script tags");
  assert(sanitized.includes("<p>Seguro</p>"), "should keep safe markup");

  const safe = "<strong>Negrito</strong>";
  const sanitizedSafe = sanitizeCommentHtml(safe);
  assert.strictEqual(
    sanitizedSafe,
    "<strong>Negrito</strong>",
    "should preserve allowed tags"
  );

  console.log("sanitizeCommentHtml tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
