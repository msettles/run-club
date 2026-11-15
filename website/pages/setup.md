# Your club, your own copy

The intended model is one club-specific repository, one build and one Firebase project per club. Today, setting up a new club still requires editing several files. A single reusable configuration is planned.

## Explore locally first

Use Node.js 24 and install both dependency sets:

```bash
npm ci
npm ci --prefix functions
npm run dev
```

Without Firebase configuration, local mode uses sample data in your browser. It is separate from the live Woodland club. This is a useful first look while the hosted generic demo is still pending.

When adding real Firebase configuration, use your own test project for experiments: configured development can read and write that project.

## What a club maintains

- Its own name, branding, venue, schedule and time zone.
- Its own Firebase authentication, database, hosting and authorized owner account.
- Its own route library, member data, attendance and reward definitions.
- Its deployment, billing settings, access and recovery arrangements.

The calendar feed and authenticated assisted check-in use server functions. Production function deployment requires a billing-enabled Firebase plan. No-cost quotas do not guarantee zero cost.

## Choose a guide

| Guide | Purpose |
| --- | --- |
| [Setup and deployment](../../setup.md) | Local configuration, builds, active server functions and deployment verification. |
| [New club setup](../../docs/new-club-setup.md) | Current manual steps for adapting the platform to another club. |
| [Roadmap](roadmap.md) | The smaller steps toward a reusable setup and isolated demo. |

The source uses the **PolyForm Noncommercial License 1.0.0**. Review the [license](../../LICENSE) before adopting or distributing it; commercial use requires separate permission from the author.
