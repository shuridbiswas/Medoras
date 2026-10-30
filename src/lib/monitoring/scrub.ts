import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Keeps healthcare-adjacent and credential data out of Sentry. Sentry events are for fixing
 * bugs, never for reading member content, so everything user-supplied is removed before send:
 * request bodies, cookies, auth headers, query strings, IP and email, and form values.
 */

const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-supabase-auth",
  "apikey",
  "x-api-key",
];

const SENSITIVE_KEYS =
  /pass(word)?|token|secret|authorization|cookie|api[-_]?key|session|jwt|refresh|access[-_]?token|body|content|message|bio|headline|email/i;

/** Replace the values of sensitive keys, recursively, without mutating the input. */
export function redactObject(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactObject(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.test(key) ? "[redacted]" : redactObject(v, depth + 1);
  }
  return out;
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  void _hint;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    // The path is useful; the query string can carry names, search terms and tokens.
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
    delete event.request.query_string;
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.includes(name.toLowerCase()))
          event.request.headers[name] = "[redacted]";
      }
    }
  }

  // Keep only an opaque member id, never email, name, username or IP.
  if (event.user) {
    event.user = event.user.id ? { id: String(event.user.id) } : undefined;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.category === "console" ? "[console message removed]" : b.message,
      data: b.data ? (redactObject(b.data) as typeof b.data) : b.data,
    }));
  }

  if (event.extra) event.extra = redactObject(event.extra) as typeof event.extra;
  if (event.contexts)
    event.contexts = redactObject(event.contexts) as typeof event.contexts;

  return event;
}
