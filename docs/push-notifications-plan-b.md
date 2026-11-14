# Push notifications — Plan B (send from the app)

**Status, November 13:** push sending from the app remains a proposal. Plan A (device registration plus Firebase Console sending) is implemented. `functions/` already exists for the deployed calendar feed; there is no announcement push trigger or automatic run-reminder scheduler. Confirm current billing and quotas rather than promising zero cost.

## Goal

Let an admin press **Post Announcement** in the app and have it reach phones as a push notification, without switching to the Firebase console. Pushes and announcements become the same thing: one post shows in everyone's bell **and** arrives on every phone that has notifications on.

## Where we are (Plan A)

| Piece | Today |
|---|---|
| Phones sign up | ✅ **Enable Alerts** or the profile menu → FCM token, via `public/push-sw.js` (scope `/push/`) |
| Device records | ✅ `push_devices/{sha256(token)}`, signed-in runners only, used for the admin count |
| Sending | ⚠️ Manual: Firebase console → Messaging → New campaign |
| In-app announcements | ✅ `announcements` collection → bell (live) |
| Pushes in the bell | ⚠️ Only on the phone that received them (saved by the push worker) |

**What's missing:** automatic sending from this app needs the project's **server credentials**, which must never be in the app. That means server-side code, which the free **Spark** plan doesn't allow. Firebase **Cloud Functions** need the **Blaze** (pay-as-you-go) plan.

## What Blaze changes

- **Billing:** a Google Cloud billing account (credit card) is linked to the project.
- **Quotas and charges:** inspect the services actually enabled, their current quotas and official pricing. Do not infer a zero bill from this proposal or from FCM delivery volume alone.
- **Unlocks:** Cloud Functions, which this plan needs.
- **Going back:** you can return to Spark later, after deleting the functions.

## Design

```
Admin: Post Announcement ("Also send to phones" ✓)
        │  writes announcements/{id}  { title, body, sender, timestamp, push: true }
        ▼
Cloud Function  onAnnouncementCreated   (Firestore trigger, us-central1)
        │  if push: Admin SDK messaging.send({ topic: "club", webpush: {...}, data: { announcementId } })
        ▼
FCM ──► every device subscribed to topic "club" ──► public/push-sw.js shows it
```

**Getting devices onto the `club` topic.** Topics must be managed with the Admin SDK, i.e. on the server:

- **Function `onPushDeviceWritten`** (Firestore trigger on `push_devices/{id}`):
  - **created:** subscribes the device's token to `club`.
  - **deleted:** unsubscribes it.
  - Covers signed-in runners.
- **Callable function `subscribeToClubAlerts(token)`:** covers devices that turned notifications on while **signed out**, which today don't write `push_devices`.
  - The app calls it right after `getToken`.
  - It only subscribes the token to the topic and stores nothing.
  - Add **App Check** (reCAPTCHA Enterprise / v3) so only the real app can call it.
- **Turning notifications off** calls `unsubscribeFromClubAlerts(token)`, or the record delete triggers the unsubscribe.

**Why a topic, not a list of tokens?** One `send()` reaches every subscriber, and FCM handles the fan-out and drops expired tokens. That keeps the function to a single call per announcement. The alternative, `sendEachForMulticast` over `push_devices` in batches of 500, also works, but only reaches signed-in devices and needs dead-token clean-up.

**Bell de-duplication.** The push carries `data.announcementId`. The push worker saves received pushes using that ID, and the bell hides a received push when an announcement with the same ID is already shown. So a posted-and-pushed announcement appears **once**, as an announcement.

**Console campaigns keep working.** Plan A's manual path is unchanged, so the console stays useful for one-off or targeted sends. Those pushes still show in indigo on the phone that received them.

## Work breakdown

### Phase 0 — Account setup (you, ~15 min)

1. Inspect the existing project and billing setup first: the calendar function is already deployed. Only provision or change billing if the owner approves the specific change.
2. Agree an appropriate budget and configure **Billing → Budgets & alerts** if approved. Alerts notify; they are not a spending cap. Any automated billing shutdown needs its own reviewed design and authorization because it could interrupt the live club app.
3. Confirm these APIs are enabled; the first `firebase deploy --only functions` prompts for them:
   - Cloud Functions
   - Cloud Build
   - Artifact Registry
   - Cloud Run
   - Eventarc
   - Pub/Sub
4. When the deploy asks, accept the **Artifact Registry cleanup policy** that keeps only recent images. This keeps storage under the 0.5 GB free tier.

### Phase 1 — Functions (code)

