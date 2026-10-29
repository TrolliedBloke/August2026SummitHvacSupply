# Design remediation release status

Status as of 2026-10-01. This file records the final release-gate items from
`DESIGN-REMEDIATION-PLAN.md` that cannot be truthfully completed in the local
repository alone. None of these items is waived.

## Implemented and locally verified

- All 31 numbered remediations and F01–F12 have code implementations.
- The local verification stack covers TypeScript, lint, 149 unit/integration
  tests, 20 Playwright flows, external-link health, an all-route responsive
  matrix, automated WCAG A/AA checks on mobile and desktop, and browser console
  errors across the route matrix.
- Next.js is patched to 16.3.8, the repository pins Node 20.19+, and `npm audit`
  reports zero known vulnerabilities.
- The responsive matrix covers every planned route at 320, 720 (the effective
  CSS width of a 1440 px display at 200% browser zoom), 768, 1024, and 1440 px.
- `scripts/design-screens.ts` captured all 31 pages and all 12 feature states.
  The empty-cart checkout route intentionally redirects to the quote recovery
  path; checkout state/race behavior is covered by the snapshot tests.
- Unapproved operational promises do not authorize checkout. Exact delivery,
  pickup, branch-hours, fee, and automated-return outcomes remain unavailable
  until their source record is marked confirmed.

## Open release blockers

### DR-EXT-01 — Operations policy approval

- **Owner:** Newark counter operations
- **Decision/evidence needed:** Confirm branch hours and closures; fulfillment
  cutoff, pickup preparation time, route ZIPs, fees, and lead times; return
  window, fees, damage timing, and exclusions; and the dealer, homeowner,
  quote, and contact response windows.
- **Risk:** Publishing an incorrect promise, or allowing checkout/RMA behavior
  that the counter cannot fulfill.
- **Current protection:** Fulfillment and branch calculations expose only a
  call-to-confirm state while pending. Online RMA eligibility/initiation is
  disabled while return rules are pending. Response-time copy is generic and
  directs time-sensitive requests to the counter.
- **Target milestone:** Required before production release. After approval,
  set the relevant review records to `confirmed`, add `reviewedAt`, replace the
  generic response windows, and rerun the complete verification stack.

### DR-EXT-02 — Content and service-claim approval

- **Owner:** Summit operations/content owner
- **Decision/evidence needed:** Reconfirm evergreen About-page claims, local
  landing-page service/installation/rebate claims, and the design-source value
  for the warm `--band` color token.
- **Risk:** Stale local-service or program claims and visual drift from the
  approved source design.
- **Current protection:** Exact service-area structured data is omitted while
  fulfillment coverage is pending; operational values come from the catalog,
  branch, and fulfillment models rather than duplicate prose.
- **Target milestone:** Content freeze before production release.

### DR-EXT-03 — Counsel review

- **Owner:** Summit counsel / privacy owner
- **Decision/evidence needed:** Approve the current privacy, terms, returns, and
  shipping documents and decide whether account creation or checkout requires
  affirmative, versioned acceptance.
- **Risk:** Publishing unapproved legal terms or failing to retain acceptance
  evidence if counsel requires it.
- **Current protection:** Every document has an owner, immutable section IDs,
  version/effective date/history, stable archive URLs, and an explicit
  `pending_counsel` state. No acceptance checkbox or client-only acceptance
  record has been invented without the legal requirement.
- **Target milestone:** Required before production release. Mark each document
  `approved` with `reviewedAt`; implement server-side versioned acceptance only
  if counsel requires it.

### DR-EXT-04 — Database migration and live security verification

- **Owner:** Database/release engineering
- **Decision/evidence needed:** Apply migration 025 and remediation migrations
  026–028 to an isolated Supabase branch, then run `npm run test:security` with
  branch credentials. Only after that result is green may the same migration
  sequence be scheduled for production.
- **Risk:** The dealer staff queue, linked trade identity, structured customer
  requests, confirmation-email state, and line-level RMA data depend on these
  columns/functions. Incorrect grants could expose customer or commercial data.
- **Current protection:** The migrations explicitly enable RLS, revoke public
  DML/EXECUTE, grant privileged RPCs only to `service_role`, and the live suite
  checks sensitive tables and RPCs. This machine has no branch credentials,
  local Postgres, Docker, or authenticated Supabase CLI, so a live result cannot
  be fabricated here.
- **Target milestone:** Branch validation before release candidate; production
  application before the application deployment.

### DR-EXT-05 — Manual assistive-technology acceptance

- **Owner:** Accessibility QA / product owner
- **Decision/evidence needed:** Keyboard and screen-reader pass on the changed
  routes, including form error summaries, legal tables of contents, dialogs,
  gallery controls, and checkout recovery. Confirm browser zoom at 200% and
  400% on the legal documents.
- **Risk:** Automated axe and focus tests cannot prove announcement order,
  verbosity, or real assistive-technology usability.
- **Current protection:** All-route axe A/AA scans, semantic definition-list
  fixes, focus trap/return tests, field-error associations, and responsive
  reflow checks are in the release suite.
- **Target milestone:** Release-candidate acceptance; record browser, screen
  reader, version, route, and result in this file or the release ticket.

## Explicit non-features

- Dealer/quote document upload was not added because the plan makes it
  conditional on an operations requirement. Adding storage, malware scanning,
  retention, and authorization without that requirement would create risk, not
  completeness.
- Multi-business membership/account switching was not added because no real
  multi-account requirement is confirmed. The schema enforces one canonical
  person and one linked trade application/account path.
