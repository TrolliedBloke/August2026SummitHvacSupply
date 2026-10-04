import { Clock, Mail, MapPin, Phone, Truck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Eyebrow } from "@/components/ui";
import { BranchStatusText } from "@/components/branch-status";
import { ContactForm } from "@/components/contact/contact-form";
import { WhatHappensNext } from "@/components/what-happens-next";
import { contactPrefill } from "@/lib/forms/contact";
import { getStorefrontSku } from "@/lib/storefront/catalog";
import { SITE } from "@/lib/site";
import { deliveryPolicyIsConfirmed } from "@/lib/fulfillment-policy";

/**
 * Contact. Server-rendered so URL context (?topic=, ?sku=, ?branch=, ?order=)
 * can be checked against the catalog before it reaches the form: only
 * allow-listed parameters with canonical values prefill, and every prefilled
 * value is visible and editable.
 */
export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const query = await searchParams;
  const params = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : []))
  );
  const prefill = contactPrefill(params, (raw) => getStorefrontSku(raw)?.sku ?? null);

  return (
    <div className="bg-canvas py-12 lg:pb-14 lg:pt-16">
      <div className="contact-layout mx-auto grid w-full max-w-[1428px] gap-12 px-5 lg:grid-cols-[minmax(0,1fr)_360px] min-[1430px]:gap-[52px]">
        <div className="min-w-0">
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Talk to a real person who knows HVAC.</h1>
          <p className="mt-3 text-ink-2">
            Product and compatibility questions, quotes, orders, deliveries and returns. Pick the topic and the right desk
            gets it.
          </p>

          {/* One line, not a second hero: the topic field should be in the first viewport. */}
          <p className="mt-3 max-w-[670px] text-sm leading-6 text-ink-3">
            Homeowner looking for an installer? We supply equipment, not installation.{" "}
            <Link href="/homeowners#homeowner-request" className="font-medium text-ink-1 underline underline-offset-4">
              Use the homeowner request
            </Link>
            .
          </p>

          <ContactForm prefill={prefill} />
        </div>

        <aside className="lg:sticky lg:top-[102px] lg:mt-[52px] lg:self-start">
          <div className="rounded-(--r-md) border border-line bg-surface-1 p-8">
            <dl className="space-y-[27px] text-[18px] leading-6">
              <Row icon={<MapPin size={27} strokeWidth={1.65} />} label="Address">
                {SITE.address.street},
                <br />
                {SITE.address.city}, {SITE.address.state} {SITE.address.zip}
              </Row>
              <Row icon={<Phone size={27} strokeWidth={1.65} />} label="Phone">
                <a href={SITE.phoneHref} className="text-brand hover:text-brand-hover">
                  {SITE.phone}
                </a>
              </Row>
              <Row icon={<Mail size={27} strokeWidth={1.65} />} label="Email">
                <a href={SITE.emailHref} className="break-all text-brand hover:text-brand-hover">
                  {SITE.email}
                </a>
              </Row>
              <Row icon={<Clock size={27} strokeWidth={1.65} />} label="Hours">
                {SITE.counterHours}
                <BranchStatusText withDot className="mt-1 text-base text-ink-2" />
              </Row>
              <Row icon={<Truck size={27} strokeWidth={1.65} />} label="Service">
                {deliveryPolicyIsConfirmed()
                  ? "Newark will-call, Bay Area delivery & freight"
                  : "Newark will-call; delivery and freight confirmed by the counter"}
              </Row>
            </dl>
          </div>
          <WhatHappensNext
            className="mt-4"
            showPhone={false}
            steps={[
              "Your topic routes the message to the counter or the orders desk.",
              "They reply by email, or by phone if you leave a number. The topic field shows what to expect.",
              "For an order or return, include the order number so nothing waits on a lookup.",
            ]}
          />
        </aside>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-6">
      <dt className="col-span-2 grid min-w-0 grid-cols-subgrid items-start text-[15px] leading-5 text-ink-3">
        <span className="row-span-2 mt-0.5 grid size-9 place-items-center text-ink-1" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </dt>
      <dd className="col-start-2 mt-0.5 min-w-0 max-w-[330px] text-ink-1">{children}</dd>
    </div>
  );
}
