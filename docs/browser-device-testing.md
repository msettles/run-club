# Browser and real-device verification

## Automated regression suite

Use Node 24. Install browser engines once with `npx playwright install chromium webkit`, then run:

```
npm run typecheck:browser
npm run test:browser
```

Ten scenarios run in both desktop Chromium and mobile WebKit (20 checks):

1. QR entry saves check-in and automatic RSVP before route/milestone screens are completed, retaining attendance after reload.
2. An incorrect code word does not write attendance; correction permits retry.
3. A freshly saved check-in can switch activity without duplicating attendance, mileage or RSVP.
4. The sign-in dialog contains keyboard focus in both directions; Escape restores the keyboard opener and scroll state.
5. Profile names are required before submission.
6. A failed profile save preserves entered names and can be retried without duplicate profiles.
7. Pending profile submission disables repeat submission and Cancel until completion.
8. A failed modal exposes recovery; Escape returns to the opener and the app can open another dialog.
9. Staff roster lookup and CSV export retain their behavior with loaded-scope labels.
10. A pending gear handout moves into fulfilled history.

The suite freezes wall time, seeds synthetic localStorage profiles/events and blocks external requests. Its dedicated Vite configuration explicitly disables Firebase even when a developer has production `.env` values. The onboarding fixture mounts the actual profile component and local store with a controlled simulated registration transport; the check-in tests navigate the full app. It does not exercise Google OAuth, email-link delivery or Firebase auth restoration. Existing Firestore integration/rules tests remain responsible for server-side authorization, transactions and concurrency.

The tests found missing label associations in the profile form. Fields now have unique IDs and associated labels, and registration errors have alert semantics.

CI runs the suite in a separate job. On failure it retains screenshots and traces; its HTML report is available as an artifact for seven days. Reports contain synthetic fixtures only. Production builds do not include the browser fixtures or test configuration.

## Manual device checklist — pending

These checks have **not** been completed by desktop browser emulation. Record device, OS/browser version, installed app version, result and any failure for each:

| Scenario | iPhone / Safari & installed PWA | Android / Chrome & installed PWA |
| --- | --- | --- |
| Signed-out QR link → sign-in → profile setup → intended run | Pending | Pending |
| Check-in, auto RSVP, optional screens and edit after reload | Pending | Pending |
| GPS Allow, Deny, retry and stopping tracking when map closes | Pending | Pending |
| Push permission, actual run reminder delivery, disabling and account switching | Pending | Pending |
| Install, relaunch and offline/reconnect behavior | Pending | Pending |
| App update available while a profile/run form has unsaved entries | Pending | Pending |
| VoiceOver / TalkBack field labels, dialog navigation and error announcement | Pending | Pending |
| On-screen keyboard, small viewport, rotation and long-form scrolling | Pending | Pending |

For update checks, begin on the previous installed release, enter a distinctive unsaved form value, publish/load the newer release and verify that update controls do not silently discard the value. Then explicitly accept any reload and verify the reported version and sign-in state. Perform attendance/push checks using a designated test runner/event, with an organizer coordinating any production writes. A desktop browser test result does not establish push delivery or mobile OS permission behavior.
