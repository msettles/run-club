# Browser and real-device verification

## Automated regression suite

Use Node 24. Install browser engines once with `npx playwright install chromium webkit`, then run:

```
npm run typecheck:browser
npm run test:browser
```

Twenty-seven scenarios run in both desktop Chromium and mobile WebKit (54 checks as of release 1.6.4):

1. QR entry saves check-in and automatic RSVP before route/milestone screens are completed, retaining attendance after reload.
2. An incorrect code word does not write attendance; correction permits retry.
3. A freshly saved check-in can switch activity without duplicating attendance, mileage or RSVP.
4. The sign-in dialog contains keyboard focus in both directions; Escape restores the keyboard opener and scroll state.
5. Profile names are required before submission.
6. A failed profile save preserves entered names and can be retried without duplicate profiles.
7. Pending profile submission disables repeat submission and Cancel until completion.
8. A failed modal exposes recovery; Escape returns to the opener and the app can open another dialog.
9. Staff roster search matches partial names/emails and shows no-results states; CSV export remains complete.
10. A pending gear handout moves into fulfilled history.
11. A loop route offers exactly its configured loop choices and credits the selected count.
12. Failed offline check-in edits retain the choices and previously saved attendance until retry.
13. CSV/GPX route import preserves metadata and skips already imported routes.
14. Missing GPX files block route import before saving.
15. Direction generation completes through the route engine and saves the resulting route.
16. A social-post preview creates two route-map JPEGs and an editable caption; an explicit action submits both photos together to simulated Facebook/Instagram destinations.
17. Missing social configuration disables publication, leaves the run saved and allows closing the preview.
18. Creating a run with the social-preview option saves exactly one run before opening the separate preview; the saved run survives reload.
19. A map-tile failure blocks social publication without dropping a route; retry restores both route photos before publication is enabled.

20. My Runs shows only the signed-in member, separates undated credits and pages without removing stored history.
21. A member claims an available historical name from the profile, then reloads without duplicate credit or a second claim option.
22. Staff-assisted check-in updates the live table counts and gear queue and records the assisting identity; gear can be delivered once.
23. A future run disables assisted check-in until the normal window opens.
24. Guests receive runner actions without RSVP or staff tools on run cards, routes/maps and the profile menu.
25. Ordinary members receive runner actions and RSVP, without staff tools.
26. Organizers receive separate Organizer tools groups, with the run-card staff row below runner actions; Admin Portal remains absent.
27. Admins receive the separate staff groups and the admin-only portal entry.

Social browser scenarios use simulated account responses and send no real posts.

The suite freezes wall time, seeds synthetic localStorage profiles/events and blocks external requests. Its dedicated Vite configuration explicitly disables Firebase even when a developer has production `.env` values. The onboarding fixture mounts the actual profile component and local store with a controlled simulated registration transport; the check-in tests navigate the full app. It does not exercise Google OAuth, email-link delivery or Firebase auth restoration. Existing Firestore integration/rules tests remain responsible for server-side authorization, transactions and concurrency.

The tests found missing label associations in the profile form. Fields now have unique IDs and associated labels, and registration errors have alert semantics.

CI runs the suite in a separate job. On failure it retains screenshots and traces; its HTML report is available as an artifact for seven days. Reports contain synthetic fixtures only. Production builds do not include the browser fixtures or test configuration.

## iPhone layout review — November 14, 2026

Local mobile WebKit checks used synthetic staff data at 320, 375, 390 and 430 CSS pixels, plus an 844 × 390 landscape viewport for the run forms. Reviewed Runs, Routes, Milestones, Standings, profile editing and the admin tabs. Run-card actions and external route links now wrap within their cards; new/edit run Date and Start Time stack below the small-screen breakpoint; native form controls can shrink within their containers. Tall centered dialogs use safe alignment so their headings and close buttons remain reachable on short screens (the landscape profile heading previously started above the viewport).

Removed the redundant Copy link action. Share run remains the single sharing action, using the native share sheet when available and clipboard/manual-link fallbacks otherwise. Stubbed share/clipboard checks confirmed that both receive only the run URL. The production build and all 38 existing Chromium/mobile WebKit browser checks passed; lint completed with warnings and no errors. Screenshots are in `output/playwright/iphone-*.png`. These are browser-emulation results, not new physical-device acceptance results.

## Expanded iPhone layout review — November 14, 2026

The follow-up review covered all five main tabs and the public/signed-in views, all seven admin sections (including expanded import disclosures), create/edit run dialogs, profile editing and setup, selecting historical names, the populated run roster and emergency details, closed/guest/active check-in views, the multi-run chooser, check-in editing/success/badge screens, route editing/import, full-screen maps and both direction modes, announcements, installation help, brand resources, setup help, version information and the social-post preview. Checks used local synthetic data, 320 × 667 and 390 × 844 portrait viewports, 844 × 390 landscape, and a 390 × 400 short-viewport profile check. The main app was also checked with its normal web fonts and Leaflet styling loaded. Social connection responses were simulated; no posts, messages or production changes were made.

Additional repairs:

