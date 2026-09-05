import { useCallback, useEffect, useRef, useState } from "react";

import { classifyError, type ErrorKind } from "../lib/errors";

export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;

  /** Plain-language message, safe to show a customer. Null when fine. */
  error: string | null;

  /** Lets callers escalate our-side failures to the full-page notice. */
  errorKind: ErrorKind | null;

  reload: () => void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Runs an async loader and tracks its state.
 *
 * Aborts on unmount and on dependency change, and ignores results from
 * a stale run, so switching filters quickly can never render the
 * response of a superseded request.
 *
 * Every failure is classified and converted to customer-safe wording
 * here, so no page can accidentally print a status code or an internal
 * identifier on screen.
 */
export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  fallbackMessage = "We could not load this just now.",
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /* Keeping the loader in a ref avoids re-running on every render. */
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    setIsLoading(true);
    setError(null);
    setErrorKind(null);

    loaderRef
      .current(controller.signal)
      .then((value) => {
        if (isCurrent) {
          setData(value);
        }
      })
      .catch((requestError: unknown) => {
        if (!isCurrent || isAbortError(requestError)) {
          return;
        }

        /* Developer detail stays in the console, never on screen. */
        console.error("Data load failed:", requestError);

        const classified = classifyError(requestError);

        setErrorKind(classified.kind);
        setError(
          classified.kind === "service" ? fallbackMessage : classified.message,
        );
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken, fallbackMessage]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { data, isLoading, error, errorKind, reload };
}
