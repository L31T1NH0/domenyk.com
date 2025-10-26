import { useMemo } from "react";

export const STANDARD_COMMENT_MAX_LENGTH = 120;
export const PARAGRAPH_COMMENT_MAX_LENGTH = 480;

type Gender = "m" | "f";

export type CommentLengthState = {
  /** Original value including unnormalized line endings. */
  value: string;
  /** Normalized value using only \n line endings. */
  normalizedValue: string;
  /** Current character count. */
  length: number;
  /** Characters remaining before reaching the limit. */
  remaining: number;
  /** Characters exceeding the limit (0 when within the limit). */
  overLimit: number;
  /** Indicates whether the value exceeds the limit. */
  isOverLimit: boolean;
  /** Index where the overflow begins. */
  splitIndex: number;
  /** Portion of the text within the limit. */
  baseText: string;
  /** Portion of the text beyond the limit. */
  overflowText: string;
  /** Preformatted helper message to display alongside the counter. */
  message: string;
};

const normalizeValue = (value: string): string =>
  value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

export const getCommentLengthState = (
  value: string,
  maxLength: number
): CommentLengthState => {
  const normalizedValue = normalizeValue(value);
  const length = normalizedValue.length;
  const splitIndex = Math.min(length, maxLength);
  const baseText = normalizedValue.slice(0, splitIndex);
  const overflowText = normalizedValue.slice(splitIndex);
  const remaining = maxLength - length;
  const overLimit = Math.max(0, -remaining);
  const isOverLimit = overLimit > 0;
  const message = isOverLimit
    ? `+${overLimit} caracteres acima do limite`
    : `${length}/${maxLength}`;

  return {
    value,
    normalizedValue,
    length,
    remaining,
    overLimit,
    isOverLimit,
    splitIndex,
    baseText,
    overflowText,
    message,
  };
};

export const useCommentLength = (
  value: string,
  maxLength: number
): CommentLengthState => useMemo(() => getCommentLengthState(value, maxLength), [value, maxLength]);

export const buildLengthErrorMessage = (
  maxLength: number,
  noun: string,
  gender: Gender = "m"
): string => {
  const article = gender === "f" ? "A" : "O";
  return `${article} ${noun} deve ter no máximo ${maxLength} caracteres.`;
};
