import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/backend/events";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";

/**
 * First-party analytics beacon: public, unauthenticated, and it writes a row
 * through a service-role path on every call.
 *
 * recordEvent already constrains `name` to /^[a-z0-9_-]{2,48}$/, but `metadata`
 * went into a jsonb column exactly as supplied. Unbounded, that is both a way
 * to pollute the analytics staff read and a way to make the database store
 * arbitrary caller-controlled documents. This endpoint is now throttled, size
 * capped, and the metadata is flattened to a small map of short scalars.
 *
 * 60 per minute: a browsing session fires a handful of events per page, so this
 * is generous for a real visitor and still bounds a loop.
 */

/** Metadata shape limits. Analytics needs a few short facts, not a document. */
const MAX_METADATA_KEYS = 12;
const MAX_KEY_LENGTH = 40;
const MAX_VALUE_LENGTH = 200;

/**
 * One level deep, scalars only. Nested objects and arrays are dropped rather
 * than serialized: they are the part that has no natural size bound, and no
 * caller needs them.
 */
function sanitizeMetadata(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_METADATA_KEYS) break;
    if (key.length > MAX_KEY_LENGTH) continue;

    if (typeof value === "string") {
      out[key] = value.slice(0, MAX_VALUE_LENGTH);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "boolean" || value === null) {
      out[key] = value;
    }
    // objects, arrays, functions, undefined: dropped
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "events"), 60, 60);
  if (!limit.allowed) {
    // Analytics must never be worth retrying hard. No Retry-After: a beacon
    // that gives up is the correct behaviour.
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const { name, page, metadata } = await readJsonBody<{
      name?: unknown;
      page?: unknown;
      metadata?: unknown;
    }>(request, BODY_LIMITS.tiny);

    // recordEvent re-validates the name and silently drops anything malformed;
    // checking here too means a bad beacon is a 400 rather than a silent 200.
    if (typeof name !== "string" || name.length > 48) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await recordEvent(
      name,
      typeof page === "string" ? page.slice(0, 200) : null,
      sanitizeMetadata(metadata)
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }
    if (error instanceof BodyNotJsonError) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // Analytics is best-effort and must never surface as a user-facing error.
    console.warn("[api/events] failed", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