- **Extend the existing `functions/` package:** preserve the deployed `calendar` function and the build configured in `firebase.json`; add push functions and their tests. Reassess runtime/package versions when implementing.
- **Region:** `us-central1`. Firestore is in **`nam5`**, and Firestore triggers must run in a compatible region.
- **`onAnnouncementCreated`** (`onDocumentCreated('announcements/{id}')`):
  - Skips unless `push === true`.
  - Sends to topic `club` with:
    - `webpush.notification`: title, body, icon `/pwa-192x192.png`
    - `webpush.fcmOptions.link`: `/`
    - `data.announcementId`
  - Logs the message ID.
- **`onPushDeviceWritten`** (`onDocumentWritten('push_devices/{id}')`): subscribes on create or update, and unsubscribes the old token on delete.
- **`subscribeToClubAlerts` / `unsubscribeFromClubAlerts`** (`onCall`, `enforceAppCheck: true`):
  - Validates the token format.
  - Subscribes or unsubscribes it.
  - Stores nothing.
- **One-off backfill:** subscribe the tokens already in `push_devices` to `club`. Devices that signed up while signed out under Plan A get subscribed the next time they open the app; see the App changes below.

### Phase 2 — App changes

- **`src/services/push.ts`:**
  - After `getToken`, call `subscribeToClubAlerts(token)`. This is fine to retry, because subscribing is idempotent.
  - On app start, if this device has notifications on, call it again. This re-subscribes refreshed tokens and catches Plan A devices.
- **Admin → Push Alerts:**
  - **Post Announcement** gets an **"Also send to phones"** checkbox, on by default.
  - The Firebase-console instructions panel shrinks to a short "advanced: targeted sends" note.
- **`announcements` rule:** allow an optional `push: bool` field.
- **Bell:** hide received pushes whose `announcementId` matches a shown announcement.
- **`public/push-sw.js`:** save `data.announcementId` with each received push.
- **Optional:** App Check in the web app (`initializeAppCheck` with reCAPTCHA v3/Enterprise), needed for the callable functions.

### Phase 3 — Tests

- **Rules:** `announcements` accepts `push: true/false` and nothing else new.
- **Functions:** emulator suite with `firebase emulators:exec --only functions,firestore`. Check that creating an announcement with `push: true` calls `messaging().send` with the right topic and payload, using a mocked Admin SDK, and that `push: false` doesn't.
- **Manual:** two Android phones (one signed in, one signed out) plus an iPhone using the Home Screen app. Record observed delivery latency and notification state on all three devices; do not guarantee delivery within a minute. Each received announcement should show **once** in its bell.

### Phase 4 — Rollout

1. Deploy functions (`firebase deploy --only functions`), then rules and hosting.
2. Run the token backfill once.
3. Post a test announcement. Check the function logs and all three test phones.
4. After the agreed observation period, check usage and **Billing → Reports** against the approved budget; record actual costs.

**Rollback:**
- **Quick:** untick "Also send to phones", or delete the functions with `firebase functions:delete onAnnouncementCreated`. The app falls back to Plan A behaviour.
- **Calendar preservation:** do not delete all functions or downgrade billing as a push rollback. The existing `calendar` function supports the live subscription feed; removing it would change an unrelated feature. Any such change needs a separate owner-approved plan.

**Estimate:** about 1–1.5 days of build and test once Blaze is on, plus your Phase 0 setup.

## Cost and capacity review — required before implementation

The original cost estimate and quota table were planning assumptions, not verified current pricing. Recalculate for actual subscribers, sends, device writes, function runtime, builds, image storage and existing calendar usage. Use the current official service pricing and record the date/region. Include budget alerts and cleanup of obsolete build artifacts in the implementation plan; no service is enabled by this document.

## Risks and notes

- **iPhones still need the Home Screen app** (iOS 16.4+). Plan B doesn't change that Apple rule.
- **Topic delivery is best-effort:** pushes can be delayed when a phone is in deep battery saving.
- **Abuse:** only admins can create announcements (existing rule), and the callable functions need App Check, so nobody can spam pushes or flood the topic.
- **Privacy:** FCM tokens stay server-side. The topic stores no personal data, and signed-out devices are never recorded.

## Decisions for you

1. Confirm the existing billing account, approved usage budget and who monitors alerts; do not assume this project has no billing relationship.
2. **Signed-out phones:** should they get pushes too? If yes, that needs the callable function and App Check. If no, push goes to signed-in runners only, which is simpler and needs no App Check.
3. **"Also send to phones":** on by default, or off by default?
