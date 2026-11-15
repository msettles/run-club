# Run posts to Instagram and Facebook

Owner priority: November 14, 2026. Preview UI deployed in 1.6.3; Meta server exports remain inactive. Account configuration, secret setup, selective server deployment and live platform acceptance are still required. No real social post has been sent by this change. This is separate from [link-preview metadata](social-sharing-enhancement.md).

## Workflow

Organizers/admins can check **Prepare an Instagram / Facebook post after saving** when creating a run. Saving creates the run through the existing atomic scheduling path, then opens a separate preview. A **Create Instagram / Facebook post** button under **Organizer tools** on a published upcoming run also opens the preview.

The preview creates one square 1080 × 1080 JPEG map for each distinct route attached to the run, plus an editable caption with public run details and the permanent run link. Each photo shows its saved route geometry over a street map, start/finish markers, route name, measured mileage and the run's title/date/time/venue. **Two routes produce two photos in one post**: an Instagram carousel and a Facebook multi-photo post. No extra cover image is added. Saved route order is preserved and repeated references to the same route produce one photo. This version supports up to ten route photos; it refuses larger sets rather than silently omitting routes. Select Facebook, Instagram or both. The final **Publish to …** button sends the reviewed route photos together immediately to the configured club accounts. Previewing, saving a run or editing the caption does not publish. Instagram displays the URL in the caption as text; this implementation does not promise a clickable caption link.

Each destination has its own persisted result. A failed destination can be explicitly retried without re-posting a successful destination. Reopening the preview/refreshing status reads those results. A network timeout or crash after publication may leave a `publishing`/`uncertain` result: automatic retry is blocked because the platform might already have published. An admin must inspect the actual account and reconcile the private result before another attempt. An existing successful run post is not automatically edited, deleted or re-posted when the run changes or is deleted.

## Selected club accounts

Owner-supplied destinations, November 14:

