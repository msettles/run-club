# Real-device acceptance test plan

Priority: highest. Prepared November 10, 2026 for the v1.2.5 release.

Status: **Not executed.** Automated browser results are separate evidence and do not establish that these real-device cases pass.

## Objective and scope

Verify the complete runner experience on real iPhone and Android devices: sign-in, onboarding, QR entry, attendance persistence, location permissions/tracking, actual push delivery, screen-reader navigation, and installed-app upgrades with unsaved forms. Include staff roster search as a release regression.

See [browser-device-testing.md](browser-device-testing.md) for automated coverage and [go-live-policy.md](go-live-policy.md) for data-retention and go-live rules.

## Device matrix

Record actual device, OS and browser versions; do not substitute emulation for a real device.

| Configuration | Primary coverage |
| --- | --- |
| iPhone, Safari browser tab | Sign-in, QR/deep links, check-in, GPS, VoiceOver, installation |
| Same iPhone, installed Home Screen app | Session persistence, check-in, GPS, push, VoiceOver, upgrades |
| Android phone, Chrome browser tab | Sign-in, QR/deep links, check-in, GPS, TalkBack, installation |
| Same Android phone, installed app | Session persistence, check-in, GPS, push, TalkBack, upgrades |

Run all P0 cases in each applicable configuration. This app directs iPhone push testing through its Home Screen app. Record unsupported contexts as **Not applicable** with the reason, never as Passed. Where available, repeat layout/accessibility cases on a smaller phone or an older supported device.

## Preconditions and test data

- App URL: `https://woodland-woodchuckers.web.app/`.
- QR check-in URL: `https://woodland-woodchuckers.web.app/?checkin=true`.
- Use a designated test environment or the owner's explicitly approved current testing project. Confirm the project and displayed build before starting; a deployed app is not evidence that go-live cleanup is authorized.
- Prepare a new runner with no profile, an existing runner, a runner with claimable historical names, an organizer and an admin. Use controlled test identities and private access to their sign-in inboxes.
- Prepare a clearly named test run with an open check-in window and known code word, another run with a closed/not-yet-open window, and two simultaneous open runs for ambiguity testing. Coordinate event times in America/Los_Angeles.
- Provide a non-loop route and a loop route with known credited mileage. Include one route without external links and one with approved working links.
- For global roster search, prepare a known runner outside the first 50 profiles, with a name and email suitable for partial matching. Do not create real people or claim real historical names without approval.
- Choose one test runner's starting attendance/mileage and record expected totals before each attendance test. Reusing an existing check-in is an edit, not a new attendance increment.
- Nominate an authorized push sender. The current supported sending workflow is Firebase Console Messaging; posting an in-app announcement alone is not proof of push delivery. Target designated test devices, not a club-wide audience.
- Have Wi-Fi and cellular connections available. Record notification, location, Focus/Do Not Disturb and battery-saving settings before each relevant case.
- For upgrade cases, install build A before deploying build B. If B is already deployed, coordinate two builds in the test environment; do not roll back the public site solely for this test.

## Recording and severity

For each execution record case ID, configuration, account role, app version/build hash, timestamp/time zone, network/permission state, steps, observed result, Pass/Fail/Blocked/Not applicable, evidence and issue link. Record push send/receive times separately. Redact emails, codes and precise location from shared evidence.

- **P0:** required before opening the club to runners; data loss, wrong attendance/identity, private-data exposure or inability to complete a core flow blocks acceptance.
- **P1:** important reliability/accessibility and recovery coverage. Document any exception and its owner before acceptance.

A spinner, a saved device registration, a successful console send, or an automated test pass is not evidence that a notification reached a phone or attendance reached the server.

## A. Sign-in, onboarding and session restoration

