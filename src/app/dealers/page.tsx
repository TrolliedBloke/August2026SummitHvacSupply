"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ArrowRight, ArrowLeft, CheckCircle2, Building2, FileBadge, TrendingUp } from "lucide-react";
import * as React from "react";
import { Container, Eyebrow, Button } from "@/components/ui";
import { TestimonialSlot } from "@/components/testimonial-slot";
import { CONTRACTOR_TESTIMONIALS } from "@/lib/testimonials";
import { Field, Input, Textarea, Select } from "@/components/form";
import { SITE } from "@/lib/site";
import { postJson } from "@/lib/client/post-json";

const STEPS = [
  { id: 1, label: "Company", icon: Building2 },
  { id: 2, label: "Licensing", icon: FileBadge },
  { id: 3, label: "Volume", icon: TrendingUp },
] as const;

export default function DealersPage() {
  const [step, setStep] = React.useState(1);
  const [done, setDone] = React.useState(false);
  const [serviceArea, setServiceArea] = React.useState("");
  const [bizType, setBizType] = React.useState("");
  const [volume, setVolume] = React.useState("");
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const draftRef = React.useRef<Record<string, string>>({});

  const collectDraft = React.useCallback((form: HTMLFormElement) => {
    const formData = new FormData(form);
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        draftRef.current[key] = value;
      }
    }
  }, []);

  const next = (form: HTMLFormElement | null) => {
    if (form) {
      if (!form.reportValidity()) return;
      collectDraft(form);
    }
    setStep((s) => Math.min(3, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    collectDraft(e.currentTarget);
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = await postJson<{ ok: boolean; id?: string; error?: string }>("/api/dealer-applications", {
        company: draftRef.current.company ?? "",
        contactName: draftRef.current.contact ?? "",
        email: draftRef.current.email ?? "",
        phone: draftRef.current.phone ?? "",
        licenseNumber: draftRef.current.license ?? "",
        serviceArea: draftRef.current.serviceArea ?? serviceArea,
        businessType: draftRef.current.bizType ?? bizType,
        monthlyVolume: draftRef.current.volume ?? volume,
        brands: draftRef.current.brands ?? "",
        notes: draftRef.current.notes ?? "",
      });
      setRequestId(payload.id ?? null);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not prepare account request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="border-b border-line bg-[var(--ink-panel)] py-14 text-white">
        <Container className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow>Become a dealer</Eyebrow>
            <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Open a contractor account.
            </h1>
            <p className="mt-3 max-w-xl text-white/65">
              Contractor pricing, Bay Area stock, spec &amp; rebate support,
              and one-tap reorder. Takes about two minutes. Our team reviews and replies
              within one business day.
            </p>
          </div>
          <div className="relative min-h-[250px] overflow-hidden rounded-(--r-md) border border-white/10 bg-white/5 shadow-[var(--shadow-lg)]">
            <Image
              src="/site/generated/contractor-will-call-counter.jpg"
              alt="HVAC contractor reviewing a will-call pickup order at a supply counter"
              fill
              preload
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </Container>
      </section>

      {/* Company proof stays beside the application. Demo fixtures are visibly
          labeled in development and production remains consent-gated. */}
      <TestimonialSlot
        items={CONTRACTOR_TESTIMONIALS}
        className="mx-auto w-full max-w-[1180px] px-5 pt-12 sm:px-6 lg:px-8"
      />

      <Container className="py-12 lg:py-16">
        <div className="mx-auto max-w-xl">
          {done ? (
            <div className="rounded-(--r-md) border border-eco/30 bg-eco-tint/50 p-8 text-center">
              <CheckCircle2 className="mx-auto text-eco" size={36} />
              <h2 className="mt-4 font-display text-2xl font-semibold text-ink-1">
                Contractor account request prepared.
              </h2>
              <p className="mt-2 text-ink-2">
                Your application details are ready for account review. Call or email us to finish setup, confirm your license, and unlock contractor pricing.
              </p>
              <p className="mt-4 text-sm text-ink-3">
                Questions in the meantime? Call{" "}
                <a href={SITE.phoneHref} className="font-medium text-brand">{SITE.phone}</a>{" "}
                or email{" "}
                <a href={SITE.emailHref} className="font-medium text-brand">{SITE.email}</a>.
              </p>
              {requestId && (
                <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                  Application ID {requestId}
                </p>
              )}
              <Link href="/products" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover">
                Browse the lineup <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <>
              {/* Stepper */}
              <ol className="flex items-center gap-2">
                {STEPS.map((s, i) => {
                  const active = step === s.id;
                  const complete = step > s.id;
                  const Icon = s.icon;
                  return (
                    <React.Fragment key={s.id}>
                      <li className="flex items-center gap-2">
                        <span
                          className={`grid size-9 place-items-center rounded-full border text-sm font-semibold transition-colors ${
                            complete
                              ? "border-transparent bg-eco text-white"
                              : active
                                ? "border-brand bg-brand-tint text-brand"
                                : "border-line bg-surface-2 text-ink-4"
                          }`}
                        >
                          {complete ? <Check size={16} strokeWidth={2.5} /> : <Icon size={16} />}
                        </span>
                        <span className={`hidden text-sm font-medium sm:block ${active || complete ? "text-ink-1" : "text-ink-4"}`}>
                          {s.label}
                        </span>
                      </li>
                      {i < STEPS.length - 1 && (
                        <li className={`h-px flex-1 ${step > s.id ? "bg-eco" : "bg-line"}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </ol>

              <form onSubmit={submit} className="mt-8 rounded-(--r-md) border border-line bg-surface-1 p-6 shadow-[var(--shadow-sm)]">
                {step === 1 && (
                  <div className="flex flex-col gap-5">
                    <Field label="Company name" required>
                      <Input name="company" required placeholder="Summit Mechanical, Inc." />
                    </Field>
                    <Field label="Contact name" required>
                      <Input name="contact" required autoComplete="name" placeholder="First & last name" />
                    </Field>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Work email" required>
                        <Input name="email" type="email" required placeholder="you@company.com" />
                      </Field>
                      <Field label="Phone" required>
                        <Input name="phone" type="tel" required placeholder="(415) 000-0000" />
                      </Field>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="flex flex-col gap-5">
                    <Field label="Contractor license #" required hint="C-20 / C-38 or equivalent">
                      <Input name="license" required placeholder="e.g. 1234567" />
                    </Field>
                    <Field label="Primary service area" required>
                      <Select
                        name="serviceArea"
                        value={serviceArea}
                        onChange={setServiceArea}
                        placeholder="Select your main state"
                        options={[
                          { value: "ca", label: "California" },
                          { value: "or", label: "Oregon" },
                          { value: "wa", label: "Washington" },
                          { value: "nv", label: "Nevada" },
                          { value: "az", label: "Arizona" },
                          { value: "multi", label: "Multiple states" },
                        ]}
                      />
                    </Field>
                    <Field label="Business type" required>
                      <Select
                        name="bizType"
                        value={bizType}
                        onChange={setBizType}
                        placeholder="Select"
                        options={[
                          { value: "contractor", label: "HVAC contractor" },
                          { value: "installer", label: "Installer" },
                          { value: "dealer", label: "Dealer / reseller" },
                          { value: "mechanical", label: "Mechanical / commercial" },
                        ]}
                      />
                    </Field>
                  </div>
                )}

                {step === 3 && (
                  <div className="flex flex-col gap-5">
                    <Field label="Estimated monthly volume" required>
                      <Select
                        name="volume"
                        value={volume}
                        onChange={setVolume}
                        placeholder="Units per month"
                        options={[
                          { value: "1-5", label: "1-5 units / month" },
                          { value: "6-20", label: "6-20 units / month" },
                          { value: "21-50", label: "21-50 units / month" },
                          { value: "50+", label: "50+ units / month" },
                        ]}
                      />
                    </Field>
                    <Field label="Brands you currently carry" hint="Optional">
                      <Input name="brands" placeholder="e.g. Mitsubishi, Daikin, Fujitsu" />
                    </Field>
                    <Field label="Anything else we should know?" hint="Optional">
                      <Textarea name="notes" rows={3} placeholder="Tell us about your business, typical jobs, or what you need from a distributor." />
                    </Field>
                  </div>
                )}

                <div className="mt-7 flex items-center justify-between">
                  {step > 1 ? (
                    <Button type="button" variant="ghost" onClick={back}>
                      <ArrowLeft size={16} /> Back
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < 3 ? (
                    <Button type="button" onClick={(event) => next(event.currentTarget.form)}>
                      Continue <ArrowRight size={16} />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Preparing..." : "Prepare account request"} <Check size={16} strokeWidth={2.5} />
                    </Button>
                  )}
                </div>
                {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
              </form>
              <p className="mt-3 text-center text-xs text-ink-4">
                Step {step} of 3.
              </p>
            </>
          )}
        </div>
      </Container>
    </>
  );
}
