# Shared modal accessibility and loading recovery

The app's check-in, sign-in, profile, scheduling, route studio, brand, version, setup and install dialogs use `Modal`, a native HTML dialog opened with `showModal()`.

- Each dialog has an accessible name. Icon-only close buttons have labels.
- Background content is inert while a dialog is open. Tab and Shift+Tab wrap inside its visible enabled controls; an empty dialog retains focus itself.
- Escape uses the existing close callback. Opening focuses the dialog, avoiding accidental activation of a form action. Closing restores the opener when it remains connected.
- Reference-counted body scroll locking supports nested dialogs and React Strict Mode cleanup.
- Lazy modal loading shows an accessible loading state with Cancel. A rendering/import failure shows Close and Reload controls; reload explicitly warns that unsaved form entries will be cleared. Closing clears every lazy modal's open state, including onboarding and setup, so the app remains usable.

Browser smoke checks on localhost verified sign-in focus containment in both directions, Escape and opener restoration. A temporary Strict Mode harness verified nested Escape behavior, retained parent scroll locks, deliberate rendering failure and recovery to the opener. The harness was removed after verification. No sign-in, production writes or deployment was performed.

Release-time validation (historical counts): 94 unit tests pass. Type checking, lint (zero errors, 48 existing warnings), production build and bundle limits pass. Native dialog behavior should still be included in the planned real-device Safari/Android smoke tests.
