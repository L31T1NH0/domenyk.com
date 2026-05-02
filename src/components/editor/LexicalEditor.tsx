"use client"

import { useCallback } from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin"
import { TRANSFORMERS } from "@lexical/markdown"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { ListNode, ListItemNode } from "@lexical/list"
import { CodeNode, CodeHighlightNode } from "@lexical/code"
import { LinkNode } from "@lexical/link"
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown"
import { type EditorState } from "lexical"
import { ToolbarPlugin } from "./ToolbarPlugin"
import { IMAGE_TRANSFORMER, ImageNode } from "./ImageNode"
import { ImagePlugin } from "./ImagePlugin"

const MARKDOWN_TRANSFORMERS = [IMAGE_TRANSFORMER, ...TRANSFORMERS]

const theme = {
  heading: {
    h1: "text-2xl font-bold mt-6 mb-2",
    h2: "text-xl font-semibold mt-5 mb-2",
    h3: "text-lg font-medium mt-4 mb-1",
  },
  quote: "border-l-4 border-neutral-300 dark:border-neutral-600 pl-4 italic text-neutral-500",
  code: "block bg-neutral-100 dark:bg-neutral-800 rounded p-3 text-sm font-mono overflow-x-auto",
  text: {
    bold: "font-bold",
    italic: "italic",
    code: "font-mono bg-neutral-100 dark:bg-neutral-800 px-1 rounded text-sm",
  },
  list: {
    ul: "list-disc list-inside my-2",
    ol: "list-decimal list-inside my-2",
    listitem: "my-0.5",
  },
  link: "underline text-blue-600 dark:text-blue-400",
}

type Props = {
  initialMarkdown?: string
  onChange: (markdown: string) => void
  namespace?: string
  placeholder?: string
  editorClassName?: string
  shellClassName?: string
  toolbarVariant?: "default" | "compact"
  toolbarPlacement?: "top" | "bottom"
}

export function LexicalEditor({
  initialMarkdown,
  onChange,
  namespace = "PostEditor",
  placeholder = "Escreva o post aqui...",
  editorClassName = "min-h-64",
  shellClassName = "min-h-64 p-4",
  toolbarVariant = "default",
  toolbarPlacement = "top",
}: Props) {
  const initialConfig = {
    namespace,
    theme,
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode, ImageNode],
    onError: (error: Error) => console.error(error),
    editorState: initialMarkdown
      ? () => $convertFromMarkdownString(initialMarkdown, MARKDOWN_TRANSFORMERS)
      : undefined,
  }

  const handleChange = useCallback(
    (state: EditorState) => {
      state.read(() => {
        onChange($convertToMarkdownString(MARKDOWN_TRANSFORMERS).trim())
      })
    },
    [onChange]
  )

  return (
    <LexicalComposer initialConfig={initialConfig}>
      {toolbarPlacement === "top" && <ToolbarPlugin variant={toolbarVariant} />}
      <div className={`relative ${shellClassName}`}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable className={`outline-none text-sm leading-relaxed focus:outline-none ${editorClassName}`} />
          }
          placeholder={
            <div className="absolute top-4 left-4 text-neutral-400 text-sm pointer-events-none select-none">
              {placeholder}
            </div>
          }
          ErrorBoundary={({ children }) => <>{children}</>}
        />
        <HistoryPlugin />
        <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
        <OnChangePlugin onChange={handleChange} />
        <ImagePlugin />
      </div>
      {toolbarPlacement === "bottom" && <ToolbarPlugin variant={toolbarVariant} />}
    </LexicalComposer>
  )
}