- Facebook: [Woodland Woodchuckers](https://www.facebook.com/WoodlandWoodchuckers). Public profile identifies itself as a Page / Sports team.
- Instagram: [@woodlandwoodchuck](https://www.instagram.com/woodlandwoodchuck/). Public profile is visible; professional account status and Page linkage are not established from that public view.

The available browser was signed out, so private account settings could not be inspected. No account conversion, connection or publishing permission was changed. Numerical API account IDs and credentials must come from authorized Meta setup; do not infer them from the public profile URLs or photo IDs.

## Club account setup

This first version connects one club Facebook Page and an Instagram professional account linked to that Page using a server-managed Page access token. It does not post to personal Facebook timelines or arbitrary accounts. There is no in-app Meta OAuth/account-management screen in this version.

Follow current Meta setup requirements, including any required app access/review and Page Publishing Authorization. Verify the token's actual Page/account identity and granted publishing permissions. Use the narrow permissions needed by the chosen endpoints. See the official [Facebook Page posting guide](https://developers.facebook.com/documentation/pages-api/posts) and [Instagram publishing guide](https://developers.facebook.com/documentation/instagram-platform/content-publishing). Instagram stages each carousel child, checks readiness, creates a parent and publishes the parent once; a single-route run uses a single-image container. Facebook stages photos with `published=false`, then creates one feed post containing all photo IDs. Both need public JPEG URLs.

Store configuration only in the Firebase Functions secret **META_SOCIAL_CONFIG**. Never place a token in a `VITE_` environment variable, client Firestore settings, committed files, browser storage or public documentation. Obtain and rotate the token through the club's authorized Meta setup; do not paste credentials into chat. A configuration file used to set the secret must be private/ignored.

Expected JSON shape (values below are placeholders, not real accounts):

```json
{
  "accessToken": "PAGE_ACCESS_TOKEN",
  "graphVersion": "v27.0",
  "facebookPageId": "123456789",
  "facebookPageName": "Club Facebook Page",
  "instagramUserId": "987654321",
  "instagramUsername": "@club"
}
```

Omit an account ID to disable that destination. Account labels describe configured destinations; actual permissions/token validity are established by Meta's responses and live verification. An expired or revoked token requires replacement. Review the pinned Graph API version when provisioning or upgrading.

## Service and deployment

The existing calendar function is preserved. The pending Meta implementations are `runSocialPost` (authenticated callable) and `socialImage` (public image delivery), both in `us-central1`. Build with `npm run build:functions`. These two functions are deliberately not exported by `functions/src/index.ts` while account setup is pending, so normal releases do not inspect/provision Meta secrets. When activating Meta, configure its required services and secret, add `export { runSocialPost, socialImage } from './social';` to that entry point, and rebuild. Set the secret with the Firebase CLI's `functions:secrets:set META_SOCIAL_CONFIG` using secure input, then deploy the two functions and updated hosting through the normal club release process. No new storage bucket or scheduler is needed. Inspect current service quotas/costs before deployment; the existing billing alert is not a spending cap.

`runSocialPost` requires verified Firebase sign-in and an active staff profile, rereads the saved run/event and maintenance/import controls, and refuses unavailable/unpublished/deleting runs. Import fencing blocks publishing; maintenance permits the existing admin exception. Status checks are read-only. The browser never receives the access token.

Server-only collections:

- `social_posts`: one deterministic record per run/platform with reviewed caption, target account, ordered route/image references, requester, timestamps, result, Meta IDs and staged Facebook photo IDs / Instagram parent container ID where available.
- `social_images`: JPEG bytes keyed by SHA-256. Only the explicit public image endpoint can serve them. Each image contains public route/run information only. Images remain separate documents so multiple photos do not exceed the per-document size limit.

The existing catch-all Firestore rules deny direct client access to both collections, including staff/admin clients. The server uses Admin SDK access. The public image endpoint supports GET/HEAD, validates image IDs, returns JPEG with cache headers, and never exposes the caption audit, credentials, code words, profiles or attendee lists. There is no expiration or scheduled purge; existing attendance/history/routes are untouched.

Publication intent is saved transactionally before contacting Meta. A pending/uncertain or successful record prevents a second send even after reload. Staging Facebook photos or Instagram children alone does not create the final feed post. A failure staging any route prevents publishing a partial set. The server verifies that submitted route IDs exactly match the current saved run, in order, before any platform write. Definite rejection/pre-publication failure is retryable; an ambiguous final send is not. There is no unattended job or automatic retry.

## Remaining activation and acceptance

- Identify the club Page and linked professional Instagram account and provision authorized Meta access.
- Configure the secret, deploy the service and hosting, and verify the target account identities.
- Review an actual public run's generated route images/caption, then send an owner-approved first post to the selected destinations and verify its appearance in each account.
- Confirm partial-failure and token-expiry handling using controlled test accounts; do not spam the club feed as a test.

Local tests use synthetic accounts and mocked Meta responses. They do not establish real token permissions or platform delivery. Automatic push announcements and run reminders were separately verified absent from source/deployment; see [Plan B](push-notifications-plan-b.md).

## Local validation — November 14, 2026

233 unit tests passed (including 12 new social copy/protocol/authorization tests); the 47 integration cases are skipped by the unit command. All 78 rules/seed checks passed, including direct client denial for both new collections. The 34-case browser suite passed, followed by all six social checks after adding the create-run scenario (36 unique browser checks across the complete set). App/browser/function type checks, production/function builds and lazy bundle checks passed; unit/type/build checks were also verified with the documented Node 24.22.2 toolchain. Lint has zero errors and 47 existing warnings. Generated desktop/mobile previews were captured; the desktop preview was visually inspected. These local checks do not establish live Meta account access or post delivery.

## Route-photo update — November 14, 2026

Only the street-map tiles visible in the generated preview are requested from `https://tile.openstreetmap.org`, using normal browser caching/referrer behavior and a shared per-preview tile cache. Every exported JPEG includes visible OpenStreetMap attribution and its copyright URL. This is an online map-image preview, not a tile archive/prefetch feature. See [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). No runner location permission or live location is used.

Route geometry is loaded on demand through the existing route loader. Missing geometry, failed tile downloads, missing/reordered route photos or an oversized image block publication with an explicit retry path. A partial set is never submitted. Browser tests use synthetic routes and intercepted map tiles; protocol tests verify both photos stay ordered in one Facebook/Instagram post and failure staging the second photo creates no final post.

Validation of the route-photo update: 240 unit tests passed, including geometry bounds/validation, ordered multi-photo API publishing, partial-stage failure and server route-set verification. All eight social browser checks passed across Chromium/mobile WebKit, including two-image preview, post submission and map-load failure/retry. App/browser/function type checks, production/function builds and lazy bundle checks passed with Node 24.22.2. Synthetic desktop route previews were visually inspected. No live social post or deployment was performed.
