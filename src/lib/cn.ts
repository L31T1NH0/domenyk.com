export type ClassValue =
  | string
  | number
  | null
  | undefined
  | boolean
  | ClassValue[]
  | { [key: string]: ClassValue | boolean };

function stringify(value: ClassValue): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stringify).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, v]) => Boolean(v))
      .map(([key]) => key)
      .join(" ");
  }
  return "";
}

export function cn(...inputs: ClassValue[]): string {
  return inputs.map(stringify).filter(Boolean).join(" ");
}
