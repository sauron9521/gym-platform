# Athlete Web — OVRANTO responsive navigation shell

**Design source:** #381 / #383 / #384 / #392. This is a first implementation slice, not the completed approved dashboard or full cross-product visual signoff.

## Before → after

| Aspect | Before | This slice |
| --- | --- | --- |
| Desktop navigation | Horizontal links in a top header | Compact persistent 240px sidebar with active route indication |
| Narrow screens | Header links can overflow | Logo/menu first row and theme/locale controls second row; keyboard-accessible non-modal menu |
| Active route | No visible current-page state | Nested route-aware `aria-current="page"` and semantic primary tint |
| Auth boundary | Each protected page verifies with API | Exactly the same per-page server verification; layout remains presentation-only |
| Deep links | `/dashboard`, `/workouts`, `/exercises`, `/profile` | Same URLs, including nested routes; no client-only navigation guards |

## Scope / next slices

- Retains the approved real-text OVRANTO brand component, Manrope, Light/Dark/System setting, and uk/en navigation translations.
- Preserves verified existing links only. Athlete programs, history, calendar, trainer paths and Start Workout require actual route/API verification before introducing new navigation/CTAs.
- No new dependency, no extra role/permissions assumption, no changed route, auth, API, query cache or mutation behavior.
- **Follow-up:** collapsed sidebar with standardized Lucide icon treatment, dashboard hero & API-backed metrics, charts and recent workouts, guided by the approved board. Do not invent user data.
- The mobile menu is **non-modal** and does not trap focus. Escape closes it and returns focus to the toggle; links close it on navigation.

## Acceptance

Verify 320 / 375 / 768 / 1280+ CSS widths; no horizontal overflow; Light and Dark and System; uk/en longer strings; focus order and Escape; keyboard & screen reader navigation; 200% zoom; authenticated deep links, expired-session and forbidden scenarios, and server access checks. Source/DOM contracts and CI run in this PR; visual viewport/manual usability review remains required before marking the overall UX epic done.
