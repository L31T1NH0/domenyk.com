"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { CLEAR_EDITOR_COMMAND, EditorState } from "lexical";

const theme = {
  paragraph: "mb-1 leading-relaxed text-[15px] text-zinc-100",
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

export default function LexicalEditor({
  value,
  onChange,
  onFocusChange,
}: LexicalEditorProps) {
  const initialValueRef = useRef(value);
  const initialConfig = useMemo(
    () => ({
      namespace: "post-editor",
      theme,
      onError: (error: Error) => {
        console.error(error);
      },
      editorState: initialValueRef.current || undefined,
    }),
    []
  );

  const handleChange = useCallback(
    (editorState: EditorState) => {
      const json = editorState.toJSON();
      onChange(JSON.stringify(json));
    },
    [onChange]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-[#0b0d12] via-[#0d1016] to-[#0a0c11] shadow-[0_30px_80px_-60px_rgba(0,0,0,0.9)]">
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
        <HistoryPlugin />
        <AutoFocusPlugin />
        <OnChangePlugin onChange={handleChange} />
        <ResetOnEmpty value={value} />
      </div>
    </LexicalComposer>
  );
}
