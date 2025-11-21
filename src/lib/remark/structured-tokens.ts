import { visit } from "unist-util-visit";
import type { Plugin } from "unified";

type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
};

type Paragraph = MdastNode & { children?: MdastNode[] };
type Text = MdastNode & { value: string };

const TOKEN_PATTERN = /@autor|@co-autor|@post\(([^)]+)\)/g;

function createStructuredSpan(value: string): string {
  if (value === "@autor") {
    return '<span data-role="author-reference" data-kind="author">@autor</span>';
  }

  if (value === "@co-autor") {
    return '<span data-role="author-reference" data-kind="co-author">@co-autor</span>';
  }

  const postMatch = value.match(/^@post\(([^)]+)\)$/);
  const slug = postMatch?.[1]?.trim();
  if (slug) {
    return `<span data-role="post-reference" data-slug="${slug}">@post(${slug})</span>`;
  }

  return value;
}

const structuredTokensPlugin: Plugin<[], MdastNode> = () => {
  return (tree: MdastNode) => {
    visit(tree, "paragraph", (paragraph: Paragraph) => {
      if (!paragraph.children || !Array.isArray(paragraph.children)) {
        return;
      }

      const nextChildren: MdastNode[] = [];
      let hasChanges = false;

      for (const child of paragraph.children) {
        if (child.type !== "text" || typeof child.value !== "string") {
          nextChildren.push(child);
          continue;
        }

        const textChild = child as Text;
        const value = textChild.value;
        const segments: MdastNode[] = [];
        let lastIndex = 0;
        let replaced = false;
        const matcher = new RegExp(TOKEN_PATTERN.source, TOKEN_PATTERN.flags);
        let match: RegExpExecArray | null;

        while ((match = matcher.exec(value)) !== null) {
          const [fullMatch] = match;
          const matchIndex = match.index ?? 0;

          if (matchIndex > lastIndex) {
            segments.push({ type: "text", value: value.slice(lastIndex, matchIndex) });
          }

          segments.push({ type: "html", value: createStructuredSpan(fullMatch) });
          lastIndex = matchIndex + fullMatch.length;
          replaced = true;
        }

        if (!replaced) {
          nextChildren.push(child);
          continue;
        }

        if (lastIndex < value.length) {
          segments.push({ type: "text", value: value.slice(lastIndex) });
        }

        hasChanges = true;
        nextChildren.push(...segments);
      }

      if (hasChanges) {
        paragraph.children = nextChildren;
      }
    });
  };
};

export default structuredTokensPlugin;