| ID | Priority | Steps | Pass criteria |
| --- | --- | --- | --- |
| AUTH-01 | P0 | Signed out, open the QR URL; use Google sign-in as an existing runner. Repeat from Safari/Chrome and installed app. | Correct identity/profile appears; flow returns to the intended check-in rather than another run or a guest profile. No sign-in loop. |
| AUTH-02 | P0 | Request an email sign-in link and open it on the same device in the normal mail-to-browser flow. Repeat when the installed app is present. | Sign-in completes once with the intended identity. Record which surface opens; there is a usable route back to the intended run. |
| AUTH-03 | P1 | Open an expired/invalid link, cancel Google sign-in, and try a sign-in request without connectivity. | Actionable error; controls permit retry; no false signed-in/check-in success. |
| AUTH-04 | P0 | Sign in as a new runner. Submit blank required names, then fill name, shirt size and optional fields. Save, dismiss/reopen if needed, then relaunch. | Validation identifies missing fields. One profile is saved with correct values; setup is resumable and does not overwrite an existing profile. |
| AUTH-05 | P0 | Using an approved historical test identity, select the intended unclaimed legacy name and complete setup. Try an already claimed name from another test runner. | Approved history is linked once; totals reconcile. Another runner's claim cannot be taken by an ordinary runner. |
| AUTH-06 | P0 | Sign in, background/close and relaunch; then sign out and sign in as another test runner. | Session restores to the correct profile. Prior private profile, attendance and staff search results do not leak to the other account. Staff controls disappear when the role lacks access. |

## B. Check-in and attendance integrity

| ID | Priority | Steps | Pass criteria |
| --- | --- | --- | --- |
| CI-01 | P0 | Scan the QR code during the open window. Enter the correct word, select a known non-loop route/activity and submit once. Immediately close after success, without visiting milestones. Relaunch and verify using the admin view/second device. | Exactly one saved check-in and automatic checked-in RSVP; expected mileage/activity and one attendance increment. Optional pages are not required. |
| CI-02 | P0 | Enter a wrong word, then correct it. Repeat with the word belonging to another open run. | Wrong word writes nothing and does not guess a different run. Correction permits check-in for the intended event. |
| CI-03 | P0 | Choose the loop route and a supported loop count; include walking/pet options. Save, then immediately use Change Distance / Update Check-In to change activity or loops. | Correct base-distance × loops credit. Editing replaces the previous contribution; it does not add another attendance/RSVP or retain the old activity totals. |
| CI-04 | P0 | Tap submit rapidly, use a slow connection, and repeat the same check-in from a second signed-in device. | No duplicate attendance, RSVP, mileage or milestone alert. Pending state is understandable; final totals agree across devices. |
| CI-05 | P0 | Disconnect before submit; reconnect and retry. If the connection drops during submit, verify the server state before retrying. | No false confirmation. A committed save can be recovered after reconnect; retries do not double-count. |
| CI-06 | P0 | Open a closed/not-yet-open run via card and shared link. Test the club-local boundary with an approved scheduled event, including a device set to another time zone. | Correct window message and no unauthorized attendance. The device's time zone does not change the club's window. |
| CI-07 | P0 | Open QR check-in with two open events and use each event's word in separate controlled runs. Open a share link to a specific event. | Correct event is selected; no silent fallback to another run. |
| CI-08 | P1 | Open route information after saving. Check blank versus configured Strava/Garmin/RunGo links, map/directions and return to rewards/edit. | Blank links are absent; configured links target the correct route. Map failure does not undo saved attendance or trap navigation. |

## C. GPS permissions and lifecycle

Perform movement checks in a safe outdoor area; do not operate the phone while driving.

