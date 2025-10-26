import React, { forwardRef, useMemo, useRef } from "react";

import {
  CommentLengthState,
  getCommentLengthState,
} from "./lengthUtils";

type LimitedTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value"
> & {
  value: string;
  maxLength: number;
  lengthState?: CommentLengthState;
  /**
   * Additional classes for the overlay container that renders the text preview.
   * Useful to tweak padding or text styles without altering the textarea classes.
   */
  overlayClassName?: string;
  /**
   * Classes applied to the overlay text that sits within the limit.
   */
  displayClassName?: string;
  /**
   * Classes applied to the overlay text that exceeds the limit.
   */
  overflowDisplayClassName?: string;
};

const combine = (...classes: Array<string | undefined | false>): string =>
  classes.filter(Boolean).join(" ");

const LimitedTextarea = forwardRef<HTMLTextAreaElement, LimitedTextareaProps>(
  (
    {
      value,
      maxLength,
      lengthState: externalLengthState,
      className,
      overlayClassName,
      displayClassName,
      overflowDisplayClassName,
      onScroll,
      disabled,
      ...rest
    },
    ref
  ) => {
    const lengthState = useMemo(
      () => externalLengthState ?? getCommentLengthState(value, maxLength),
      [externalLengthState, value, maxLength]
    );

    const overlayRef = useRef<HTMLDivElement | null>(null);

    const handleScroll: React.UIEventHandler<HTMLTextAreaElement> = (event) => {
      if (overlayRef.current) {
        overlayRef.current.scrollTop = event.currentTarget.scrollTop;
        overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
      }
      if (onScroll) {
        onScroll(event);
      }
    };

    const textareaClasses = combine(
      className,
      "relative z-10 text-transparent caret-zinc-800 dark:caret-zinc-100"
    );

    const overlayClasses = combine(
      "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2",
      displayClassName ?? "text-sm text-zinc-800 dark:text-zinc-100",
      overlayClassName,
      disabled && "opacity-60"
    );

    const overflowClasses =
      overflowDisplayClassName ?? "text-red-500 dark:text-red-400";

    return (
      <div className="relative">
        <textarea
          {...rest}
          ref={ref}
          value={value}
          onScroll={handleScroll}
          className={textareaClasses}
          disabled={disabled}
        />
        <div
          aria-hidden="true"
          ref={overlayRef}
          className={overlayClasses}
          style={{
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
            fontWeight: "inherit",
          }}
        >
          {lengthState.baseText}
          {lengthState.overflowText && (
            <span className={overflowClasses}>{lengthState.overflowText}</span>
          )}
          {"\u200b"}
        </div>
      </div>
    );
  }
);

LimitedTextarea.displayName = "LimitedTextarea";

export default LimitedTextarea;
