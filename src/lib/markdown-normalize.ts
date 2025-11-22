export function normalizeMarkdownContent(markdown: string): string {
  if (typeof markdown !== "string") {
    return "";
  }

  const trimmed = markdown.trim();
  const fencePattern = /^```(?:[a-zA-Z0-9+-]*)?\r?\n([\s\S]*?)\r?\n```$/;
  const match = trimmed.match(fencePattern);

  if (match) {
    return match[1];
  }

  return markdown;
}
