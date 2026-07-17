"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin"
import { $generateNodesFromSerializedNodes, $insertGeneratedNodes } from "@lexical/clipboard"
import { $setBlocksType } from "@lexical/selection"
import { TRANSFORMERS } from "@lexical/markdown"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text"
import { ListNode, ListItemNode } from "@lexical/list"
import { CodeNode, CodeHighlightNode } from "@lexical/code"
import { LinkNode } from "@lexical/link"
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown"
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  PASTE_COMMAND,
  PASTE_TAG,
  SELECTION_CHANGE_COMMAND,
  createEditor,
  mergeRegister,
  type EditorState,
  type LexicalEditor as LexicalEditorInstance,
  type SerializedLexicalNode,
  type TextFormatType,
} from "lexical"
import { ToolbarPlugin } from "./ToolbarPlugin"
import { IMAGE_TRANSFORMER, ImageNode } from "./ImageNode"

const MARKDOWN_TRANSFORMERS = [IMAGE_TRANSFORMER, ...TRANSFORMERS]
const EDITOR_NODES = [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode, ImageNode]
const MARKDOWN_PASTE_PATTERN =
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|\|.+\|)|!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|(\*\*|__)[\s\S]+?\3|(^|[^`])`[^`\n]+`/m

type SerializedClipboardNode = SerializedLexicalNode & {
  children?: SerializedClipboardNode[]
}

type SerializedMarkdownImportState = {
  root: {
    children: SerializedClipboardNode[]
  }
}

type FloatingToolbarState = {
  visible: boolean
  top: number
  left: number
  bold: boolean
  italic: boolean
  code: boolean
}

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
  imageUploadEndpoint?: string
  imageAssetsEndpoint?: string
  allowImageAssetLibrary?: boolean
  allowImages?: boolean
  onChangeDelayMs?: number
  editorRef?: MutableRefObject<LexicalEditorInstance | null>
}

export function readMarkdownFromEditor(editor: LexicalEditorInstance) {
  let markdown = ""
  editor.getEditorState().read(() => {
    markdown = $convertToMarkdownString(MARKDOWN_TRANSFORMERS).trim()
  })
  return markdown
}

function EditorRefPlugin({ editorRef }: { editorRef?: MutableRefObject<LexicalEditorInstance | null> }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!editorRef) return
    editorRef.current = editor
    return () => {
      if (editorRef.current === editor) editorRef.current = null
    }
  }, [editor, editorRef])

  return null
}

function markdownToSerializedNodes(markdown: string): SerializedClipboardNode[] {
  const importEditor = createEditor({
    namespace: "MarkdownPasteImport",
    nodes: EDITOR_NODES,
    onError: (error: Error) => console.error(error),
  })
  let serializedNodes: SerializedClipboardNode[] = []

  importEditor.update(
    () => {
      $convertFromMarkdownString(markdown, MARKDOWN_TRANSFORMERS)
    },
    { discrete: true }
  )
  serializedNodes = (importEditor.getEditorState().toJSON() as SerializedMarkdownImportState).root.children

  return serializedNodes
}

function MarkdownPastePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!("clipboardData" in event)) return false

        const markdown = event.clipboardData?.getData("text/plain")
        if (!markdown || !MARKDOWN_PASTE_PATTERN.test(markdown)) return false

        const serializedNodes = markdownToSerializedNodes(markdown)
        if (serializedNodes.length === 0) return false

        event.preventDefault()

        editor.update(
          () => {
            const selection = $getSelection()
            if (!selection) return

            const nodes = $generateNodesFromSerializedNodes(serializedNodes)
            $insertGeneratedNodes(editor, nodes, selection)
          },
          { tag: PASTE_TAG }
        )

        return true
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor])

  return null
}

