export const UPPERCASE_MAX_RATIO = 0.45; // 45%

export type UppercaseState = {
  totalLetters: number;
  uppercase: number;
  ratio: number; // 0..1
  isOverLimit: boolean;
};

export const getUppercaseState = (
  value: string,
  maxRatio: number = UPPERCASE_MAX_RATIO
): UppercaseState => {
  const letters = value.match(/\p{L}/gu) ?? [];
  const uppers = value.match(/\p{Lu}/gu) ?? [];
  const totalLetters = letters.length;
  const uppercase = uppers.length;
  const ratio = totalLetters > 0 ? uppercase / totalLetters : 0;
  return { totalLetters, uppercase, ratio, isOverLimit: ratio > maxRatio };
};

export const buildUppercaseErrorMessage = (
  value: string,
  maxRatio: number = UPPERCASE_MAX_RATIO
): string => {
  const { ratio } = getUppercaseState(value, maxRatio);
  const used = Math.round(ratio * 100);
  const limit = Math.round(maxRatio * 100);
  return `Use menos letras maiúsculas (${used}% do total). Limite: ${limit}%.`;
};

