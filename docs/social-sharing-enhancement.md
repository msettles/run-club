# Enhancement: social sharing previews

Status: deferred; implement when requested. Created November 10, 2026.

## Goal

Make links to Woodland Woodchuckers and individual runs display a useful, branded preview when posted on social media or sent through messaging apps.

## Current behavior

Run cards provide **Copy link** and **Share run**. Shared URLs such as `https://woodland-woodchuckers.web.app/?run=RUN_ID` open the selected run, including runs outside the initial schedule page. The native share sheet receives only the URL, avoiding extra text being appended to the run ID.

`index.html` currently has a general description but no Open Graph or social-card metadata. Hosting serves a static app, so run-specific content loaded by React is not supplied in the initial HTML response. See [run-sharing.md](run-sharing.md) for existing link behavior.

## Phase 1: branded club preview

Add a consistent default preview for the homepage, check-in links and existing shared-run links:

- Club title and a concise description.
- A dedicated landscape image using the club's approved mascot, logo and colors. A 1200 × 630 image is a sensible initial target; verify platform requirements when implementing.
- Open Graph title, description, image, image alternative text, URL, type and site name.
- Social-card metadata for platforms using Twitter/X card tags.
- Absolute public HTTPS URLs for images and metadata links.

Keep the preview image available without authentication. Favor readable club branding over small text. Preserve the existing app icons and install manifest.

Phase 1 improves the common preview; it does not promise a different title/image for each run.

## Phase 2: previews for individual runs

Serve run metadata in the initial HTML response so preview crawlers can read it without executing the app.

Each published run's preview should include:

- Run title.
- Date and start time in the club's America/Los_Angeles time zone.
- Public meeting location and a short public description.
- Club-branded image, optionally customized for the run.
- A permanent share URL that opens the intended run and retains normal RSVP/check-in behavior.

Do not include code words, email addresses, attendee lists, authentication tokens or other private information in metadata, images or URLs.

### Architecture decision before implementation

Compare these approaches against the hosting plan and expected scheduling workflow:

1. **A metadata endpoint:** resolve the public run ID and return HTML with escaped metadata and a usable link into the app. Evaluate hosting rewrites, runtime availability, cost and maintenance before choosing a service.
2. **Generated static run pages:** publish preview HTML and assets when a run is created or updated. Define how publishing, edits, unpublishing and deployment are coordinated before adopting this approach.

Changing metadata only after React mounts is insufficient for the intended crawler support. Do not require a site redeploy for every run edit unless the owner explicitly accepts that workflow. Preserve compatibility with existing `?run=...` links even if a new share-page path is introduced.

### Content lifecycle and reliability

- Escape all run-supplied content before inserting it into HTML or metadata attributes.
- Use a safe generic club preview for missing, deleted, unpublished or inaccessible runs; never reveal a draft through a preview endpoint.
- Keep transient backend failures distinguishable from permanent missing content, and avoid caching failures as successful run previews.
- Define cache lifetime and invalidation for edited/unpublished runs, and explain that social platforms may retain their own cached previews.
- Use a stable public image URL; version changed images where needed to help refresh cached previews.
- Limit backend reads and request volume. Fetch only the public fields required for a preview.
- Keep preview infrastructure independent of authentication and attendance mutations.
- Preserve indefinite retention and existing deletion permissions. Preview cleanup must not delete users, runs, routes or attendance records. See [go-live-policy.md](go-live-policy.md).

## Acceptance checks

### Club preview

- Initial homepage HTML contains the expected preview tags with absolute URLs.
- Preview image returns successfully and is legible on a phone.
- Homepage and check-in URLs have sensible default previews.
- At least Facebook and the messaging platforms used by the club show the approved image/title/description. Verify current platform tools and requirements during implementation.

### Run preview

- Two different published runs produce different, correct initial HTML metadata.
- Dates/times remain correct across daylight-saving changes and devices in other time zones.
- Opening a shared URL still displays the correct run, including historical runs outside the first page.
- Missing/deleted/unpublished runs use the defined fallback without exposing private data.
- Quotes, ampersands, Unicode and HTML-like run text are escaped safely.
- Editing a run follows the documented preview refresh/cache policy.
- QR check-in links, Copy link, Share run, installed-app navigation and normal RSVP/check-in continue working.
- Local/emulator tests use synthetic data. Live preview verification uses an approved public run and performs no attendance writes.

## Out of scope

Automatic posting, social-account connections, paid promotion, social login changes and analytics/tracking integrations. This document does not authorize deployment, new paid infrastructure or publishing posts.

## Suggested order

1. Approve the default preview artwork and copy.
2. Implement and verify the branded club preview.
3. Select the run-preview architecture and refresh strategy.
4. Implement run-specific metadata and regression tests.
5. Verify real platform previews and document their refresh procedure.
