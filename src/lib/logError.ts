/**
 * AI Datasheet Analyzer
 * Author: Arshia Keshvari (@TeslaNeuro)
 * License: MIT
 *
 * Lightweight error logging — console output always, and in development a
 * POST to Vite's /__client-error middleware so failures appear in the
 * terminal as well.
 */
export interface ErrorPayload {
  context: string;
  message?: string;
  stack?: string;
  extra?: Record<string, unknown>;
  time: string;
}

function toPayload(
  context: string,
  error?: unknown,
  extra?: Record<string, unknown>,
): ErrorPayload {
  const message =
    error instanceof Error
      ? error.message
      : error != null
        ? String(error)
        : undefined;
  const stack = error instanceof Error ? error.stack : undefined;
  return { context, message, stack, extra, time: new Date().toISOString() };
}

/** Log an error to the browser console and, in dev, forward it to the Vite terminal. */
export function logError(
  context: string,
  error?: unknown,
  extra?: Record<string, unknown>,
): void {
  const payload = toPayload(context, error, extra);

  console.error(`[${payload.context}]`, payload.message ?? "(no message)");
  if (payload.extra && Object.keys(payload.extra).length > 0) {
    console.error("  details:", payload.extra);
  }
  if (payload.stack) {
    console.error(payload.stack);
  }

  if (import.meta.env.DEV) {
    void fetch("/__client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      /* dev middleware unavailable (e.g. static preview) */
    });
  }
}

export function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    logError("uncaught error", event.error ?? event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logError("unhandled promise rejection", event.reason);
  });
}
