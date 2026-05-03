import { useCallback, useEffect, useRef, useState } from "react";

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 400;

export interface HistoryApi<T> {
  state: T;
  set: (updater: T | ((prev: T) => T), opts?: { debounce?: boolean }) => void;
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistoryState<T>(initial: T): HistoryApi<T> {
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncePending = useRef<T | null>(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const flushDebounce = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (debouncePending.current !== null) {
      past.current.push(debouncePending.current);
      if (past.current.length > MAX_HISTORY) past.current.shift();
      future.current = [];
      debouncePending.current = null;
    }
  }, []);

  const pushPast = useCallback((prev: T) => {
    past.current.push(prev);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
  }, []);

  const set = useCallback(
    (updater: T | ((prev: T) => T), opts?: { debounce?: boolean }) => {
      setState((prev) => {
        const next =
          typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
        if (Object.is(next, prev)) return prev;
        if (opts?.debounce) {
          if (debouncePending.current === null) {
            debouncePending.current = prev;
          }
          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          debounceTimer.current = setTimeout(() => {
            if (debouncePending.current !== null) {
              past.current.push(debouncePending.current);
              if (past.current.length > MAX_HISTORY) past.current.shift();
              future.current = [];
              debouncePending.current = null;
              rerender();
            }
          }, DEBOUNCE_MS);
        } else {
          flushDebounce();
          pushPast(prev);
        }
        return next;
      });
      rerender();
    },
    [flushDebounce, pushPast, rerender],
  );

  const reset = useCallback(
    (next: T) => {
      flushDebounce();
      past.current = [];
      future.current = [];
      setState(next);
      rerender();
    },
    [flushDebounce, rerender],
  );

  const undo = useCallback(() => {
    flushDebounce();
    if (past.current.length === 0) return;
    setState((cur) => {
      const prev = past.current.pop()!;
      future.current.push(cur);
      if (future.current.length > MAX_HISTORY) future.current.shift();
      return prev;
    });
    rerender();
  }, [flushDebounce, rerender]);

  const redo = useCallback(() => {
    flushDebounce();
    if (future.current.length === 0) return;
    setState((cur) => {
      const next = future.current.pop()!;
      past.current.push(cur);
      if (past.current.length > MAX_HISTORY) past.current.shift();
      return next;
    });
    rerender();
  }, [flushDebounce, rerender]);

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  return {
    state,
    set,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0 || debouncePending.current !== null,
    canRedo: future.current.length > 0,
  };
}
