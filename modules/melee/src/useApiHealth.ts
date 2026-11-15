import { useEffect, useState } from "react";

export type ApiHealth<T> =
  | { state: "loading" }
  | { state: "ok"; body: T }
  | { state: "error"; message: string };

/** Fetches a JSON health endpoint once, to show the Worker is reachable. */
export function useApiHealth<T>(url: string): ApiHealth<T> {
  const [health, setHealth] = useState<ApiHealth<T>>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as T;
      })
      .then(
        (body) => !cancelled && setHealth({ state: "ok", body }),
        (error: unknown) =>
          !cancelled && setHealth({ state: "error", message: String(error) }),
      );
    return () => {
      cancelled = true;
    };
  }, [url]);
  return health;
}
