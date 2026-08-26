import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BODY_LIMITS,
  BodyNotJsonError,
  BodyTooLargeError,
  readJsonBody,
} from "../src/lib/backend/request-body";
import { contactRequestSchema, dealerApplicationSchema } from "../src/lib/backend/schemas";

/**
 * Body caps and schema bounds on the public write endpoints.
 *
 * These endpoints are unauthenticated and write through service-role paths, so
 * the size bound is the only thing standing between a caller and an
 * arbitrarily large row.
 */

function jsonRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("bounded JSON body reader", () => {
  it("reads a normal payload", async () => {
    const body = JSON.stringify({ name: "Avery", email: "a@example.com" });
    const parsed = await readJsonBody<{ name: string }>(jsonRequest(body), BODY_LIMITS.form);
    assert.equal(parsed.name, "Avery");
  });

  it("rejects a payload over the cap", async () => {
    const body = JSON.stringify({ message: "x".repeat(BODY_LIMITS.form) });
    await assert.rejects(
      () => readJsonBody(jsonRequest(body), BODY_LIMITS.form),
      BodyTooLargeError
    );
  });

  it("rejects on a declared Content-Length over the cap without reading the body", async () => {
    // The cheap path: refuse before allocating anything.
    const request = jsonRequest("{}", { "content-length": String(BODY_LIMITS.form + 1) });
    await assert.rejects(() => readJsonBody(request, BODY_LIMITS.form), BodyTooLargeError);
  });

  it("still rejects when Content-Length understates the real body", async () => {
    // Content-Length is caller-supplied and can lie. The streaming cap is what
    // actually bounds memory, so a truthful-looking header must not get a large
    // body past the limit.
    const body = JSON.stringify({ message: "x".repeat(BODY_LIMITS.tiny * 4) });
    const request = jsonRequest(body, { "content-length": "10" });
    await assert.rejects(() => readJsonBody(request, BODY_LIMITS.tiny), BodyTooLargeError);
  });

  it("counts bytes, not characters", async () => {
    // A multi-byte payload is larger than its character count suggests; a
    // length check on the string would let roughly 3x the cap through.
    const multibyte = "。".repeat(BODY_LIMITS.tiny); // 3 bytes each in UTF-8
    assert.ok(multibyte.length < BODY_LIMITS.tiny * 2);
    await assert.rejects(
      () => readJsonBody(jsonRequest(JSON.stringify({ m: multibyte })), BODY_LIMITS.tiny),
      BodyTooLargeError
    );
  });

  it("distinguishes malformed JSON from an oversized body", async () => {
    await assert.rejects(
      () => readJsonBody(jsonRequest("{not json"), BODY_LIMITS.form),
      BodyNotJsonError
    );
  });
});

describe("public form schemas are bounded", () => {
  const validContact = {
    topic: "Order help",
    name: "Avery Stocke",
    email: "avery@example.com",
    message: "Do you stock a 3 ton A2L condenser?",
  };

  it("accepts a normal contact request", () => {
    assert.doesNotThrow(() => contactRequestSchema.parse(validContact));
  });

  it("rejects an unbounded contact message", () => {
    assert.throws(() =>
      contactRequestSchema.parse({ ...validContact, message: "x".repeat(5001) })
    );
  });

  it("rejects an unbounded contact name and topic", () => {
    assert.throws(() => contactRequestSchema.parse({ ...validContact, name: "x".repeat(121) }));
    assert.throws(() => contactRequestSchema.parse({ ...validContact, topic: "x".repeat(121) }));
  });

  const validDealer = {
    company: "Bay Area Mechanical",
    contactName: "Avery Stocke",
    email: "avery@example.com",
    phone: "4159884445",
  };

  it("accepts a normal dealer application", () => {
    assert.doesNotThrow(() => dealerApplicationSchema.parse(validDealer));
  });

  it("rejects unbounded dealer fields", () => {
    assert.throws(() =>
      dealerApplicationSchema.parse({ ...validDealer, company: "x".repeat(201) })
    );
    assert.throws(() =>
      dealerApplicationSchema.parse({ ...validDealer, notes: "x".repeat(5001) })
    );
    assert.throws(() =>
      dealerApplicationSchema.parse({ ...validDealer, serviceArea: "x".repeat(501) })
    );
  });
});
