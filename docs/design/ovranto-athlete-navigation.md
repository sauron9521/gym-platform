# Athlete Web — OVRANTO responsive navigation shell

**Design source:** #381 / #383 / #384 / #392.

This is the first implementation slice, not the completed approved dashboard
or full cross-product visual signoff.

## Before and after

- **Desktop:** old horizontal header links become a compact, persistent
  240px sidebar with active-route indication.
- **Mobile:** the old potentially overflowing header links become a
  brand/menu row plus a second row for theme and language controls.
- **Active route:** nested URLs receive `aria-current="page"` and a
  semantic primary-color tint.
- **Authorization:** every protected page retains its existing NestJS
  server-side session verification; the shared layout remains visual-only.
- **Deep links:** `/dashboard`, `/workouts`, `/exercises`, and `/profile`
  remain unchanged, including nested routes.

## Scope and follow-up

- Preserve the approved real-text OVRANTO brand, Manrope, Light/Dark/System
  theme selection, and Ukrainian/English navigation translations.
- Only add verified existing navigation links. Programs, history, calendar,
  trainer paths, and Start Workout need specific route/API verification.
- No new dependency, role or permission assumptions, changed route, API,
  query cache, session handling, or workout mutation behavior.
- **This slice:** desktop collapse and standardized Lucide icons with a
  cookie-backed visual preference; all existing routes and controls remain.
- **Follow-up:** dashboard hero and API-backed metrics, charts, and history.
- The mobile menu is non-modal and does not trap focus. Escape closes the
  menu and returns focus to its toggle; link selection closes it.

## Acceptance

Review 320/375/768/1280+ CSS widths, both Light/Dark themes and System,
uk/en longer strings, keyboard focus and Escape, screen readers, 200% zoom,
authenticated deep links, expired/forbidden sessions, and horizontal overflow.

Source/DOM contracts and GitHub CI run in this PR. Visual viewport and
manual usability review are still needed before closing the UX epic.

## Persistent desktop sidebar

The OVRANTO sidebar switches between an expanded 240px desktop column and
a compact 88px icon rail. Each icon-only link retains its accessible text name
using `sr-only`; a `title` provides a mouse hover hint. `aria-current="page"`
still identifies the current route. The mobile menu remains full-width and
independent from desktop collapse state.

The server reads `ovranto-sidebar=collapsed|expanded` (host-only, SameSite=Lax;
Secure on HTTPS) in the protected layout before rendering. The client updates
the cookie on toggle, so reloading the page does not flash the wrong width.
Unrecognized cookie values fall back to expanded.

Lucide React is a pinned dependency of `apps/web` only, not a new shared UI
system. The 200ms width transition respects `prefers-reduced-motion` and
all icons are decorative `aria-hidden` SVGs alongside real text labels.
This slice does not alter auth, workout mutations, other apps or API routes.
