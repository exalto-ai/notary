import { useCallback, useEffect, useRef, useState } from 'react';

type Page<T> = { items: T[]; next_cursor?: string | null };
type Load<T> = (options: { limit?: number; cursor?: string }) => Promise<Page<T>>;

export type PagedList<T> = {
  /** null until the first page answers, so a wait is never an empty list. */
  items: T[] | null;
  error: string | null;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
  /** Replace one item in place after it has been changed on the server. */
  replace: (match: (item: T) => boolean, next: T) => void;
  remove: (match: (item: T) => boolean) => void;
};

function message(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

/**
 * A cursor-paginated list. Every reload takes a generation, so a slow first
 * page can never land on top of a newer one.
 */
export function usePagedList<T>(load: Load<T>, fallback: string, limit = 20): PagedList<T> {
  const [items, setItems] = useState<T[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const current = generation.current + 1;
    generation.current = current;
    try {
      const page = await load({ limit });
      if (generation.current !== current) return;
      setItems(page.items);
      setCursor(page.next_cursor ?? null);
      setError(null);
    } catch (reason) {
      if (generation.current !== current) return;
      setError(message(reason, fallback));
    }
  }, [load, fallback, limit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    const current = generation.current;
    setLoadingMore(true);
    try {
      const page = await load({ limit, cursor });
      if (generation.current !== current) return;
      setItems((existing) => [...(existing ?? []), ...page.items]);
      setCursor(page.next_cursor ?? null);
    } catch (reason) {
      if (generation.current === current) setError(message(reason, fallback));
    } finally {
      if (generation.current === current) setLoadingMore(false);
    }
  }, [cursor, load, loadingMore, fallback, limit]);

  return {
    items,
    error,
    loadingMore,
    hasMore: cursor !== null,
    loadMore,
    reload,
    replace: (match, next) =>
      setItems((existing) =>
        existing ? existing.map((item) => (match(item) ? next : item)) : existing,
      ),
    remove: (match) =>
      setItems((existing) => (existing ? existing.filter((item) => !match(item)) : existing)),
  };
}