| ID | Priority | Steps | Pass criteria |
| --- | --- | --- | --- |
| GPS-01 | P0 | Open a route map; tap Show My Location and allow permission. Move a short distance. Toggle tracking off. | Location/accuracy display updates plausibly; button state agrees with tracking. Turning it off removes tracking indicators in the app. |
| GPS-02 | P0 | Start with permission denied or deny the prompt. Retry, then restore permission through device/site settings and return to the app. | Clear error, no endless active-tracking state. After permission is restored, one new tracking session works. |
| GPS-03 | P0 | Start tracking; close the map/modal, switch away, reopen, then deliberately cause/recover from a location error where possible. | The old watch is stopped on cleanup/error; reopening does not create duplicate markers or duplicate active watches. Record OS indicator behavior separately. |
| GPS-04 | P1 | Background and foreground the installed app; lock/unlock the phone; test approximate/reduced-accuracy mode where available. | Foreground controls recover honestly; stale/unavailable location is not presented as a fresh fix. Continuous background navigation is not an acceptance assumption. |

## D. Push registration and actual delivery

Use unique non-sensitive messages such as `DEVICE-TEST <case ID> <timestamp>`. Before timing a delivery, record permission, network, Focus/Do Not Disturb and battery restrictions; identify OS suppression separately from registration failures. Agree on the observation window with the sender and record latency rather than assuming a guaranteed delivery time.

| ID | Priority | Steps | Pass criteria |
| --- | --- | --- | --- |
| PUSH-01 | P0 | On a fresh test device/context, enable alerts through the app. For iPhone, install/open the Home Screen app first. Accept permission. | Honest enabled state, permission and a usable device registration. Unsupported browser contexts show the installation/help path. |
| PUSH-02 | P0 | Have the authorized sender send one targeted test message. Test foreground, background and locked-screen delivery separately. | Phone actually receives the expected message in each supported state, with correct content and no duplicate presentation. Record platform-specific presentation and latency. |
| PUSH-03 | P0 | Tap the delivered notification with the app closed, then with it open. Inspect the bell/read state where supported. | App opens the expected destination without a blank page, stale identity or bypassed authentication. Notification content is handled consistently. |
| PUSH-04 | P0 | Disable alerts in the app; send another controlled test. Re-enable and send a fresh test. | Disabled state is accurate and the disabled registration stops receiving subsequent app pushes. Re-enabling restores delivery without duplicate registrations/messages. Distinguish already queued messages. |
| PUSH-05 | P0 | Deny permission; revoke it in OS settings; attempt enabling while offline; restore permission and retry. | App does not claim success when subscription/removal fails. Guidance permits recovery. |
| PUSH-06 | P0 | Register under runner A, sign out and sign in as runner B; inspect registration ownership with the admin and send an approved targeted test. | Registration is correctly rebound or disabled as designed; no private account-specific content for A is exposed to B. Registration count is not represented as a unique-person count. |
| PUSH-07 | P1 | Post a normal in-app announcement and separately send an actual push via the supported sender. | Testers can distinguish in-app announcements from push delivery; no unimplemented automatic reminder behavior is reported as passed. |

## E. VoiceOver, TalkBack and mobile layout

Run with VoiceOver on iPhone and TalkBack on Android. Repeat the main task flow without relying on visual positioning.

| ID | Priority | Steps | Pass criteria |
| --- | --- | --- | --- |
| A11Y-01 | P0 | Navigate sign-in, profile setup and check-in using screen-reader gestures. Read every input, selector, checkbox and action. | Meaningful names, required/selected states and a logical reading order. Icon-only controls are identifiable. |
| A11Y-02 | P0 | Open/close dialogs, enter nested dialog/help states, and trigger a controlled loading error. Where available, also use a hardware keyboard with Tab/Shift+Tab/Escape. | Focus enters the named dialog, cannot reach inert background controls, and returns to its keyboard opener on close. Recovery controls remain reachable. Touch behavior is recorded separately from keyboard focus. |
| A11Y-03 | P0 | Submit invalid profile details or an incorrect word, then complete a valid check-in. | Errors and saved status are announced or immediately discoverable; the reader is not stranded at an unrelated control. No visual-only success requirement. |
| A11Y-04 | P1 | Increase system text size, open the on-screen keyboard, rotate the phone and scroll long forms/maps. | Required fields, errors, submit and close controls remain reachable; no clipped essential content or unintended horizontal scrolling. |
| A11Y-05 | P1 | Use map/directions with the screen reader. | Useful textual route information is available without depending solely on the interactive map. |

