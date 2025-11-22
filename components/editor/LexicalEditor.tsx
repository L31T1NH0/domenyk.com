"use client";

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import {
  CLEAR_EDITOR_COMMAND,
  COMMAND_PRIORITY_LOW,
  EditorState,
  LexicalEditor as LexicalEditorType,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
  SELECTION_CHANGE_COMMAND,
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
} from "lexical";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { LinkNode } from "@lexical/link";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import {
  HeadingNode,
  QuoteNode,
  $createHeadingNode,
  $createQuoteNode,
} from "@lexical/rich-text";
import { CodeNode, $createCodeNode } from "@lexical/code";
import { mergeRegister } from "@lexical/utils";

const theme = {
  paragraph: "mb-1 leading-relaxed text-[15px] text-zinc-100",
  quote:
    "my-3 border-l-2 border-emerald-500/40 pl-3 text-[15px] text-zinc-200 italic",
  list: {
    listitem: "ml-4 text-[15px] text-zinc-100 marker:text-emerald-400",
  },
  heading: {
    h1: "text-2xl font-semibold text-zinc-50",
    h2: "text-xl font-semibold text-zinc-100",
    h3: "text-lg font-semibold text-zinc-100",
  },
  text: {
    bold: "font-semibold text-zinc-50",
    italic: "italic text-zinc-100",
    underline: "underline decoration-emerald-500/60",
    strikethrough: "line-through text-zinc-400",
    code: "rounded bg-zinc-900 px-1 py-0.5 font-mono text-emerald-200",
  },
};

const Placeholder = () => (
  <div className="pointer-events-none absolute left-4 top-4 select-none text-sm text-zinc-600">
    Comece a escrever…
  </div>
);

interface LexicalEditorProps {
  value: string;
  onChange: (value: string) => void;
  onFocusChange?: (isFocused: boolean) => void;
  appearance?: "panel" | "inline";
}

const ToolbarButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-300 transition hover:bg-white/5 hover:text-emerald-200"
  >
    {label}
  </button>
);

function Toolbar() {
  const [editor] = useLexicalComposerContext();

  const formatHeading = useCallback(
    () =>
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getTopLevelElementOrThrow();
        if (element.getType() === "heading") {
          const paragraph = $createParagraphNode();
          paragraph.append(...element.getChildren());
          element.replace(paragraph);
        } else {
          const heading = $createHeadingNode("h2");
          heading.append(...element.getChildren());
          element.replace(heading);
        }
      }),
    [editor]
  );

  const toggleList = useCallback(() => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const toggleQuote = useCallback(
    () =>
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getTopLevelElementOrThrow();
        if (element.getType() === "quote") {
          const paragraph = $createParagraphNode();
          paragraph.append(...element.getChildren());
          element.replace(paragraph);
        } else {
          const quote = $createQuoteNode();
          quote.append(...element.getChildren());
          element.replace(quote);
        }
      }),
    [editor]
  );

  const toggleCode = useCallback(
    () =>
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getTopLevelElementOrThrow();
        if (element.getType() === "code") {
          const paragraph = $createParagraphNode();
          paragraph.append(...element.getChildren());
          element.replace(paragraph);
        } else {
          const code = $createCodeNode();
          code.append(...element.getChildren());
          element.replace(code);
        }
      }),
    [editor]
  );

  const toggleLink = useCallback(() => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-white/[0.04] px-3 py-2 text-xs shadow-inner shadow-black/40">
      <ToolbarButton
        label="Bold"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      />
      <ToolbarButton
        label="Italic"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      />
      <ToolbarButton label="Heading" onClick={formatHeading} />
      <ToolbarButton label="Lista" onClick={toggleList} />
      <ToolbarButton label="Code" onClick={toggleCode} />
      <ToolbarButton label="Quote" onClick={toggleQuote} />
      <ToolbarButton label="Link" onClick={toggleLink} />
    </div>
  );
}

type SlashOption = {
  label: string;
  token: string;
};

