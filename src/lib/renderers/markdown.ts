import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

import structuredTokensPlugin from "../remark/structured-tokens";

export async function renderMarkdown(markdown: string): Promise<string> {
  const processed = await remark()
    .use(remarkGfm)
    .use(structuredTokensPlugin)
    .use(remarkHtml)
    .process(markdown || "");

  return String(processed);
}

export default renderMarkdown;
