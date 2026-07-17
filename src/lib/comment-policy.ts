export const MIN_COMMENT_ACCOUNT_AGE_MS = 60 * 60 * 1000

export type CommentAccountPolicyInput = {
  admin: boolean
  emailVerified: boolean
  createdAt: Date
}

export type CommentAccountPolicyResult =
  | { allowed: true; newAccount: boolean }
  | { allowed: false; reason: "email_unverified" | "account_too_new" }

export function commentAccountPolicy(
  input: CommentAccountPolicyInput,
  now = Date.now()
): CommentAccountPolicyResult {
  if (input.admin) return { allowed: true, newAccount: false }
  if (!input.emailVerified) return { allowed: false, reason: "email_unverified" }

  const ageMs = Math.max(0, now - input.createdAt.getTime())
  if (ageMs < MIN_COMMENT_ACCOUNT_AGE_MS) {
    return { allowed: false, reason: "account_too_new" }
  }

  return { allowed: true, newAccount: ageMs < 24 * 60 * 60 * 1000 }
}
