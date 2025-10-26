import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveRateLimitIdentifier } from "../src/app/api/comments/[id]/rate-limit";

test("uses req.ip when available", () => {
  const headers = new Headers();
  const first = deriveRateLimitIdentifier({
    ip: "203.0.113.1",
    userId: null,
    userAgent: headers.get("user-agent"),
  });
  const second = deriveRateLimitIdentifier({
    ip: "203.0.113.1",
    userId: "user-123",
    userAgent: "custom-agent",
  });

  assert.equal(first, second);
});

test("falls back to userId when ip is missing", () => {
  const first = deriveRateLimitIdentifier({
    ip: null,
    userId: "user-456",
    userAgent: "agent",
  });
  const second = deriveRateLimitIdentifier({
    ip: undefined,
    userId: "user-456",
    userAgent: "different-agent",
  });

  assert.equal(first, second);
});

test("groups anonymous users without ip by user agent", () => {
  const identifierA = deriveRateLimitIdentifier({
    ip: null,
    userId: null,
    userAgent: "agent-a",
  });
  const identifierB = deriveRateLimitIdentifier({
    ip: null,
    userId: null,
    userAgent: "agent-a",
  });
  const identifierC = deriveRateLimitIdentifier({
    ip: null,
    userId: null,
    userAgent: "agent-b",
  });

  assert.equal(identifierA, identifierB);
  assert.notEqual(identifierA, identifierC);
});

test("anonymizes identifiers via hashing", () => {
  const identifier = deriveRateLimitIdentifier({
    ip: "198.51.100.42",
    userId: null,
    userAgent: null,
  });

  assert.match(identifier, /^[a-f0-9]{64}$/);
  assert.ok(!identifier.includes("198.51.100.42"));
});
