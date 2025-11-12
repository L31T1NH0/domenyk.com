import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";

import PostReference from "../components/PostReference";

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const originalFetch = global.fetch;
const originalWarn = console.warn;

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  console.warn = originalWarn;
});

test("renders metadata when lookup succeeds", async () => {
  const metadata = {
    postId: "meu-post",
    title: "Meu Post",
    subtitle: "Resumo do post",
    date: "2024-01-01T00:00:00.000Z",
    thumbnailUrl: "https://example.com/thumb.jpg",
  };

  global.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => metadata,
    } as MockResponse) as unknown as typeof fetch;

  let renderer: ReturnType<typeof create> | null = null;

  await act(async () => {
    renderer = create(<PostReference slug="meu-post" />);
  });

  await flushEffects();
  await flushEffects();

  const root = renderer!.root;
  const link = root.findByType("a");
  assert.equal(link.props.href, "/posts/meu-post");

  const titleNode = root.find(
    (node) => node.type === "span" && node.props.className?.includes("font-medium")
  );
  assert.equal(titleNode.props.children, metadata.title);

  const subtitleNode = root.find(
    (node) => node.type === "span" && node.props.title === metadata.subtitle
  );
  assert.equal(subtitleNode.props.children, metadata.subtitle);

  const timeNode = root.findByType("time");
  assert.equal(timeNode.props.dateTime, metadata.date);
});

test("shows fallback message when the lookup fails", async () => {
  let warningCount = 0;
  console.warn = () => {
    warningCount += 1;
  };

  global.fetch = async () =>
    ({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    } as MockResponse) as unknown as typeof fetch;

  let renderer: ReturnType<typeof create> | null = null;

  await act(async () => {
    renderer = create(<PostReference slug="desconhecido" />);
  });

  await flushEffects();
  await flushEffects();

  const root = renderer!.root;
  const statusNode = root.find(
    (node) => node.type === "span" && node.props.className === "text-zinc-400"
  );

  assert.equal(statusNode.props.children, "Post não encontrado");
  assert.ok(warningCount > 0);
});
