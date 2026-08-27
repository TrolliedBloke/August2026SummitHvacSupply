/**
 * Size-bounded JSON body reader for public endpoints.
 *
 * Deliberately NOT marked `server-only`, for the same reason as rate-limit.ts:
 * that specifier does not resolve in the unit test runner, and this is a
 * security control that should be directly testable. It holds no secrets.
 *
 * `await request.json()` buffers whatever it is handed. On an unauthenticated
 * endpoint that is an easy way to make the server allocate megabytes per
 * request, and on the ones that write to Postgres it is also an easy way to
 * push a very large row into a jsonb or text column.
 *
 * The Content-Length header is checked first because it rejects the honest
 * case for free, but it is caller-supplied and can lie, so the body is then
 * read in chunks and abandoned the moment it crosses the cap. That is the part
 * that actually bounds memory.
 */

/** Body exceeded the caller's byte budget. Handlers map this to HTTP 413. */
export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = "BodyTooLargeError";
  }
}

/** Body was within budget but was not valid JSON. Handlers map this to 400. */
export class BodyNotJsonError extends Error {
  constructor() {
    super("Request body is not valid JSON");
    this.name = "BodyNotJsonError";
  }
}

/**
 * Byte budgets by shape of payload. Generous enough that no legitimate
 * submission is refused, small enough that abuse is bounded.
 */
export const BODY_LIMITS = {
  /** email + a SKU id */
  tiny: 2_000,
  /** a contact form: name, email, topic, a message */
  form: 16_000,
  /** a dealer application: the above plus licence, service area, notes */
  application: 32_000,
} as const;

export async function readJsonBody<T = unknown>(
  request: Request,
  maxBytes: number
): Promise<T> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BodyTooLargeError(maxBytes);
  }

  const raw = await readBoundedText(request, maxBytes);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new BodyNotJsonError();
  }
}

async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  const reader = request.body?.getReader();

  // No stream available (some test and runtime shims). Fall back to text() and
  // measure after the fact -- weaker, but still refuses to parse an oversized
  // payload, and the Content-Length check above has already run.
  if (!reader) {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      throw new BodyTooLargeError(maxBytes);
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // Stop pulling. Without this the sender decides how much we allocate.
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
