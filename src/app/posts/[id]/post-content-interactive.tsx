"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FocusEvent as ReactFocusEvent,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Date } from "@components/date";
import ShareButton from "@components/ShareButton";
import AudioPlayer from "@components/AudioPlayer";
import PostMinimap from "@components/PostMinimap";
import { EyeIcon, ClockIcon } from "@heroicons/react/24/solid";

export type ParagraphCommentWidgetProps = {
  postId: string;
  paragraphId: string;
  paragraphIndex: number;
  coAuthorUserId?: string | null;
  paragraphProps?: HTMLAttributes<HTMLParagraphElement>;
  children: ReactNode;
  isAdmin: boolean;
  isMobile: boolean;
};

export type ParagraphCommentWidgetComponent = ComponentType<ParagraphCommentWidgetProps>;

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
      [onClick, requestLoad],
    );

    const handleFocus = useCallback(
      (event: ReactFocusEvent<HTMLParagraphElement>) => {
        onFocus?.(event);
        requestLoad();
      },
      [onFocus, requestLoad],
    );

    const handleFocusCapture = useCallback(
      (event: ReactFocusEvent<HTMLParagraphElement>) => {
        onFocusCapture?.(event);
        requestLoad();
      },
      [onFocusCapture, requestLoad],
    );

    const handleMouseEnter = useCallback(
      (event: ReactMouseEvent<HTMLParagraphElement>) => {
        onMouseEnter?.(event);
        requestLoad();
      },
      [onMouseEnter, requestLoad],
    );

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLParagraphElement>) => {
        onPointerDown?.(event);
        requestLoad();
      },
      [onPointerDown, requestLoad],
    );

    const combinedClassName = [className, showLoadingIndicator ? "opacity-80" : null]
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
  },
);

ParagraphContent.displayName = "ParagraphContent";

export function LazyParagraphCommentWidget(props: ParagraphCommentWidgetProps) {
  const [shouldRenderWidget, setShouldRenderWidget] = useState(false);
  const [Widget, setWidget] = useState<ParagraphCommentWidgetComponent | null>(null);
  const placeholderRef = useRef<HTMLParagraphElement | null>(null);
  const contextIsMobile = useContext(IsMobileContext);
  const { isMobile: propIsMobile, ...restProps } = props;
  const isMobile = (contextIsMobile ?? propIsMobile) ?? false;

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
      },
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

  return <Widget {...restProps} isMobile={isMobile} />;
}

const IsMobileContext = createContext<boolean | null>(null);

export function useIsMobile(): boolean {
  const context = useContext(IsMobileContext);
  if (context === null) {
    throw new Error("useIsMobile must be used within an IsMobileContext provider");
  }
  return context;
}

type PostContentShellProps = {
  postId: string;
  date: string;
  readingTime: string;
  initialViews: number;
  audioUrl?: string;
  children: ReactNode;
  disableViewTracking?: boolean;
  hideShareButton?: boolean;
  secondaryHeaderSlot?: ReactNode;
};

export default function PostContentShell({
  postId,
  date,
  readingTime,
  initialViews,
  audioUrl,
  children,
  disableViewTracking = false,
  hideShareButton = false,
  secondaryHeaderSlot,
}: PostContentShellProps) {
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
    if (disableViewTracking) {
      return () => {};
    }

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
  }, [disableViewTracking, postId]);

  const headerCounters = useMemo(
    () => (
      <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-3">
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
          <div className="flex items-center gap-2 min-w-0 whitespace-normal sm:whitespace-nowrap">
            <Date dateString={date} />
            <span aria-hidden className="mx-1 text-zinc-400">
              |
            </span>
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
            {!hideShareButton && <ShareButton id={postId} />}
          </span>
        </div>
      </div>
    ),
    [date, hideShareButton, postId, readingTime, views],
  );

  return (
    <IsMobileContext.Provider value={isMobile}>
      <div className="relative flex flex-col gap-6">
        <article className="flex flex-col gap-6 mt-4">
          {headerCounters}

          {secondaryHeaderSlot}

          {audioUrl && <AudioPlayer audioUrl={audioUrl} />}

          <div data-post-content className="flex flex-col gap-4 lg:text-lg sm:text-sm max-sm:text-xs">
            {children}
          </div>

          {/* <Chatbot htmlContent={htmlContent} /> */}
        </article>
      </div>
      <PostMinimap />
    </IsMobileContext.Provider>
  );
}
