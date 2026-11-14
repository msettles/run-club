# Browser and real-device verification

## Automated regression suite

Use Node 24. Install browser engines once with `npx playwright install chromium webkit`, then run:

```
npm run typecheck:browser
npm run test:browser
```

Fifteen scenarios run in both desktop Chromium and mobile WebKit (30 checks):

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

The suite freezes wall time, seeds synthetic localStorage profiles/events and blocks external requests. Its dedicated Vite configuration explicitly disables Firebase even when a developer has production `.env` values. The onboarding fixture mounts the actual profile component and local store with a controlled simulated registration transport; the check-in tests navigate the full app. It does not exercise Google OAuth, email-link delivery or Firebase auth restoration. Existing Firestore integration/rules tests remain responsible for server-side authorization, transactions and concurrency.

The tests found missing label associations in the profile form. Fields now have unique IDs and associated labels, and registration errors have alert semantics.

CI runs the suite in a separate job. On failure it retains screenshots and traces; its HTML report is available as an artifact for seven days. Reports contain synthetic fixtures only. Production builds do not include the browser fixtures or test configuration.

## Original per-device evidence template — categories owner-accepted

**Owner update, November 13, 2026:** the owner reports that most prior phone/sign-in checks have already been completed. Reuse those accepted results; the matrix below has not yet been reconciled case-by-case with that report. The owner has since confirmed signup/history claims and attendance/mileage persistence; owner Admin access and the OAuth update correction were observed live. Use the dated acceptance sections below for those results. Do not infer unrecorded per-device push/GPS/accessibility outcomes or live interrupted-merchandise recovery from that acceptance.

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

Owner Google sign-in and opening the Admin dashboard passed in Chrome on both production hosts (`woodland-woodchuckers.web.app` and `woodland-woodchuckers.firebaseapp.com`) with v1.5.14. The dashboard showed maintenance paused and eight retained historical claims. The prior offline app shell intercepted Firebase's `/__/auth/handler` callback and displayed the homepage instead of completing sign-in. The service worker now excludes Firebase's reserved `/__` paths from navigation fallback; the server callback and live updated worker were checked, and the owner completed sign-in after updating. Users on the affected installed release can use the version button → Check for Updates & Refresh App before retrying. This establishes the desktop OAuth/update recovery path, not the pending mobile/push checks above.

## Owner-confirmed launch acceptance — November 13, 2026

The owner confirmed that the designated live test check-in added exactly one run, the correct mileage and total persisted after reload, and a new ordinary runner could sign up and claim historical names successfully. These are owner-reported live acceptance results; they are not inferred from automated tests. The final database audit confirms test-event/attendance cleanup and restoration of the retained account totals. Specific phone models, OS versions and results for unrelated push/GPS/accessibility scenarios were not supplied, so the device matrix above remains a separate follow-up rather than being silently marked complete.

## Owner follow-up confirmation — November 13, 2026

The owner reports that phone-specific push, GPS, accessibility and icon/update checks all look good, and explicitly confirms calendar subscription from the installed app. Treat those categories as owner-accepted. Device/OS versions and individual case records were not supplied; the original matrix remains an optional evidence template, not a reason to require repeating accepted checks. No automated test result is substituted for this owner report.
