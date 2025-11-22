import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

import structuredTokensPlugin from "../remark/structured-tokens";

const sanitizerSchema = (() => {
  const schema = structuredClone(defaultSchema);
  const tagNames = new Set(schema.tagNames ?? []);
  ["span", "section", "article", "time", "figure", "figcaption"].forEach((tag) =>
    tagNames.add(tag)
  );
  schema.tagNames = Array.from(tagNames);

  schema.attributes = {
    ...schema.attributes,
    "*": [
      ...((schema.attributes?.["*"] as any[]) ?? []),
      "className",
      "data*",
      "data-role",
      "dataRole",
      "aria-label",
      "ariaLabel",
    ],
    span: [...((schema.attributes?.span as any[]) ?? []), "dataRole", "data*", "className"],
    a: [...((schema.attributes?.a as any[]) ?? []), "href", "target", "rel", "title", "className"],
    time: [...((schema.attributes?.time as any[]) ?? []), "dateTime"],
  } as any;

  schema.strip = Array.from(new Set([...(schema.strip ?? []), "script", "style"]));
  return schema;
})();

export async function renderMarkdown(markdown: string): Promise<string> {
  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(structuredTokensPlugin)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize, sanitizerSchema as any)
    .use(rehypeStringify)
    .process(markdown || "");

  return String(processed);
}

export default renderMarkdown;
