# Sharing a run

Each run card has a **Share run** button. On supported devices it opens the native share menu; otherwise it copies a permanent URL such as `https://woodland-woodchuckers.web.app/?run=RUN_ID`. If sharing or clipboard access fails, the URL is displayed in a selectable field.

Links contain only the public run ID, never code words or authentication parameters. Opening a link reads that run and its public meetup directly, independently of schedule pagination, and highlights its card. The linked documents remain live while the page is open. Normal RSVP, authentication and check-in-window rules apply. Removed or unpublished runs show an unavailable message; read failures have a retry action.

Firebase Hosting serves a static app, so social-media crawlers receive the site's general metadata. Per-run preview titles/images would require an additional server-rendered metadata endpoint.

Validation: 92 unit tests pass, including URL encoding, parameter stripping and invalid ID handling. Type checking, production build and bundle limits pass; lint has zero errors and the existing 48 warnings. No rules or data migration is needed.
