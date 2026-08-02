import Anthropic from "@anthropic-ai/sdk";
import { buildChatSystemPrompt, logChatMessage } from "@/lib/backend/chat";
import { SITE } from "@/lib/site";

/**
 * Streaming AI chat. Plain-text streaming response (the widget reads the body
 * incrementally). Grounded system prompt is assembled per request from the
 * live catalog; a cache_control breakpoint keeps repeat turns cheap.
 * Without ANTHROPIC_API_KEY the route degrades to a canned handoff message.
 */

export const maxDuration = 60;

const MAX_TURNS = 12;
const MAX_MESSAGE_CHARS = 2000;

/* Simple per-instance rate limit: 20 requests/minute per IP. */
const hits = new Map<string, { count: number; windowStart: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > 20;
}

const OFFLINE_MESSAGE = `Our AI assistant is offline right now. For instant help, call or text ${SITE.phone} (${SITE.hours}) — texting is fastest during business hours.`;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return new Response("Too many messages — give it a minute, or call us.", { status: 429 });
  }

  let sessionId = "";
  let history: { role: "user" | "assistant"; content: string }[] = [];
  try {
    const body = await request.json();
    sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : "anon";
    if (!Array.isArray(body.messages)) throw new Error("messages required");
    history = body.messages
      .filter(
        (m: { role?: string; content?: string }) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      )
      .slice(-MAX_TURNS)
      .map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role,
        content: m.content.slice(0, MAX_MESSAGE_CHARS),
      }));
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      throw new Error("last message must be from the user");
    }
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Bad request" },
      { status: 400 }
    );
  }

  const lastUser = history[history.length - 1].content;
  void logChatMessage(sessionId, "user", lastUser);

  if (!process.env.ANTHROPIC_API_KEY) {
    // Keyless fallback: the widget still gives the buyer a real path forward.
    void logChatMessage(sessionId, "assistant", OFFLINE_MESSAGE);
    return new Response(OFFLINE_MESSAGE, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Chat-Mode": "offline" },
    });
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();
  let assistantText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const messageStream = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 1024,
          // Retail chat: latency matters more than depth; low effort keeps
          // replies snappy while the grounded prompt carries the facts.
          output_config: { effort: "low" },
          system: [
            {
              type: "text",
              text: buildChatSystemPrompt(),
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: history,
        });
        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            assistantText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await messageStream.finalMessage();
        if (final.stop_reason === "refusal" && assistantText.length === 0) {
          const msg = `I can't help with that one — call or text ${SITE.phone} and a human will.`;
          assistantText = msg;
          controller.enqueue(encoder.encode(msg));
        }
      } catch (error) {
        console.error("chat stream failed:", error);
        if (assistantText.length === 0) {
          controller.enqueue(encoder.encode(OFFLINE_MESSAGE));
          assistantText = OFFLINE_MESSAGE;
        }
      } finally {
        void logChatMessage(sessionId, "assistant", assistantText);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
