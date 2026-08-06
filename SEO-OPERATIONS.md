# Summit HVAC SEO operations

## Launch controls

- Keep `/checkout`, `/portal`, `/admin`, API routes, and filtered/search result URLs out of the index.
- Submit `https://www.summithvacsupply.com/sitemap.xml` after production deploy.
- Do not add a SKU or series to its sitemap until `getSkuSeoState` or the series verification gate passes.
- Verify every public price, stock source, manufacturer document, AHRI reference, image, and regulated specification before clearing a catalog `confirm` flag.
- Preserve existing clean URLs. Add permanent redirects before changing a published slug or part-number URL.

## Search platforms

- Verify the production domain in Google Search Console using DNS ownership.
- Verify the domain in Bing Webmaster Tools and import the Google Search Console property when available.
- Submit the sitemap index in both platforms.
- Inspect the homepage, Newark location, one guide, one tool, one series, and one verified SKU after deployment.
- Review indexing, rich-result, Core Web Vitals, and crawl-error reports weekly for the first eight weeks.

## Google Business Profile

- Use the exact site NAP: Summit HVAC Supply, 5437 Central Ave., Suite 10, Newark, CA 94560, (415) 988-4445.
- Link the website field to `/locations/newark` with a campaign-tagged URL.
- Confirm counter hours, service categories, pickup information, photos, parking/loading notes, and holiday hours.
- Publish one stock, will-call, document-support, or buyer-guidance update each month.
- Assign a named owner to respond to every review within two business days. Do not gate, incentivize, or fabricate reviews.

## Regulated content

- Owner: Summit compliance desk.
- Review BAAQMD, rebate, tax, A2L, permit, and Title 24 guides on the date shown on each page.
- Update the source summary and `reviewedAt`/`nextReviewAt` together.
- If a rule or program cannot be verified, preserve the URL but set the page to `noindex` until review is complete.

## Measurement

- Capture organic landing page, non-brand query cluster, product-view, stock-check, document-download, tool-start, quote-start, account-start, and homeowner-lead events.
- Report weekly: non-brand clicks, indexed valid pages, top-10 terms, tool completion, organic quote/lead starts, assisted revenue, and Core Web Vitals.
- Segment homeowners, contractors, and property buyers where the visitor explicitly selects a path; do not infer sensitive attributes.
