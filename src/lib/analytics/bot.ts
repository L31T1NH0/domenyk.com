const BOT_USER_AGENT_PATTERN = /(bot|crawler|spider|crawling|facebookexternalhit|slurp|pingdom|preview|insights)/i;

const DISALLOWED_PREFIXES = ["axios/", "node-fetch/"];

export function isLikelyBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    return false;
  }

  const value = userAgent.trim();
  if (!value) {
    return false;
  }

  if (BOT_USER_AGENT_PATTERN.test(value)) {
    return true;
  }

  return DISALLOWED_PREFIXES.some((prefix) => value.startsWith(prefix));
}
