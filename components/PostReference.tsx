"use client";

import { useEffect, useMemo, useState } from "react";

type PostReferenceMetadata = {
  postId: string;
  title: string;
  date: string;
  thumbnailUrl: string | null;
};

type PostReferenceProps = {
  slug: string;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: PostReferenceMetadata }
  | { status: "error" };

function formatDate(value: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
    }).format(parsed);
  } catch {
    return parsed.toISOString().split("T")[0] ?? null;
  }
}

export default function PostReference({ slug }: PostReferenceProps) {
  const [state, setState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    let canceled = false;

    const fetchMetadata = async () => {
      setState({ status: "loading" });

      try {
        const response = await fetch(
          `/api/post-references/${encodeURIComponent(slug)}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`Post reference not found for slug: ${slug}`);
          } else {
            console.warn(
              `Post reference lookup failed for slug: ${slug} (status ${response.status})`
            );
          }

          if (!canceled) {
            setState({ status: "error" });
          }
          return;
        }

        const data = (await response.json()) as PostReferenceMetadata;

        if (!canceled) {
          setState({ status: "loaded", data });
        }
      } catch (error) {
        console.warn(`Post reference request failed for slug: ${slug}`, error);
        if (!canceled) {
          setState({ status: "error" });
        }
      }
    };

    fetchMetadata();

    return () => {
      canceled = true;
    };
  }, [slug]);

  const formattedDate = useMemo(() => {
    if (state.status !== "loaded") {
      return null;
    }

    return formatDate(state.data.date);
  }, [state]);

  const truncatedTitle = useMemo(() => {
    if (state.status !== "loaded") return null;
    const title = state.data.title ?? "";
    const limit = 30;
    if (title.length <= limit) return title;
    return title.slice(0, limit - 1) + "…";
  }, [state]);

  const commonProps = {
    "data-role": "post-reference",
    "data-slug": slug,
    className:
      "inline-flex flex-row items-center gap-2 rounded-md border border-zinc-700/60 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200",
  } as const;

  if (state.status !== "loaded") {
    return (
      <span {...commonProps}>
        <span className="text-zinc-400">
          {state.status === "error" ? "Post não encontrado" : "Carregando..."}
        </span>
      </span>
    );
  }

  const { data } = state;
  const href = `/posts/${data.postId}`;

  return (
    <span {...commonProps}>
      <a
        href={href}
        className="flex items-center gap-2 text-zinc-100 hover:text-white"
      >
        {data.thumbnailUrl ? (
          <span className="h-10 w-10 overflow-hidden rounded-sm bg-zinc-800">
            <img
              src={data.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover reference grayscale-0"
            />
          </span>
        ) : null}
        <span className="flex flex-col leading-tight">
          <span className="font-medium" title={data.title}>
            {truncatedTitle}
          </span>
          {formattedDate ? (
            <time dateTime={data.date} className="text-xs text-zinc-400">
              {formattedDate}
            </time>
          ) : null}
        </span>
      </a>
    </span>
  );
}