- Constrained the home hero content and reduced its heading at the smallest widths so words and body text remain inside the banner.
- Replaced the cramped, sideways admin tab strip with two columns on phones and wrapping tabs on larger screens; event headings/dates now wrap with spacing.
- Kept brand and check-in header close controls within the dialog, with title space allowed to shrink.
- Stacked mobile gear reward labels/values, wrapped long runner emails and badge-preview category/status pills.
- Allowed map-style controls to wrap clear of the zoom buttons and put direction-mode controls on a new row when needed.
- Wrapped the profile-setup email/authentication panel, stacked phone form fields and allowed the selected-history summary to wrap.
- Wrapped social account labels below their platform names so long account names do not create a horizontal scrollbar.
- Added room for the iPhone bottom safe area below the page footer and improved spacing in the check-in pet/submit controls.

Final page/map checks found no off-screen or clipped controls or overlapping visible map controls in the reviewed layouts. Wide admin tables retain their own horizontal scrolling. Screenshots and inspection scripts are under `output/playwright/review-*`; the production build and all 38 existing Chromium/mobile WebKit browser checks passed, and lint reported zero errors (46 existing warnings). This is an emulated Safari layout review; physical iPhone keyboard, installed-PWA safe-area and OS interaction behavior were not newly verified, and this review does not deploy the changes.

## Original per-device evidence template — categories owner-accepted

**Owner update, November 13, 2026:** the owner reports that most prior phone/sign-in checks have already been completed. Reuse those accepted results; the matrix below is retained only as an optional evidence template. The owner has since confirmed signup/history claims and attendance/mileage persistence; owner Admin access and the OAuth update correction were observed live. Use the dated acceptance sections below for those results. Do not infer unrecorded per-device push/GPS/accessibility outcomes or live interrupted-merchandise recovery from that acceptance.

Use [the detailed real-device test plan](real-device-test-plan.md) for prerequisites, case IDs, steps, pass criteria and result recording.

The owner has now accepted these phone-check categories (see the follow-up confirmation below). Desktop emulation alone did not establish those results. The cells below mean detailed device/case records were not supplied; they do not revoke owner acceptance:

| Scenario | iPhone / Safari & installed PWA | Android / Chrome & installed PWA |
| --- | --- | --- |
| Signed-out QR link → sign-in → profile setup → intended run | Owner accepted; details unrecorded | Owner accepted; details unrecorded |
| Check-in, auto RSVP, optional screens and edit after reload | Owner accepted; details unrecorded | Owner accepted; details unrecorded |
| GPS Allow, Deny, retry and stopping tracking when map closes | Owner accepted; details unrecorded | Owner accepted; details unrecorded |
| Push permission, actual console-sent notification delivery, disabling and account switching | Owner accepted; details unrecorded | Owner accepted; details unrecorded |
| Install, relaunch and offline/reconnect behavior | Owner accepted; details unrecorded | Owner accepted; details unrecorded |
| App update available while a profile/run form has unsaved entries | Owner accepted; details unrecorded | Owner accepted; details unrecorded |
| VoiceOver / TalkBack field labels, dialog navigation and error announcement | Owner accepted; details unrecorded | Owner accepted; details unrecorded |
| On-screen keyboard, small viewport, rotation and long-form scrolling | Owner accepted; details unrecorded | Owner accepted; details unrecorded |

For update checks, begin on the previous installed release, enter a distinctive unsaved form value, publish/load the newer release and verify that update controls do not silently discard the value. Then explicitly accept any reload and verify the reported version and sign-in state. Perform attendance/push checks using a designated test runner/event, with an organizer coordinating any production writes. A desktop browser test result does not establish push delivery or mobile OS permission behavior.

## Live desktop sign-in verification — November 13, 2026

Owner Google sign-in and opening the Admin dashboard passed in Chrome on both production hosts (`woodland-woodchuckers.web.app` and `woodland-woodchuckers.firebaseapp.com`) with v1.5.14. The dashboard showed maintenance paused and eight retained historical claims. The prior offline app shell intercepted Firebase's `/__/auth/handler` callback and displayed the homepage instead of completing sign-in. The service worker now excludes Firebase's reserved `/__` paths from navigation fallback; the server callback and live updated worker were checked, and the owner completed sign-in after updating. Users on the affected installed release can use the version button → Check for Updates & Refresh App before retrying. This establishes the desktop OAuth/update recovery path, mobile/push acceptance is recorded separately below.

## Owner-confirmed launch acceptance — November 13, 2026

The owner confirmed that the designated live test check-in added exactly one run, the correct mileage and total persisted after reload, and a new ordinary runner could sign up and claim historical names successfully. These are owner-reported live acceptance results; they are not inferred from automated tests. The final database audit confirms test-event/attendance cleanup and restoration of the retained account totals. The subsequent owner confirmation below closes phone push/GPS/accessibility acceptance. The device matrix is an optional template, not outstanding launch work.

## Owner follow-up confirmation — November 13, 2026

The owner reports that phone-specific push, GPS, accessibility and icon/update checks all look good, and explicitly confirms calendar subscription from the installed app. Treat those categories as owner-accepted. Device/OS versions and individual case records were not supplied; the original matrix remains an optional evidence template, not a reason to require repeating accepted checks. No automated test result is substituted for this owner report.
