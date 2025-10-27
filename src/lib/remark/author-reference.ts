import { visit } from "unist-util-visit";
import type { Plugin } from "unified";

type MdastNode = {
  type: string;
  value?: string;
  name?: string;
  children?: MdastNode[];
  attributes?: Array<{
    type: string;
    name?: string;
    value?: string | null;
  }>;
};

type Paragraph = MdastNode & { children?: MdastNode[] };
type Text = MdastNode & { value: string };

const AUTHOR_TOKEN_PATTERN = /@autor|@co-autor/g;

const authorReferencePlugin: Plugin<[], MdastNode> = () => {
  return (tree: MdastNode) => {
    visit(tree, "paragraph", (paragraph: Paragraph, _index, parent: MdastNode | undefined) => {
      if (parent && parent.type === "blockquote") {
        return;
      }

      const children = paragraph.children ?? [];
      const nextChildren: MdastNode[] = [];
      let hasChanges = false;

      for (const child of children) {
        if (child.type !== "text" || typeof child.value !== "string") {
          nextChildren.push(child);
          continue;
        }

        const textChild = child as Text;
        const { value } = textChild;
        const segments: MdastNode[] = [];
        let lastIndex = 0;
        let replaced = false;
        const matcher = new RegExp(AUTHOR_TOKEN_PATTERN.source, AUTHOR_TOKEN_PATTERN.flags);
        let match: RegExpExecArray | null;

        while ((match = matcher.exec(value)) !== null) {
          const [fullMatch] = match;
          const matchIndex = match.index ?? 0;

          if (matchIndex > lastIndex) {
            segments.push({ type: "text", value: value.slice(lastIndex, matchIndex) });
          }

          const kind = fullMatch === "@co-autor" ? "co-author" : "author";

          segments.push({
            type: "mdxJsxTextElement",
            name: "AutorReference",
            attributes: [
              {
                type: "mdxJsxAttribute",
                name: "kind",
                value: kind,
              },
            ],
            children: [],
          });

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

export default authorReferencePlugin;

