import React from "react";

interface ViewsProps {
  views: number;
}

export function Views({ views }: ViewsProps) {
  return <span className="text-zinc-400 p-0.5">{views} views</span>;
}
