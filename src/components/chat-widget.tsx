"use client";

import Link from "next/link";
import { MessageCircle, Phone, Send, Sparkles, X } from "lucide-react";
import * as React from "react";
import { SITE } from "@/lib/site";

/**
 * AI chat widget. Honest labeling ("AI assistant") plus a first-class exit to
 * humans — the promise an AI can keep is instant answers, not empathy.
 * Streams from /api/chat; degrades to a call/text handoff without a key.
 */

type ChatMessage = { role: "user" | "assistant"; content: string };

const QUICK_STARTS = [
  "What size do I need?",
  "Is it in stock today?",
  "Who installs it?",
];

function sessionId(): string {
  const key = "summit-chat-session";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

/* Render assistant text, turning relative product links into real links. */
function AssistantText({ text }: { text: string }) {
  const parts = text.split(/(\/products\/[^\s.,;)!?]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("/products/") ? (
          <Link key={i} href={part} className="font-medium text-brand underline underline-offset-2">
            {part.split("/").pop()}
          </Link>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

export function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  // Escape to close + focus trap, matching the quote drawer. Without this the
  // panel announces itself as a dialog while leaving keyboard users unable to
  // dismiss it or stay inside it (WCAG 2.1.2).
  React.useEffect(() => {
    if (!open) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus.current?.focus();
    };
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId(), messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const current = acc;
        setMessages([...next, { role: "assistant", content: current }]);
      }
      if (acc.trim().length === 0) throw new Error("empty");
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Something went wrong on my end. Call or text ${SITE.phone} and a human will pick it up.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher — sits above the sticky mobile buy bar */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-conversion-hook="chat-open"
          aria-label="Open AI assistant chat"
          className="fixed bottom-20 right-4 z-40 flex h-13 items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-ink shadow-[var(--shadow-lg)] transition-transform hover:scale-[1.03] lg:bottom-5 lg:right-5"
        >
          <MessageCircle size={19} strokeWidth={2.2} />
          <span className="hidden sm:inline">Ask us anything</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="AI assistant chat"
          className="fixed inset-x-3 bottom-3 z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-(--r-lg) border border-line bg-canvas shadow-[var(--shadow-lg)] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[390px]"
        >
          <header className="flex items-center justify-between border-b border-line bg-surface-1 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-brand-tint text-brand">
                <Sparkles size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-1">Summit assistant</p>
                <p className="text-[11px] text-ink-3">AI assistant — instant answers, 24/7</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="grid size-9 place-items-center rounded-(--r-sm) text-ink-2 hover:bg-surface-2 hover:text-ink-1"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div>
                <p className="text-sm leading-relaxed text-ink-2">
                  Sizing, stock, pricing, permits, installers — ask away. I answer
                  from the live catalog, and a human is one text away.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_STARTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void send(q)}
                      className="rounded-full border border-line bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink-1 hover:border-brand hover:text-brand"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-(--r-md) px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "self-end bg-brand text-brand-ink"
                      : "self-start border border-line bg-surface-1 text-ink-1"
                  }`}
                >
                  {m.role === "assistant" ? (
                    m.content ? (
                      <AssistantText text={m.content} />
                    ) : (
                      <span className="inline-flex gap-1 py-1" aria-label="Assistant is typing">
                        <span className="size-1.5 animate-bounce rounded-full bg-ink-3 [animation-delay:0ms]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-ink-3 [animation-delay:120ms]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-ink-3 [animation-delay:240ms]" />
                      </span>
                    )
                  ) : (
                    m.content
                  )}
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="border-t border-line bg-surface-1 p-3"
          >
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about sizing, stock, permits…"
                aria-label="Message the assistant"
                className="h-10 min-w-0 flex-1 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
              <button
                type="submit"
                disabled={busy || input.trim().length === 0}
                aria-label="Send message"
                className="grid size-10 shrink-0 place-items-center rounded-(--r-sm) bg-brand text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
            <a
              href={SITE.phoneHref}
              data-conversion-hook="chat-escalate-phone"
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-3 hover:text-brand"
            >
              <Phone size={11} />
              Prefer a human? Call or text {SITE.phone}
            </a>
          </form>
        </div>
      )}
    </>
  );
}
