"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.json !== undefined ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    credentials: "same-origin",
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : response.statusText;
    throw new Error(message);
  }
  return data as T;
}

/**
 * Minimal polling fetcher: loads `path` on mount and every `intervalMs`.
 * Keeps the last good value on transient errors.
 */
export function usePoll<T>(path: string | null, intervalMs = 5000, initial?: T) {
  const [data, setData] = useState<T | undefined>(initial);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(initial === undefined);
  const pathRef = useRef(path);
  pathRef.current = path;

  const refresh = useCallback(async () => {
    const current = pathRef.current;
    if (!current) return;
    try {
      const next = await api<T>(current);
      if (pathRef.current === current) {
        setData(next);
        setError(undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!path) return;
    void refresh();
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [path, intervalMs, refresh]);

  return { data, error, loading, refresh, setData };
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const fmt = (n: number, unit: string) => (future ? `in ${n}${unit}` : `${n}${unit} ago`);
  if (abs < 45_000) return future ? "in a moment" : "just now";
  if (abs < 3_600_000) return fmt(Math.round(abs / 60_000), "m");
  if (abs < 86_400_000) return fmt(Math.round(abs / 3_600_000), "h");
  return fmt(Math.round(abs / 86_400_000), "d");
}
