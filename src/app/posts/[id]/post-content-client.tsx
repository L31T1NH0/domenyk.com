"use client";

import {
  forwardRef,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type HTMLAttributes,
  type ComponentType,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Date } from "@components/date";
import ShareButton from "@components/ShareButton";
import AudioPlayer from "@components/AudioPlayer";
import parse, {
  DOMNode,
  Element,
  attributesToProps,
  domToReact,
  type HTMLReactParserOptions,
} from "html-react-parser";
import PostReference from "@components/PostReference";
import AutorReference from "@components/AutorReference";
import PostMinimap from "@components/PostMinimap";
import { EyeIcon, ClockIcon } from "@heroicons/react/24/solid";

type ParagraphCommentWidgetProps = {
  postId: string;
  paragraphId: string;
  paragraphIndex: number;
  coAuthorUserId?: string | null;
  paragraphProps?: HTMLAttributes<HTMLParagraphElement>;
  children: ReactNode;
  isAdmin: boolean;
  isMobile: boolean;
};

type ParagraphCommentWidgetComponent = ComponentType<ParagraphCommentWidgetProps>;

type ParagraphContentProps = {
  paragraphProps?: HTMLAttributes<HTMLParagraphElement>;
  children: ReactNode;
  showLoadingIndicator?: boolean;
  onLoadRequest?: () => void;
};

const ParagraphContent = forwardRef<HTMLParagraphElement, ParagraphContentProps>(
  ({ paragraphProps, children, showLoadingIndicator = false, onLoadRequest }, ref) => {
    const {
      className,
      onClick,
      onFocus,
      onFocusCapture,
      onMouseEnter,
      onPointerDown,
      ...rest
    } = paragraphProps ?? {};

    const requestLoad = useCallback(() => {
      onLoadRequest?.();
    }, [onLoadRequest]);

    const handleClick = useCallback(
      (event: ReactMouseEvent<HTMLParagraphElement>) => {
        onClick?.(event);
        requestLoad();
      },
      [onClick, requestLoad]
    );

    const handleFocus = useCallback(
      (event: ReactFocusEvent<HTMLParagraphElement>) => {
        onFocus?.(event);
        requestLoad();
      },
      [onFocus, requestLoad]
    );

    const handleFocusCapture = useCallback(
      (event: ReactFocusEvent<HTMLParagraphElement>) => {
        onFocusCapture?.(event);
        requestLoad();
      },
      [onFocusCapture, requestLoad]
    );

    const handleMouseEnter = useCallback(
      (event: ReactMouseEvent<HTMLParagraphElement>) => {
        onMouseEnter?.(event);
        requestLoad();
      },
      [onMouseEnter, requestLoad]
    );

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLParagraphElement>) => {
        onPointerDown?.(event);
        requestLoad();
      },
      [onPointerDown, requestLoad]
    );

    const combinedClassName = [
      className,
      showLoadingIndicator ? "opacity-80" : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <p
        {...rest}
        ref={ref}
        className={combinedClassName}
        onClick={handleClick}
        onFocus={handleFocus}
        onFocusCapture={handleFocusCapture}
        onMouseEnter={handleMouseEnter}
        onPointerDown={handlePointerDown}
      >
        {children}
        {showLoadingIndicator ? (
          <span className="ml-2 text-xs text-zinc-400">Carregando comentários…</span>
        ) : null}
      </p>
    );
  }
);

ParagraphContent.displayName = "ParagraphContent";

function LazyParagraphCommentWidget(props: ParagraphCommentWidgetProps) {
  const [shouldRenderWidget, setShouldRenderWidget] = useState(false);
  const [Widget, setWidget] = useState<ParagraphCommentWidgetComponent | null>(null);
  const placeholderRef = useRef<HTMLParagraphElement | null>(null);

  const ensureWidget = useCallback(() => {
    setShouldRenderWidget((previous) => (previous ? previous : true));
  }, []);

  useEffect(() => {
    if (!shouldRenderWidget || Widget) {
      return;
    }

    let isActive = true;

    import("@components/paragraph-comments/ParagraphCommentWidget")
      .then((module) => {
        if (isActive) {
          setWidget(() => module.default as ParagraphCommentWidgetComponent);
        }
      })
      .catch((error) => {
        console.error("Failed to load paragraph comment widget", error);
      });

    return () => {
      isActive = false;
    };
  }, [shouldRenderWidget, Widget]);

  useEffect(() => {
    if (shouldRenderWidget) {
      return;
    }

    const element = placeholderRef.current;
    if (!element || typeof window === "undefined" || !("IntersectionObserver" in window)) {
      ensureWidget();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            ensureWidget();
          }
        });
      },
      {
        rootMargin: "200px 0px",
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ensureWidget, shouldRenderWidget]);

  if (!shouldRenderWidget) {
    return (
      <ParagraphContent
        ref={placeholderRef}
        paragraphProps={props.paragraphProps}
        onLoadRequest={ensureWidget}
      >
        {props.children}
      </ParagraphContent>
    );
  }

  if (!Widget) {
    return (
      <ParagraphContent
        paragraphProps={props.paragraphProps}
        showLoadingIndicator
        onLoadRequest={ensureWidget}
      >
        {props.children}
      </ParagraphContent>
    );
  }

  return <Widget {...props} />;
}

