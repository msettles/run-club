# One useful step at a time

The goal is a reusable Run Club platform, a separate Woodland Woodchuckers fork, and an isolated fictional club where interested people can try the application. We are working toward that gradually.

## 1. A public home and useful documentation

Publish this small project website and the existing help guides on GitHub Pages. Keep the guides close to their source so they can evolve with the app. This site introduces the software; the live Woodland club remains hosted separately.

## 2. Gather the club settings, gradually

Move branding, names, venue, schedule and other club settings into a documented configuration. Use small changes and verify Woodland continues to work at each step. Preserve existing account identifiers, stored data and installed-app behavior.

The [configuration extraction plan](../../docs/club-extraction-plan.md) is a proposal. Its phases will be split into reviewable changes before implementation.

## 3. Give Woodland its own fork

Once the reusable setup has been proven, keep the platform's shared code in the main project and Woodland's configuration in a dedicated fork. Establish how that fork receives platform updates before moving it. No production migration or new repository is implied by this roadmap alone.

## 4. Add a fictional demonstration club

Use generic branding, synthetic members and attendance, and a separate test project. Provide a documented way to try the runner experience, then consider controlled organizer demonstrations. The demo will have no access to Woodland accounts or records. Public login details and a demo link will appear only when it is ready.

## Support development — TODO

**Ko-fi is not configured yet.** The next funding tasks are to create a maintainer support page, connect its payment account, choose the public identity and add the verified link to GitHub and this site.

Contributions will be described as supporting software development, documentation, maintenance and demo costs, separately from Woodland club funds. There is no active payment button or promised supporter benefit today.

## Other feature work

Instagram/Facebook route-photo posting is awaiting account access and server activation. In-app push sending, automatic reminders and other proposed enhancements remain separate from the generalization work. See the [full product roadmap](../../todos.md) for details.
