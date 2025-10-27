import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { PropertyDefinition, Schema } from "hast-util-sanitize/lib/index.js";
import rehypeStringify from "rehype-stringify";
import { find, html as htmlSchema } from "property-information";
import { visit } from "unist-util-visit";

import postReferencePlugin from "../remark/post-reference";

type MdxJsxAttribute = {
  type: string;
  name?: string;
  value?: string | null | { type: string; value?: string };
};

type MdastNode = {
  type: string;
  value?: string;
  data?: {
    estree?: {
      body?: Array<{ type?: string }>;
    };
  };
  name?: string;
  attributes?: MdxJsxAttribute[];
  children?: MdastNode[];
};

const sanitizerSchema = (() => {
  const schema: Schema = structuredClone(defaultSchema) as Schema;

  schema.clobberPrefix = "";

  const tagNames = new Set(schema.tagNames ?? []);
  [
    "section",
    "article",
    "figure",
    "figcaption",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "span",
    "time",
  ].forEach((tag) => tagNames.add(tag));
  schema.tagNames = Array.from(tagNames);

  schema.attributes = {
    ...schema.attributes,
    "*": [
      ...((schema.attributes?.["*"] as Array<PropertyDefinition>) ?? []),
      "className",
      "id",
      "data*",
      "data-role",
      "dataRole",
      "aria-label",
      "ariaLabel",
    ],
    a: [
      ...((schema.attributes?.a as Array<PropertyDefinition>) ?? []),
      "href",
      "target",
      "rel",
      "title",
      "className",
    ],
    code: [
      ...((schema.attributes?.code as Array<PropertyDefinition>) ?? []),
      "className",
    ],
    pre: [
      ...((schema.attributes?.pre as Array<PropertyDefinition>) ?? []),
      "className",
    ],
    img: [
      ...((schema.attributes?.img as Array<PropertyDefinition>) ?? []),
      "src",
      "srcSet",
      "alt",
      "title",
      "width",
      "height",
      "loading",
      "decoding",
    ],
    span: [
      ...((schema.attributes?.span as Array<PropertyDefinition>) ?? []),
      "className",
      "dataRole",
      "data*",
    ],
    time: [
      ...((schema.attributes?.time as Array<PropertyDefinition>) ?? []),
      "dateTime",
    ],
  };

  schema.strip = Array.from(new Set([...(schema.strip ?? []), "script", "style"]));

  return schema;
})();

function disallowMdxImports() {
  return (tree: MdastNode) => {
    visit(tree, "mdxjsEsm", (node: MdastNode) => {
      const statements = node.data?.estree?.body ?? [];
      const hasImport = statements.some((statement) => statement?.type === "ImportDeclaration");

      if (hasImport || (typeof node.value === "string" && /\bimport\b/.test(node.value))) {
        throw new Error("MDX component imports are not supported in blog posts.");
      }
    });

    visit(tree, ["mdxFlowExpression", "mdxTextExpression"], () => {
      throw new Error("MDX expressions are not supported in blog posts.");
    });
  };
}

function isPostReferencesFeatureEnabled() {
  return process.env.FEATURE_POST_REFERENCES === "true";
}

function mdxJsxElementHandler(state: any, node: MdastNode) {
  if (!node.name) {
    return state.all(node);
  }

  const featureEnabled = isPostReferencesFeatureEnabled();

  if (node.name === "PostReference") {
    if (!featureEnabled) {
      throw new Error("MDX components are not supported in blog posts.");
    }

    let slug: string | undefined;

    for (const attribute of node.attributes ?? []) {
      if (attribute.type !== "mdxJsxAttribute" || !attribute.name) {
        throw new Error("MDX attribute expressions are not supported in blog posts.");
      }

      if (attribute.name !== "slug") {
        throw new Error("PostReference only supports the slug attribute.");
      }

      if (typeof attribute.value !== "string" || attribute.value.trim() === "") {
        throw new Error("PostReference slug must be a non-empty string.");
      }

      slug = attribute.value;
    }

    if (!slug) {
      throw new Error("PostReference slug attribute is required.");
    }

    const result = {
      type: "element",
      tagName: "span",
      properties: {
        "data-role": "post-reference",
        "data-slug": slug,
      },
      children: [],
    };

    state.patch(node, result);
    return state.applyData(node, result);
  }

  if (!/^[a-z][\w:-]*$/.test(node.name)) {
    throw new Error("MDX components are not supported in blog posts.");
  }

  const properties: Record<string, unknown> = {};

  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== "mdxJsxAttribute" || !attribute.name) {
      throw new Error("MDX attribute expressions are not supported in blog posts.");
    }

    const info = find(htmlSchema, attribute.name);
    const propertyName = info.property || attribute.name;

    if (attribute.value === null || attribute.value === undefined) {
      properties[propertyName] = true;
      continue;
    }

    if (typeof attribute.value === "string") {
      properties[propertyName] = attribute.value;
      continue;
    }

    throw new Error("MDX attribute expressions are not supported in blog posts.");
  }

  const result = {
    type: "element",
    tagName: node.name,
    properties,
    children: state.all(node),
  };

  state.patch(node, result);
  return state.applyData(node, result);
}

export async function renderPostMdx(markdown: string): Promise<string> {
  const enablePostReferences = isPostReferencesFeatureEnabled();

  const processor = unified().use(remarkParse).use(remarkMdx);

  if (enablePostReferences) {
    processor.use(postReferencePlugin);
  }

  processor
    .use(disallowMdxImports)
    .use(remarkGfm)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      handlers: {
        mdxJsxFlowElement: mdxJsxElementHandler,
        mdxJsxTextElement: mdxJsxElementHandler,
      },
    })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeSanitize, sanitizerSchema)
    .use(rehypeStringify);

  const file = await processor.process(markdown);

  return String(file.value);
}

export default renderPostMdx;