const IsMobileContext = createContext<boolean | null>(null);

export function useIsMobile(): boolean {
  const context = useContext(IsMobileContext);
  if (context === null) {
    throw new Error("useIsMobile must be used within an IsMobileContext provider");
  }
  return context;
}

type PostContentClientProps = {
  postId: string;
  date: string;
  htmlContent: string;
  initialViews: number;
  audioUrl?: string;
  readingTime: string;
  coAuthorUserId?: string | null;
  coAuthorImageUrl?: string | null;
  paragraphCommentsEnabled: boolean;
  isAdmin: boolean;
};

export default function PostContentClient({
  postId,
  date,
  htmlContent,
  initialViews,
  audioUrl,
  readingTime,
  coAuthorUserId,
  coAuthorImageUrl,
  paragraphCommentsEnabled,
  isAdmin,
}: PostContentClientProps) {
  const [views, setViews] = useState(initialViews);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    const trackView = async () => {
      try {
        const response = await fetch(`/api/posts/${postId}`);
        if (!response.ok) {
          return;
        }
        const { views } = await response.json();
        if (!canceled && typeof views === "number") {
          setViews(views);
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

    const parserOptions: HTMLReactParserOptions = {};

    parserOptions.replace = (node: DOMNode) => {
      if (node.type === "tag" && node.name === "span") {
        const element = node as Element;
        const role = element.attribs?.["data-role"] ?? element.attribs?.dataRole;
        if (role === "post-reference") {
          const slug = element.attribs?.["data-slug"] ?? element.attribs?.dataSlug;
          if (typeof slug === "string" && slug.trim() !== "") {
            return <PostReference slug={slug} />;
          }
        }
        if (role === "author-reference") {
          const kind = (element.attribs?.["data-kind"] ?? element.attribs?.dataKind) as string | undefined;
          if (kind === "author") {
            return <AutorReference kind="author" />;
          }
          if (kind === "co-author") {
            return <AutorReference kind="co-author" coAuthorImageUrl={coAuthorImageUrl ?? null} />;
          }
        }
      }

      if (node.type === "tag" && node.name === "p" && paragraphCommentsEnabled) {
        const element = node as Element;
        const paragraphId = `${postId}-paragraph-${paragraphIndex}`;
        const currentIndex = paragraphIndex;
        paragraphIndex += 1;

        const paragraphProps = attributesToProps(element.attribs ?? {}) as HTMLAttributes<HTMLParagraphElement>;
        const enhancedParagraphProps: HTMLAttributes<HTMLParagraphElement> = {
          ...paragraphProps,
          className: [
            (paragraphProps as any)?.className,
            "transition-colors rounded-md -mx-2 px-2 py-0.5 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/60",
          ]
            .filter(Boolean)
            .join(" "),
        };

        return (
          <LazyParagraphCommentWidget
            key={paragraphId}
            postId={postId}
            paragraphId={paragraphId}
            paragraphIndex={currentIndex}
            coAuthorUserId={coAuthorUserId}
            paragraphProps={enhancedParagraphProps}
            isAdmin={isAdmin}
            isMobile={isMobile}
          >
            {domToReact((element.children ?? []) as DOMNode[], parserOptions)}
          </LazyParagraphCommentWidget>
        );
      }

      if (node.type === "tag" && node.name === "p" && !paragraphCommentsEnabled) {
        const element = node as Element;
        const pProps = attributesToProps(element.attribs ?? {}) as HTMLAttributes<HTMLParagraphElement>;
        const className = [
          (pProps as any)?.className,
          "transition-colors rounded-md -mx-2 px-2 py-0.5 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/60",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <p {...pProps} className={className}>
            {domToReact((element.children ?? []) as DOMNode[], parserOptions)}
          </p>
        );
      }

      return undefined;
    };

    return parse(htmlContent, parserOptions);
  }, [
    coAuthorUserId,
    htmlContent,
    isAdmin,
    isMobile,
    paragraphCommentsEnabled,
    postId,
  ]);

  return (
    <IsMobileContext.Provider value={isMobile}>
      <div className="relative flex flex-col gap-6">
        <article className="flex flex-col gap-6 mt-4">
          <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-3">
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
              <div className="flex items-center gap-2 min-w-0 whitespace-normal sm:whitespace-nowrap">
                <Date dateString={date} />
                <span aria-hidden className="mx-1 text-zinc-400">|</span>
                <div className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Tempo de leitura:</span>
                    {readingTime}
                  </span>
                  <span aria-hidden className="mx-1 text-zinc-400">•</span>
                  <span className="inline-flex items-center gap-1">
                    <EyeIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Views:</span>
                    {views} views
                  </span>
                </div>
              </div>

              <span className="justify-self-end">
                <ShareButton id={postId} />
              </span>
            </div>
          </div>

          {audioUrl && <AudioPlayer audioUrl={audioUrl} />}

          <div data-post-content className="flex flex-col gap-4 lg:text-lg sm:text-sm max-sm:text-xs">
            {parsedContent}
          </div>

          {/* <Chatbot htmlContent={htmlContent} /> */}
        </article>
      </div>
      <PostMinimap />
    </IsMobileContext.Provider>
  );
}
