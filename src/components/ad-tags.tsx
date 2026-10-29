"use client";

import Link from "next/link";
import Script from "next/script";
import * as React from "react";
import { AD_COOKIE_MAX_AGE_SECONDS, AD_CONSENT_COOKIE, browserOptedOut, readCookie } from "@/lib/privacy-cookies";

/**
 * Meta and Google ad tags, behind three locks.
 *
 *  1. The server renders this only when every gate in lib/ads-config.ts is
 *     open -- today none of it renders.
 *  2. Global Privacy Control or the opt-out cookie: nothing loads, and no
 *     question is asked.
 *  3. Otherwise nothing loads until the visitor says yes. "No thanks" is
 *     remembered and is as easy as yes.
 */
type Choice = "unknown" | "granted" | "denied" | "opted_out";

function persist(value: "granted" | "denied") {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${AD_CONSENT_COOKIE}=${value}; path=/; max-age=${AD_COOKIE_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

export function AdTags({ metaPixelId, googleTagId }: { metaPixelId: string | null; googleTagId: string | null }) {
  const [choice, setChoice] = React.useState<Choice>("unknown");
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    queueMicrotask(() => {
      if (browserOptedOut(document.cookie, gpc)) setChoice("opted_out");
      else {
        const stored = readCookie(AD_CONSENT_COOKIE, document.cookie);
        setChoice(stored === "granted" ? "granted" : stored === "denied" ? "denied" : "unknown");
      }
      setReady(true);
    });
  }, []);

  React.useEffect(() => {
    const revoke = () => {
      if (!browserOptedOut(document.cookie, (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl)) return;
      const tags = window as Window & { fbq?: (...args: unknown[]) => void; gtag?: (...args: unknown[]) => void };
      tags.fbq?.("consent", "revoke");
      tags.gtag?.("consent", "update", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
      setChoice("opted_out");
    };
    window.addEventListener("summit-privacy-change", revoke);
    window.addEventListener("focus", revoke);
    return () => { window.removeEventListener("summit-privacy-change", revoke); window.removeEventListener("focus", revoke); };
  }, []);

  if (!ready || choice === "opted_out" || choice === "denied") return null;

  if (choice === "unknown") {
    return (
      <section
        aria-label="Ad measurement choice"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface-1 px-4 py-4 sm:px-6"
      >
        <div className="mx-auto flex max-w-[var(--page-max)] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-ink-2">
            May Summit use Meta and Google cookies to measure its ads? Saying no changes nothing else on the site.{" "}
            <Link href="/privacy/opt-out" className="text-ink-1 underline underline-offset-4">Privacy choices</Link>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                persist("denied");
                setChoice("denied");
              }}
              className="inline-flex h-11 items-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={() => {
                persist("granted");
                setChoice("granted");
              }}
              className="inline-flex h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand-hover"
            >
              Allow
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {googleTagId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`} strategy="afterInteractive" />
          <Script id="summit-gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(googleTagId)});`}
          </Script>
        </>
      )}
      {metaPixelId && (
        <Script id="summit-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(metaPixelId)});fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
