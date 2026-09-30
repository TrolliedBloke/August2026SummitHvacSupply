"use client";

import {
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  Home,
  Truck,
} from "lucide-react";
import * as React from "react";
import { Eyebrow, Button } from "@/components/ui";
import { Field, Input, Textarea, Select } from "@/components/form";
import { SITE } from "@/lib/site";
import { postJson } from "@/lib/client/post-json";

export default function ContactPage() {
  const [topic, setTopic] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<"name" | "email" | "message" | "topic" | null>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="bg-[#f7f6f3] py-12 lg:pt-16 lg:pb-14">
      <div className="mx-auto grid w-full max-w-[1428px] gap-12 px-5 lg:grid-cols-[minmax(0,826px)_minmax(0,510px)] lg:gap-[52px]">
        {/* Form */}
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
            Talk to a real person who knows HVAC.
          </h1>
          <p className="mt-3 text-ink-2">
            One system for your home, contractor stock, property quotes, specs,
            warranty, or installer help. Pick the lane that fits.
          </p>

          {/* Homeowner secondary path -- capture & hand off, never dominate */}
          <div className="mt-6 flex items-start gap-6 pt-6">
            <span className="grid size-9 shrink-0 place-items-center text-ink-3">
              <Home size={22} strokeWidth={1.75} />
            </span>
            <p className="max-w-[670px] text-[18px] leading-6 text-ink-2">
              <span className="font-semibold text-ink-1">Homeowner? </span>{" "}
              We supply equipment and can help route you toward a qualified Bay
              Area installer. We do not perform installation ourselves.
            </p>
          </div>

          {sent ? (
            <div className="mt-8 rounded-(--r-md) border border-eco/30 bg-eco-tint/50 p-6">
              <CheckCircle2 className="text-eco" size={28} />
              <h2 className="mt-3 font-display text-xl font-semibold text-ink-1">
                Message prepared.
              </h2>
              <p className="mt-2 text-ink-2">
                Your details are ready for follow-up. We will review the topic
                and explain the next step before asking you to buy equipment. For
                urgent pricing, stock, or installer help, call{" "}
                <a href={SITE.phoneHref} className="font-medium text-brand">
                  {SITE.phone}
                </a>
                .
              </p>
              {requestId && (
                <p className="mt-3 text-xs text-ink-3">
                  Request ID {requestId}
                </p>
              )}
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                setError(null);
                setFieldError(null);
                const form = new FormData(e.currentTarget);
                const name = String(form.get("name") ?? "").trim();
                const email = String(form.get("email") ?? "").trim();
                const message = String(form.get("message") ?? "").trim();

                // Validate one field at a time so the form remains calm and
                // useful rather than turning every control red at once.
                if (!name) {
                  setIsSubmitting(false);
                  setFieldError("name");
                  requestAnimationFrame(() => {
                    emailRef.current?.focus();
                    window.scrollTo({ top: document.documentElement.scrollHeight });
                  });
                  return;
                }
                if (!email) {
                  setIsSubmitting(false);
                  setFieldError("email");
                  return;
                }
                if (!topic) {
                  setIsSubmitting(false);
                  setFieldError("topic");
                  return;
                }
                if (!message) {
                  setIsSubmitting(false);
                  setFieldError("message");
                  return;
                }
                try {
                  const payload = await postJson<{ ok: boolean; id?: string; error?: string }>("/api/contact-requests", {
                    topic,
                    name: String(form.get("name") ?? ""),
                    email: String(form.get("email") ?? ""),
                    message: String(form.get("message") ?? ""),
                  });
                  setRequestId(payload.id ?? null);
                  setSent(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } catch (submitError) {
                  setError(submitError instanceof Error ? submitError.message : "Could not prepare message.");
                } finally {
                  setIsSubmitting(false);
                }
              }}
              noValidate
              className="mt-8 flex flex-col gap-7"
            >
              <Field label="I'm reaching out about" required className="gap-2.5">
                <Select
                  ariaLabel="I'm reaching out about"
                  name="topic"
                  value={topic}
                  onChange={(value) => {
                    setTopic(value);
                    if (fieldError === "topic") setFieldError(null);
                  }}
                  size="lg"
                  placeholder="Choose a topic"
                  options={[
                    { value: "one_system", label: "I want one system for my home" },
                    { value: "installer", label: "I need installer help" },
                    { value: "contractor", label: "I’m a contractor buying equipment" },
                    { value: "property", label: "I manage a property" },
                    { value: "specs", label: "Specs, warranty, or documents" },
                  ]}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" required className="gap-2.5">
                  <Input
                    name="name"
                    autoComplete="name"
                    aria-invalid={fieldError === "name"}
                    className={`h-13 ${fieldError === "name" ? "border-[#d92d20] hover:border-[#d92d20] focus:border-[#d92d20] focus:ring-[#d92d20]/20" : ""}`}
                    style={fieldError === "name" ? { borderColor: "#d92d20", boxShadow: "0 0 0 1px #d92d20" } : undefined}
                  />
                  {fieldError === "name" && (
                    <span className="text-base leading-5 text-[#c91d12]">Enter your name.</span>
                  )}
                </Field>
                <Field label="Email" required className="gap-2.5">
                  <Input
                    ref={emailRef}
                    name="email"
                    type="email"
                    placeholder="you@email.com"
                    aria-invalid={fieldError === "email"}
                    className="h-13"
                  />
                </Field>
              </div>
              <Field label="Message" required className="-mt-[3px] gap-[13px]">
                <Textarea
                  name="message"
                  rows={5}
                  aria-invalid={fieldError === "message"}
                  className="h-[136px] min-h-0"
                />
              </Field>
              <Button type="submit" size="lg" className="-mt-1 h-14 min-w-[262px] self-start text-[18px] font-semibold" disabled={isSubmitting}>
                {isSubmitting ? "Preparing..." : "Open email draft"}
              </Button>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            </form>
          )}
        </div>

        {/* NAP aside */}
        <aside className="lg:sticky lg:top-[102px] lg:mt-[52px] lg:self-start">
          <div className="rounded-[12px] border border-[#d7d4cd] bg-white p-8 shadow-[var(--shadow-sm)]">
            <dl className="space-y-[27px] text-[18px] leading-6">
              <Row icon={<MapPin size={27} strokeWidth={1.65} />} label="Address">
                5437 Central Ave., Suite 10,<br />Newark, CA 94560
              </Row>
              <Row icon={<Phone size={27} strokeWidth={1.65} />} label="Phone">
                <a
                  href={SITE.phoneHref}
                  className="text-brand hover:text-brand-hover"
                >
                  {SITE.phone}
                </a>
              </Row>
              <Row icon={<Mail size={27} strokeWidth={1.65} />} label="Email">
                <a
                  href={SITE.emailHref}
                  className="text-brand hover:text-brand-hover"
                >
                  {SITE.email}
                </a>
              </Row>
              <Row icon={<Clock size={27} strokeWidth={1.65} />} label="Hours">
                Mon–Fri 7 AM–5 PM PT
              </Row>
              <Row icon={<Truck size={27} strokeWidth={1.65} />} label="Service">
                Newark will-call, Bay Area delivery &amp; freight
              </Row>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-7">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center text-[#30302e]">
        {icon}
      </span>
      <div>
        <dt className="text-[15px] leading-5 text-[#696863]">
          {label}
        </dt>
        <dd className="mt-0.5 max-w-[330px] text-ink-1">{children}</dd>
      </div>
    </div>
  );
}