function FloatingSelectionToolbarPlugin() {
  const [editor] = useLexicalComposerContext()
  const [toolbar, setToolbar] = useState<FloatingToolbarState>({
    visible: false,
    top: 0,
    left: 0,
    bold: false,
    italic: false,
    code: false,
  })

  const updateToolbar = useCallback(() => {
    const rootElement = editor.getRootElement()
    const domSelection = window.getSelection()

    editor.getEditorState().read(() => {
      const selection = $getSelection()
      const anchorNode = domSelection?.anchorNode
      const focusNode = domSelection?.focusNode

      if (
        !rootElement ||
        !domSelection ||
        domSelection.rangeCount === 0 ||
        !anchorNode ||
        !focusNode ||
        !rootElement.contains(anchorNode) ||
        !rootElement.contains(focusNode) ||
        !$isRangeSelection(selection) ||
        selection.isCollapsed()
      ) {
        setToolbar((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      const range = domSelection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        setToolbar((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      setToolbar({
        visible: true,
        top: Math.max(12, rect.top - 48),
        left: Math.min(Math.max(12, rect.left + rect.width / 2), window.innerWidth - 12),
        bold: selection.hasFormat("bold"),
        italic: selection.hasFormat("italic"),
        code: selection.hasFormat("code"),
      })
    })
  }, [editor])

  useEffect(() => {
    const handleWindowChange = () => updateToolbar()
    window.addEventListener("resize", handleWindowChange)
    window.addEventListener("scroll", handleWindowChange, true)

    return mergeRegister(
      editor.registerUpdateListener(() => updateToolbar()),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar()
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      () => {
        window.removeEventListener("resize", handleWindowChange)
        window.removeEventListener("scroll", handleWindowChange, true)
      }
    )
  }, [editor, updateToolbar])

  function formatText(format: TextFormatType) {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
    requestAnimationFrame(updateToolbar)
  }

  function formatHeading(level: "h1" | "h2" | "h3") {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(level))
      }
    })
    requestAnimationFrame(updateToolbar)
  }

  function formatQuote() {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode())
      }
    })
    requestAnimationFrame(updateToolbar)
  }

  if (!toolbar.visible) return null

  const buttonClass =
    "grid h-8 min-w-8 place-items-center rounded-md px-2 text-[11px] font-semibold text-neutral-200 transition hover:bg-white/10 hover:text-white"
  const activeButtonClass = "bg-white text-neutral-950 hover:bg-white hover:text-neutral-950"

  return (
    <div
      className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-white/10 bg-neutral-950/95 p-1 shadow-xl shadow-black/30 backdrop-blur"
      style={{ top: toolbar.top, left: toolbar.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        title="Negrito"
        onClick={() => formatText("bold")}
        className={`${buttonClass} ${toolbar.bold ? activeButtonClass : ""}`}
      >
        B
      </button>
      <button
        type="button"
        title="Itálico"
        onClick={() => formatText("italic")}
        className={`${buttonClass} ${toolbar.italic ? activeButtonClass : ""}`}
      >
        <i>I</i>
      </button>
      <button
        type="button"
        title="Código inline"
        onClick={() => formatText("code")}
        className={`${buttonClass} ${toolbar.code ? activeButtonClass : ""}`}
      >
        {"<>"}
      </button>
      <span className="mx-1 h-5 w-px bg-white/10" />
      <button type="button" title="Título 1" onClick={() => formatHeading("h1")} className={buttonClass}>
        H1
      </button>
      <button type="button" title="Título 2" onClick={() => formatHeading("h2")} className={buttonClass}>
        H2
      </button>
      <button type="button" title="Título 3" onClick={() => formatHeading("h3")} className={buttonClass}>
        H3
      </button>
      <button type="button" title="Citação" onClick={formatQuote} className={buttonClass}>
        &quot;
      </button>
    </div>
  )
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
  imageUploadEndpoint,
  imageAssetsEndpoint,
  allowImageAssetLibrary,
  allowImages = true,
  onChangeDelayMs = 0,
  editorRef,
}: Props) {
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current)
    }
  }, [])

  const initialConfig = useMemo(() => ({
    namespace,
    theme,
    nodes: EDITOR_NODES,
    onError: (error: Error) => console.error(error),
    editorState: initialMarkdown
      ? () => $convertFromMarkdownString(initialMarkdown, MARKDOWN_TRANSFORMERS)
      : undefined,
  }), [initialMarkdown, namespace])

  const handleChange = useCallback(
    (state: EditorState) => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current)

      const emitChange = () => {
        state.read(() => {
          onChange($convertToMarkdownString(MARKDOWN_TRANSFORMERS).trim())
        })
      }

      if (onChangeDelayMs > 0) {
        changeTimerRef.current = setTimeout(() => {
          changeTimerRef.current = null
          emitChange()
        }, onChangeDelayMs)
        return
      }

      emitChange()
    },
    [onChange, onChangeDelayMs]
  )

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <EditorRefPlugin editorRef={editorRef} />
      {toolbarPlacement === "top" && (
        <ToolbarPlugin
          variant={toolbarVariant}
          placement="top"
          imageUploadEndpoint={imageUploadEndpoint}
          imageAssetsEndpoint={imageAssetsEndpoint}
          allowImageAssetLibrary={allowImageAssetLibrary}
          allowImages={allowImages}
        />
      )}
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
        <MarkdownPastePlugin />
        <FloatingSelectionToolbarPlugin />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
      </div>
      {toolbarPlacement === "bottom" && (
        <ToolbarPlugin
          variant={toolbarVariant}
          placement="bottom"
          imageUploadEndpoint={imageUploadEndpoint}
          imageAssetsEndpoint={imageAssetsEndpoint}
          allowImageAssetLibrary={allowImageAssetLibrary}
          allowImages={allowImages}
        />
      )}
    </LexicalComposer>
  )
}
