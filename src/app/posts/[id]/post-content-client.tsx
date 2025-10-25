"use client";

import { useEffect, useMemo, useState } from "react";
import { Date } from "@components/date";
import ShareButton from "@components/ShareButton";
import AudioPlayer from "@components/AudioPlayer";
import parse, {
  DOMNode,
  Element,
  attributesToProps,
  domToReact,
} from "html-react-parser";
import ParagraphCommentWidget from "@components/paragraph-comments/ParagraphCommentWidget";

type PostContentClientProps = {
  postId: string;
  date: string;
  htmlContent: string;
  initialViews: number;
  audioUrl?: string;
  readingTime: string;
  coAuthorUserId?: string | null;
};

export default function PostContentClient({
  postId,
  date,
  htmlContent,
  initialViews,
  audioUrl,
  readingTime,
  coAuthorUserId,
}: PostContentClientProps) {
  const [views, setViews] = useState(initialViews);

  useEffect(() => {
    let canceled = false;

    const trackView = async () => {
      try {
        const response = await fetch(`/api/posts/${postId}`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!canceled && typeof data.views === "number") {
          setViews(data.views);
        }
      } catch (error) {
        console.error("Failed to refresh post views", error);
      }
    };

    trackView();

    return () => {
      canceled = true;
    };
  }, [postId]);

  const parsedContent = useMemo(() => {
    if (!htmlContent) {
      return <p>Conteúdo não disponível.</p>;
    }

    let paragraphIndex = 0;

    return parse(htmlContent, {
      replace: (node: DOMNode) => {
        if (node.type === "tag" && node.name === "p") {
          const element = node as Element;
          const paragraphId = `${postId}-paragraph-${paragraphIndex}`;
          const currentIndex = paragraphIndex;
          paragraphIndex += 1;

          const paragraphProps = attributesToProps(element.attribs ?? {});

          return (
            <ParagraphCommentWidget
              key={paragraphId}
              postId={postId}
              paragraphId={paragraphId}
              paragraphIndex={currentIndex}
              coAuthorUserId={coAuthorUserId}
              paragraphProps={paragraphProps}
            >
              {domToReact((element.children ?? []) as DOMNode[])}
            </ParagraphCommentWidget>
          );
        }
        return undefined;
      },
    });
  }, [coAuthorUserId, htmlContent, postId]);

  return (
    <article className="flex flex-col gap-2">
      <div className="mb-2 flex-1">
        <div className="flex gap-2 items-center">
          <Date dateString={date} />
          <div className="flex gap-2 text-sm text-zinc-500">
            <span>• {readingTime}</span>
            <span>{views} views</span>
          </div>
        </div>
        <div className="">
          <ShareButton id={postId} />
        </div>
      </div>

      {audioUrl && <AudioPlayer audioUrl={audioUrl} />}

      <div className="flex flex-col gap-4 lg:text-lg sm:text-sm max-sm:text-xs">
        {parsedContent}
      </div>

      {/* <Chatbot htmlContent={htmlContent} /> */}
    </article>
  );
}
