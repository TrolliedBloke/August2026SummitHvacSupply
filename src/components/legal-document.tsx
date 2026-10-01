import Link from "next/link";
import type * as React from "react";
import { Container, Eyebrow } from "@/components/ui";
import { TableOfContents } from "@/components/table-of-contents";
import { Notice } from "@/components/state";
import { SITE } from "@/lib/site";
import { formatLegalDate, type LegalDocument } from "@/content/legal/schema";
import { archiveHref } from "@/content/legal/registry";

/**
 * The legal shell. Owns its typography (.prose-doc: measure, rhythm, protected
 * link and heading styles) so marketing type changes cannot alter a policy's
 * readability. Version, effective date and history are part of the document,
 * the table of contents is generated from section ids, and anchors work with
 * JavaScript off.
 */
export function LegalDocumentPage({
  document,
  archived = false,
  currentVersion,
  lead,
}: {
  document: LegalDocument;
  /** An answer-first block shown above the document text (a checker, a ZIP answer). */
  lead?: React.ReactNode;
  /** Rendering an archived version at its stable URL. */
  archived?: boolean;
  currentVersion?: string;
}) {
  const toc = [
    ...document.sections.map((section) => ({ id: section.id, label: section.heading })),
    { id: "version-history", label: "Version history" },
  ];
  const previous = document.history[1];

  return (
    <>
      <section className="border-b border-line bg-surface-1">
        <Container className="py-12 lg:py-16">
          <Eyebrow>{document.eyebrow}</Eyebrow>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">{document.title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{document.intro}</p>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-ink-3">Effective</dt>
              <dd className="font-medium text-ink-1">{formatLegalDate(document.effectiveDate)}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Version</dt>
              <dd className="part-number font-medium text-ink-1">{document.version}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Last updated</dt>
              <dd className="font-medium text-ink-1">{formatLegalDate(document.updatedDate)}</dd>
            </div>
            {previous && (
              <div>
                <dt className="text-ink-3">Previous version</dt>
                <dd>
                  <Link href={archiveHref(document.id, previous.version)} className="font-medium text-ink-1 underline underline-offset-4">
                    {previous.version}, {formatLegalDate(previous.effectiveDate)}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
          {document.history[0] && document.history.length > 1 && !archived && (
            <div className="mt-5 max-w-2xl text-sm leading-6 text-ink-2">
              <p className="font-medium text-ink-1">What changed in this version</p>
              <ul className="mt-1 list-disc pl-5">
                {document.history[0].summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </Container>
      </section>

      <Container className="py-10 lg:py-14">
        {archived && (
          <Notice tone="warning" className="mb-8 max-w-[var(--measure)]" title={`Archived version ${document.version}`}>
            This is a previous version, kept so older links still work.{" "}
            <Link href={document.path} className="font-medium text-ink-1 underline underline-offset-4">
              Read the current version{currentVersion ? ` (${currentVersion})` : ""}
            </Link>
            .
          </Notice>
        )}
        {/* Review status is tracked for the team, not shown to customers. */}
        {process.env.NODE_ENV !== "production" && document.review.status !== "approved" && (
          <div className="mb-8 max-w-[var(--measure)] rounded-(--r-md) border border-line-strong bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
            <strong className="font-medium text-ink-1">Dev-only notice, not shown to customers.</strong> Owner:{" "}
            {document.owner}. This document has not been reviewed by counsel. Get sign-off before launch.
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <TableOfContents entries={toc} variant="sticky" className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto" />
          </aside>
          <div className="min-w-0">
          <TableOfContents entries={toc} variant="compact" className="mb-8 max-w-[var(--measure)] lg:hidden" />
          {lead && <div className="mb-10 max-w-[var(--measure)]">{lead}</div>}
          <article className="prose-doc">
            <div className="flex flex-col gap-10">
              {document.sections.map((section) => (
                <section key={section.id} aria-labelledby={section.id}>
                  <h2 id={section.id} tabIndex={-1} className="outline-none">
                    {section.heading}
                  </h2>
                  <div className="mt-3 flex flex-col gap-3">{section.body}</div>
                  {section.definitions && (
                    <dl className="mt-4 divide-y divide-line border-y border-line">
                      {section.definitions.map((definition) => (
                        <div key={definition.id} id={definition.id} className="grid scroll-mt-6 gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                          <dt className="font-medium text-ink-1">{definition.term}</dt>
                          <dd>{definition.definition}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
              ))}

              <section aria-labelledby="version-history">
                <h2 id="version-history" tabIndex={-1} className="outline-none">
                  Version history
                </h2>
                <ol className="mt-3 flex flex-col gap-4">
                  {document.history.map((entry) => (
                    <li key={entry.version}>
                      <p className="font-medium text-ink-1">
                        <Link href={archiveHref(document.id, entry.version)}>
                          Version {entry.version}, effective {formatLegalDate(entry.effectiveDate)}
                        </Link>
                        {entry.version === document.version && !archived && <span className="ml-2 text-sm font-normal text-ink-3">(this version)</span>}
                      </p>
                      <ul className="mt-1 list-disc pl-5">
                        {entry.summary.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <div className="mt-12 border-t border-line pt-6 text-sm leading-relaxed">
              <p className="font-medium text-ink-1">Questions about this policy?</p>
              <p className="mt-1">
                Call <a href={SITE.phoneHref}>{SITE.phone}</a> or email <a href={SITE.emailHref}>{SITE.email}</a>. {SITE.counterHours}.
              </p>
            </div>
          </article>
          </div>
        </div>
      </Container>
    </>
  );
}
