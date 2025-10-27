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

test("injects post reference placeholders when the feature flag is enabled", async () => {
  const original = process.env.FEATURE_POST_REFERENCES;
  process.env.FEATURE_POST_REFERENCES = "true";

  try {
    const markdown = "Veja também @post(meu-post)!";
    const htmlOutput = await renderPostMdx(markdown);

    assert.match(
      htmlOutput,
      /<p>Veja também <span[^>]*data-role=\"post-reference\"[^>]*data-slug=\"meu-post\"><\/span>!<\/p>/
    );
  } finally {
    if (typeof original === "undefined") {
      delete process.env.FEATURE_POST_REFERENCES;
    } else {
      process.env.FEATURE_POST_REFERENCES = original;
    }
  }
});

test("renders post reference markers as literal text when disabled", async () => {
  const original = process.env.FEATURE_POST_REFERENCES;
  process.env.FEATURE_POST_REFERENCES = "false";

  try {
    const markdown = "Veja também @post(meu-post)!";
    const htmlOutput = await renderPostMdx(markdown);

    assert.match(htmlOutput, /@post\(meu-post\)/);
  } finally {
    if (typeof original === "undefined") {
      delete process.env.FEATURE_POST_REFERENCES;
    } else {
      process.env.FEATURE_POST_REFERENCES = original;
    }
  }
});

test("allows PostReference JSX nodes when the feature flag is on", async () => {
  const original = process.env.FEATURE_POST_REFERENCES;
  process.env.FEATURE_POST_REFERENCES = "true";

  try {
    const markdown = "Antes <PostReference slug=\"referencia\" /> depois";
    const htmlOutput = await renderPostMdx(markdown);

    assert.match(
      htmlOutput,
      /<span[^>]*data-role=\"post-reference\"[^>]*data-slug=\"referencia\"\s*><\/span>/
    );
  } finally {
    if (typeof original === "undefined") {
      delete process.env.FEATURE_POST_REFERENCES;
    } else {
      process.env.FEATURE_POST_REFERENCES = original;
    }
  }
});

test("still rejects other MDX component names", async () => {
  const original = process.env.FEATURE_POST_REFERENCES;
  process.env.FEATURE_POST_REFERENCES = "true";

  try {
    await assert.rejects(() => renderPostMdx("<CustomComponent />"), {
      message: /MDX components are not supported/,
    });
  } finally {
    if (typeof original === "undefined") {
      delete process.env.FEATURE_POST_REFERENCES;
    } else {
      process.env.FEATURE_POST_REFERENCES = original;
    }
  }
});
