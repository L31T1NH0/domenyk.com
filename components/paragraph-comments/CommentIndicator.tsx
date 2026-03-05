import React from "react";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";

type Props = {
  count: number;
  onClick: () => void;
  className?: string;
};

const CommentIndicator = React.memo(function CommentIndicator({
  count,
  onClick,
  className,
}: Props) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${count} comentário${count > 1 ? "s" : ""} neste parágrafo`}
      className={className ?? "inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-xs font-medium text-zinc-600 shadow-sm hover:border-zinc-400 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"}
    >
      <ChatBubbleLeftRightIcon className="h-3 w-3" />
      {count}
    </button>
  );
});

export default CommentIndicator;
