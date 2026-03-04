import useSWR from "swr";

type SummaryItem = { paragraphId: string; count: number };

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("summary fetch failed");
    return res.json() as Promise<SummaryItem[]>;
  });

export function useCommentsSummary(postId: string) {
  const { data } = useSWR<SummaryItem[]>(
    `/api/posts/${postId}/paragraph-comments/summary`,
    fetcher,
    { dedupingInterval: 30_000, revalidateOnFocus: false }
  );

  const summaryMap = new Map<string, number>();
  if (data) {
    for (const item of data) {
      summaryMap.set(item.paragraphId, item.count);
    }
  }

  return summaryMap;
}