## F. Installation, updates and unsaved forms

Update safety is an acceptance target, **not a verified feature**. The current Version dialog's **Check for Updates & Refresh App** calls a cache-refresh/reload operation. Do not assume that unsaved drafts are protected; record a failure if the cases below lose data silently.

| ID | Priority | Steps | Pass criteria |
| --- | --- | --- | --- |
| PWA-01 | P0 | Install from Safari/Chrome using the supported instructions. Launch from the app icon, sign in, background/close and relaunch. | Correct standalone app opens; version and identity are correct; normal run navigation works. |
| PWA-02 | P0 | On build A, leave a runner profile or staff run form open with a distinctive unsaved value. Make build B available. Wait for normal update handling, then background/foreground and navigate without accepting a reload. | No silent reload, lost value or unintended submission. An update must wait or provide a clear decision before discarding a draft. |
| PWA-03 | P0 | With a dirty form open, invoke Check for Updates & Refresh App. First decline any discard confirmation, then repeat and explicitly accept it. | Declining retains the draft; accepting makes any loss explicit. If the app provides no guard and silently discards the draft, record a failure—do not mark it passed because reload was requested. |
| PWA-04 | P0 | Save a check-in on A; upgrade to B; relaunch from the icon and open QR/shared-run links. | Saved attendance, totals and identity survive. B's version/build is visible; no duplicate save or stale-code failure prevents normal use. |
| PWA-05 | P1 | Go offline after a prior successful load; open the installed app, attempt a network-only action, then reconnect. | Cached content does not masquerade as fresh confirmed server data. Errors/loading are honest; reconnect restores operation without clearing historical records. |

## G. Release regression: staff global search

| ID | Priority | Steps | Pass criteria |
| --- | --- | --- | --- |
| SEARCH-01 | P0 | As staff, search for a known runner beyond the first 50 by partial first name, surname, mixed case, reversed words and partial email. Use role filters and Previous/Next matches. | Matching covers all registered profiles; page counts and identities are correct. No need to manually load the runner's roster page first. |
| SEARCH-02 | P1 | Type quickly, clear the query, search for a nonexistent runner, and retry after a connection failure. Refresh after changing a profile/role from the other device. | Old responses never replace a newer query. Errors differ from no matches. Refresh gets current data; the brief search cache is not mistaken for a live directory. |
| SEARCH-03 | P0 | Search as staff, then sign out/change to an ordinary runner. | No private cached roster or staff search UI remains accessible to the new session. |

## Exit criteria and evidence

- Every applicable P0 case passes on both real device families, including installed-app contexts. A blocked permission/delivery/update test remains Blocked, not Passed.
- Attendance/mileage/RSVP results reconcile with the admin/second-device view, and no private data is exposed across accounts.
- All failures have reproducible steps, evidence, severity and an owner. Resolve P0 failures and rerun the failed case plus related sign-in/check-in/update flows before club launch.
- Record P1 exceptions explicitly with owner acceptance; do not silently omit them.
- Keep test records according to the indefinite-retention policy. Do not automatically remove accounts, runs, routes or attendance afterward; deletion is only an explicit action by the authorized admin/organizer under existing safeguards. The separate go-live reset requires its own explicit instruction.

## Execution record template

| Case ID | Device / OS / browser | Browser or installed | Build A → B | Role / test identity reference | Network / permissions | Started / completed | Result | Evidence / issue | Retest result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Example: CI-01 | Fill in | Fill in | Fill in | Use a reference, not credentials | Fill in | Include time zone | Not run | Link | Not run |

For each failed case, attach numbered reproduction steps, expected versus actual behavior, whether it occurs again after relaunch, and redacted screenshots/video/logs. Never include sign-in links, tokens, code words or precise location in public issue attachments.
