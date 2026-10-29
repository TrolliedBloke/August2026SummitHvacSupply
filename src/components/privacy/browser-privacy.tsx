"use client";
import { useEffect } from "react";
import { browserOptedOut } from "@/lib/privacy-cookies";

/** Persist browser signals and associate them with a known finder/account email. */
export function BrowserPrivacy() {
  useEffect(() => {
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    if (browserOptedOut(document.cookie, gpc)) {
      void fetch("/api/privacy/opt-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        .then((response) => { if (response.ok) window.dispatchEvent(new Event("summit-privacy-change")); })
        .catch(() => { /* Browser-side exclusion still applies if persistence fails. */ });
    }
  }, []);
  return null;
}
