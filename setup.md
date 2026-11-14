# Woodland Woodchuckers PWA — setup and deployment

Use Node.js 24 (`.nvmrc` and CI), plus Java 21+ for Firestore emulator tests. The repository pins its Firebase CLI in `package-lock.json`; use that installed CLI rather than fetching `firebase-tools@latest` for each command.

## Local development

```bash
npm ci
npm run dev
```

Without Firebase configuration, the app uses local sample data in browser storage. For a connected project, copy `.env.example` to `.env` and fill in the project's Firebase web configuration and optional VAPID public key. With real configuration, development can read and write the real project; use a separate test project for experiments. Never commit `.env` or private club data.

## Firebase services and billing

The client uses Firebase Auth, Firestore, Hosting and FCM device registration. Mapping and GPX/directions processing run in the browser, with OpenStreetMap/Overpass services subject to their availability and usage policies.

The supplied live calendar subscription endpoint (`/calendar.ics`) is a Cloud Function in `functions/src/index.ts`. Production function deployment requires Blaze. See [Firebase's function deployment requirements](https://firebase.google.com/docs/functions/get-started#deploy-functions-to-a-production-environment). No-cost quotas do not guarantee that all enabled services or all usage will cost zero. Confirm the actual project's billing plan, budgets, quotas and backup settings in the console.

In-app announcements and push device registration are implemented. Phone pushes use Firebase Console Messaging. In-app push sending and automatic reminders are still proposals; see [Plan B](docs/push-notifications-plan-b.md).

## New project provisioning

For a new club, follow [new-club-setup.md](docs/new-club-setup.md). Do not recreate or reset the existing Woodland project to follow this guide.

1. Use a dedicated club-owned Google account; create the project, web app and Firestore database.
2. Enable Google and passwordless email-link authentication. Verify the production domains are authorized and the sign-in handler works.
3. Configure Firebase Hosting and the project's `.env` values. Set owner email consistently in `src/utils/roles.ts` and `firestore.rules`.
4. Configure the calendar function if offering subscriptions. Confirm billing requirements first.
5. Generate a web-push VAPID public key if enabling device notifications.
6. Choose backup/restore ownership separately. CSV imports are not a full database backup.

## Validate and deploy

Authenticate as the intended club deployment account and confirm the project before deployment:

```bash
npx firebase login
npx firebase use
```

Build and deploy the app and security rules together:

```bash
npm run build
npx firebase deploy --only firestore:rules,hosting --project YOUR_PROJECT_ID
```

When provisioning or changing the calendar server code, deploy that function as well:

```bash
npm run build:functions
npx firebase deploy --only functions:calendar --project YOUR_PROJECT_ID
```

Run `npm test`, type checking and the checks appropriate to the changes. Store integration and rules emulator suites both use port 8085, so run `npm run test:integration` and `npm run test:rules` sequentially. Browser tests use synthetic local data; live OAuth, actual notifications and device behavior need separate acceptance.

GitHub Pages alone does not provide Firebase Hosting's `/calendar.ics` function rewrite or reserved authentication endpoints. An alternate host needs its own routing and authentication design; copying `dist/` alone is not an equivalent deployment of all features.

## Installed app acceptance

- iPhone/iPad: install from Safari's Share → Add to Home Screen.
- Android: use Chrome's install prompt/menu.
- Verify the current version, sign-in restoration, route download/cache and offline/reconnect behavior on the actual device. Offline viewing does not imply an offline check-in was saved.
- Preserve the service worker's exclusion for Firebase reserved `/__` pages; otherwise the offline app shell can intercept Google sign-in callbacks. If using an affected installed release, use the version button → Check for Updates & Refresh App, then retry sign-in.
- Verify installed icons and splash on the device: mobile operating systems can keep an older shortcut icon after a web deployment.

## Existing Woodland launch state

The November 13 history replacement and owner acceptance are complete; do not repeat cleanup or reset as part of deployment. See [go-live-policy.md](docs/go-live-policy.md), the [readiness review](docs/go-live-readiness-review.md), and [documentation status](docs/documentation-status.md). Maintenance and the import fence were explicitly released. Data retention remains indefinite.
