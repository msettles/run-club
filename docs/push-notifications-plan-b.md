# Push notifications — Plan B (send from the app)

**Status:** proposal · **Today:** Plan A is live (v1.0.87) · **Expected cost:** $0/month at club scale, but a credit card must be on file

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

**What's missing:** sending a push needs the project's **server credentials**, which must never be in the app. That means server-side code, which the free **Spark** plan doesn't allow. Firebase **Cloud Functions** need the **Blaze** (pay-as-you-go) plan.

## What Blaze changes

- **Billing:** a Google Cloud billing account (credit card) is linked to the project.
- **Quotas:** everything that's free on Spark stays free on Blaze, with the same no-cost quotas. You only pay for usage above them.
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

1. Firebase console → **Upgrade** → **Blaze**, then link or create a billing account.
2. Google Cloud console → **Billing → Budgets & alerts**: create a **$1/month** budget with email alerts at 50% / 90% / 100%. Optionally cap it with a budget-triggered function, though that's usually not worth it at this scale.
3. Confirm these APIs are enabled; the first `firebase deploy --only functions` prompts for them:
   - Cloud Functions
   - Cloud Build
   - Artifact Registry
   - Cloud Run
   - Eventarc
   - Pub/Sub
4. When the deploy asks, accept the **Artifact Registry cleanup policy** that keeps only recent images. This keeps storage under the 0.5 GB free tier.

### Phase 1 — Functions (code)

- **New `functions/` package:** TypeScript, Node 22, `firebase-functions` v6, `firebase-admin`. Register it in `firebase.json` under `functions`, with a `predeploy` build step.
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
- **Manual:** two Android phones (one signed in, one signed out) plus an iPhone using the Home Screen app. A post with "Also send to phones" should reach all three within about a minute, and show **once** in each bell.

### Phase 4 — Rollout

1. Deploy functions (`firebase deploy --only functions`), then rules and hosting.
2. Run the token backfill once.
3. Post a test announcement. Check the function logs and all three test phones.
4. After a week, check **Billing → Reports**. Expect **$0.00**.

**Rollback:**
- **Quick:** untick "Also send to phones", or delete the functions with `firebase functions:delete onAnnouncementCreated`. The app falls back to Plan A behaviour.
- **To return to Spark:** delete all functions, then downgrade.

**Estimate:** about 1–1.5 days of build and test once Blaze is on, plus your Phase 0 setup.

## Cost check (why ~$0)

Assumptions: ~150 runners, ~100 phones with notifications on, ~3 announcements a week.

| Service | Expected use per month | No-cost tier (check current pricing) |
|---|---|---|
| FCM (sending pushes) | ~1,300 deliveries | **Always free**, no limit |
| Cloud Functions invocations | ~15 announcements + ~200 device writes | 2,000,000 / month |
| Functions compute | Well under 1 GB-second per run | Hundreds of thousands of GB-seconds / month |
| Cloud Build (deploys) | A few minutes per deploy | Free build-minutes allowance |
| Artifact Registry (function images) | ~0.1–0.3 GB with the cleanup policy | 0.5 GB |
| Firestore | Unchanged from today | Same free daily quotas as Spark |

The realistic way to get billed is **Artifact Registry storage**, if old function images pile up without a cleanup policy (cents per month), or a runaway loop in a function. The $1 budget alert catches either early.

## Risks and notes

- **iPhones still need the Home Screen app** (iOS 16.4+). Plan B doesn't change that Apple rule.
- **Topic delivery is best-effort:** pushes can be delayed when a phone is in deep battery saving.
- **Abuse:** only admins can create announcements (existing rule), and the callable functions need App Check, so nobody can spam pushes or flood the topic.
- **Privacy:** FCM tokens stay server-side. The topic stores no personal data, and signed-out devices are never recorded.

## Decisions for you

1. **Okay to put a card on the project** and set a $1 budget alert?
2. **Signed-out phones:** should they get pushes too? If yes, that needs the callable function and App Check. If no, push goes to signed-in runners only, which is simpler and needs no App Check.
3. **"Also send to phones":** on by default, or off by default?
