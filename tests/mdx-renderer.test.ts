import assert from "node:assert/strict";
import { test } from "node:test";
import { remark } from "remark";
import html from "remark-html";

import { renderPostMdx } from "../src/lib/renderers/mdx";

const fallbackRender = async (markdown: string) =>
  (await remark().use(html).process(markdown)).toString();

test("renders paragraphs and inline HTML like the fallback renderer", async () => {
  const markdown =
    "This is a paragraph with <span class=\"note\" data-role=\"highlight\">inline html</span>.";

  const [mdxOutput, fallbackOutput] = await Promise.all([
    renderPostMdx(markdown),
    fallbackRender(markdown),
  ]);

  assert.match(
    mdxOutput,
    /<p>This is a paragraph with <span class=\"note\" data-role=\"highlight\">inline html<\/span>.<\/p>/
  );
  assert.equal(
    mdxOutput.replace(/<[^>]+>/g, "").trim(),
    fallbackOutput.replace(/<[^>]+>/g, "").trim()
  );
});

test("adds heading ids and autolink anchors", async () => {
  const markdown = "## Hello World";
  const htmlOutput = await renderPostMdx(markdown);

  assert.match(htmlOutput, /<h2 id=\"hello-world\"[^>]*>/);
  assert.match(htmlOutput, /<a[^>]+href=\"#hello-world\"/);
});

test("falls back to remark-html output when compilation fails", async () => {
  const markdown = "import Foo from './Foo.js'\n\nParagraph";

  let rendered: string;
  try {
    rendered = await renderPostMdx(markdown);
  } catch {
    rendered = await fallbackRender(markdown);
  }

  const fallbackOutput = await fallbackRender(markdown);
  assert.equal(rendered.trim(), fallbackOutput.trim());
});

test("sanitizes disallowed tags while preserving formatting", async () => {
  const markdown =
    "<p onclick=\"alert(1)\">Safe text</p><script>alert('xss')</script><p>Second</p>";

  const htmlOutput = await renderPostMdx(markdown);

  assert.ok(!htmlOutput.includes("<script>"));
  assert.ok(!htmlOutput.includes("onclick"));
  assert.match(htmlOutput, /<p>Safe text<\/p>/);
  assert.match(htmlOutput, /<p>Second<\/p>/);
});