function SlashMenu({
  onInsert,
}: {
  onInsert: (label: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const insertText = useCallback(
    (text: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(text);
        }
      });
    },
    [editor]
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event.key === "/") {
            setIsOpen(true);
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              setAnchorRect(selection.getRangeAt(0).getBoundingClientRect());
            }
          } else if (event.key === "Escape") {
            setIsOpen(false);
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            setAnchorRect(selection.getRangeAt(0).getBoundingClientRect());
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || selection.isCollapsed() === false) return;
          const anchorNode = selection.anchor.getNode();
          const textContent = anchorNode.getTextContent();
          if (!textContent.endsWith("/")) {
            setIsOpen(false);
          }
        });
      })
    );
  }, [editor]);

  const options: SlashOption[] = [
    { label: "@autor", token: "@autor" },
    { label: "@co-autor", token: "@co-autor" },
    { label: "Referência de post", token: "@post(slug-do-post)" },
  ];

  if (!isOpen || !anchorRect) return null;

  return (
    <div
      className="fixed z-20 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#0d1118] p-2 shadow-2xl shadow-black/50"
      style={{ top: anchorRect.bottom + 6, left: anchorRect.left }}
    >
      {options.map((option) => (
        <button
          key={option.token}
          type="button"
          onClick={() => {
            insertText(option.token + " ");
            onInsert(option.token);
            setIsOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/5 hover:text-emerald-200"
        >
          <span className="text-emerald-300">/</span> {option.label}
        </button>
      ))}
    </div>
  );
}

function ResetOnEmpty({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (value === "") {
      editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
    }
  }, [editor, value]);

  return null;
}

function MarkdownHydrationPlugin({
  value,
  lastMarkdownRef,
  hasUserEditedRef,
  isApplyingExternalRef,
}: {
  value: string;
  lastMarkdownRef: MutableRefObject<string>;
  hasUserEditedRef: MutableRefObject<boolean>;
  isApplyingExternalRef: MutableRefObject<boolean>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (value === lastMarkdownRef.current) return;

    if (value === "") {
      hasUserEditedRef.current = false;
    }

    const shouldHydrate = value === "" || !hasUserEditedRef.current;

    if (!shouldHydrate) {
      return;
    }

    isApplyingExternalRef.current = true;
    lastMarkdownRef.current = value;

    editor.update(() => {
      $getRoot().clear();
      $convertFromMarkdownString(value, TRANSFORMERS);
    });
  }, [editor, hasUserEditedRef, isApplyingExternalRef, lastMarkdownRef, value]);

  return null;
}

export default function LexicalEditor({
  value,
  onChange,
  onFocusChange,
  appearance = "panel",
}: LexicalEditorProps) {
  const handleSlashInsert = useCallback(() => {
    // No-op placeholder for future telemetry
  }, []);
  const initialValueRef = useRef(value);
  const lastMarkdownRef = useRef(value);
  const isApplyingExternalRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const initialConfig = useMemo(
    () => ({
      namespace: "post-editor",
      theme,
      onError: (error: Error) => {
        console.error(error);
      },
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, LinkNode],
      editorState: (editor: LexicalEditorType) => {
        const markdown = initialValueRef.current;
        if (!markdown) return;
        editor.update(() => {
          $convertFromMarkdownString(markdown, TRANSFORMERS);
        });
      },
    }),
    []
  );

  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const markdown = $convertToMarkdownString(TRANSFORMERS);
        lastMarkdownRef.current = markdown;

        if (isApplyingExternalRef.current) {
          isApplyingExternalRef.current = false;
          return;
        }

        hasUserEditedRef.current = true;
        onChange(markdown);
      });
    },
    [onChange]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={[
          "relative overflow-hidden",
          appearance === "panel"
            ? "rounded-2xl border border-white/5 bg-gradient-to-b from-[#0b0d12] via-[#0d1016] to-[#0a0c11] shadow-[0_30px_80px_-60px_rgba(0,0,0,0.9)]"
            : "rounded-xl border border-white/10 bg-transparent backdrop-blur",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="border-b border-white/5 px-4 pb-3 pt-4">
          <Toolbar />
        </div>
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className='min-h-[350px] w-full bg-transparent px-4 pb-6 pt-4 text-base leading-relaxed text-zinc-100 caret-emerald-400 focus:outline-none font-["IAWriterQuattroV-Italic",serif]'
                aria-label="Área principal de conteúdo"
                spellCheck={false}
                onFocus={() => onFocusChange?.(true)}
                onBlur={() => onFocusChange?.(false)}
              />
            }
            placeholder={<Placeholder />}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <SlashMenu onInsert={handleSlashInsert} />
        </div>
        <HistoryPlugin />
        <AutoFocusPlugin />
        <ListPlugin />
        <LinkPlugin />
        <OnChangePlugin onChange={handleChange} />
        <ResetOnEmpty value={value} />
        <MarkdownHydrationPlugin
          value={value}
          lastMarkdownRef={lastMarkdownRef}
          hasUserEditedRef={hasUserEditedRef}
          isApplyingExternalRef={isApplyingExternalRef}
        />
      </div>
    </LexicalComposer>
  );
}
