# ADR-008 — Unified Notifications architecture

- **Status:** Accepted target architecture; **not implemented** by this document
- **Decision date:** 2026-11-21
- **Identifier note:** Originally labeled ADR-006; renumbered to ADR-008 on 2026-11-24 to resolve the collision with Shared Package Boundaries. The decision, approval date and document path are unchanged.
- **Scope:** cross-app technical Epic [#563](https://github.com/sauron9521/gym-platform/issues/563), first docs slice [#564](https://github.com/sauron9521/gym-platform/issues/564)
- **Master roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353)
- **Related:** [event taxonomy](notification-events.md) · [delivery and failure policy](notification-delivery.md)

## Context (verified at ADR creation)

Gym Platform is a Turborepo with one NestJS API, PostgreSQL/Prisma, Redis, Athlete Web (Next.js), Trainer Web, Admin Web, Expo Mobile and shared `@gym/api-client` / `@gym/i18n`. Existing auth email verification/reset uses `@nestjs/mail` and SMTP/Mailpit. The NestJS API already imports `ScheduleModule`; Redis exists for other uses, but **no notification worker, persisted Inbox or push delivery pipeline exists in main**.

`Workout.scheduledAt` and `Workout.status` already exist, as does `Profile.timezone` (currently defaulting to `UTC`). The only notification-specific Mobile implementation is a contract/policy in `apps/mobile/src/features/notifications/lib/notification-policy.ts`, documented in [Mobile push design](../../apps/mobile/docs/push-notification-design.md). Its consent flags default to false; its `{ notificationId }` envelope is a validation contract, **not OS permission, device registration or push transport**. Existing user preferences support the preferred locale, not the full notification settings API.

## Approved product decisions

| Area               | Decision                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Core               | One durable per-recipient In-App Inbox shared across permitted Web, Mobile, Trainer and Admin contexts                      |
| Channels           | In-App, Mobile Push, Mobile Local Reminders and transactional Email; Web Push deferred                                      |
| Categories         | Trainer relationship, training program, workout, account/security; protected Admin/Owner context additionally               |
| Workout reminders  | User selects exactly one lead: **15, 60 or 1440 minutes**, local scheduling only after opt-in and native permission         |
| Quiet hours        | Default **22:00–08:00 in the user's IANA timezone**, editable/disableable; Inbox persists immediately                       |
| Live refresh       | MVP TanStack Query with 30–60-second **foreground/visible-only** unread polling, plus refetch on focus/resume and mutations |
| Live refresh later | Evidence-gated SSE for Web/Trainer/Admin that emits **change hints only**; client then GETs from API                        |
| Marketing          | Separate explicit opt-in **later**, never inferred from transactional consent or a device token                             |
| Admin              | Scoped inbox by **current server permissions**, not client flags, past role or notification payload                         |
| Delivery           | Best-effort push/email; never claim exactly-once physical delivery or mutate the source workflow based on delivery state    |

## Decision and boundaries

Use a **modular NestJS monolith**, not a Notifications microservice and not an additional user identity database. Source modules commit business state and a versioned **OutboxEvent** within the _same_ PostgreSQL transaction. A dispatcher claims outbox events, resolves recipients based on current domain ownership/authorization, creates immutable logical Inbox records idempotently, then schedules channel-specific deliveries against preferences, quiet hours, and device registrations.

A notification is a **read/navigation artifact**. It is not the source of truth for a trainer relationship, program, workout status, refund, approval, pricing change, role grant or incident. Clicking or marking one read never executes an approval or other privileged mutation. Permission to open the resource is evaluated again at the destination.

`In-App` persistence is the canonical user-visible delivery for ordinary app events. `NotificationDelivery` tracks external channel attempts independently; a failed SMTP/Expo send cannot roll back or duplicate the original business transaction. External delivery remains at-least-once/unknown-outcome in some failure cases; dedupe logical Inbox rows and avoid blind repeated sends when provider state is ambiguous.

### Data model and rollout status

| Entity                   | Ownership and principal fields                                                                                                                                           | Key invariant                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `Notification`           | `id`, `recipientId`, `eventId`, `scope` (USER/ADMIN), `type`, `category`, `resourceType`/`resourceId`, `templateKey`/safe parameters, `createdAt`, `readAt`, `expiresAt` | unique (`eventId`, `recipientId`, `scope`), indexed recipient/scope/date cursor           |
| `NotificationSettings`   | `userId`, quiet hours enabled/start/end, reminder lead selection                                                                                                         | one per user; timezone resolves from the existing canonical Profile setting               |
| `NotificationPreference` | `userId`, `category`, `channel`, `enabled`, consent timestamp                                                                                                            | unique (user, category, channel); transactional/security exceptions documented separately |
| `PushDevice`             | `id`, `userId`, installation identity, encrypted/secured Expo token, platform, revoked/lastSeen                                                                          | tokens never logged or returned broadly; revoke on logout/account switch                  |
| `NotificationDelivery`   | notification/event identity, channel, optional device, state/attempt/retry timestamps and redacted error                                                                 | idempotency key per notification + channel + destination                                  |
| `OutboxEvent`            | UUID ID, unique business event key, schema version, safe payload, available/lease/attempt/dead-letter state                                                              | same transaction as source business write; replay-safe                                    |

**N02a settings foundation (#908):** additive
`NotificationSettings` and `NotificationPreference` tables, no backfill.
Quiet boundaries are integer minutes since local midnight (0–1439),
start inclusive/end exclusive; equal endpoints are invalid even if disabled.
Default lead is 60 minutes. The MVP consent allowlist is TRAINER/PROGRAM
Mobile Push, WORKOUT Local Reminder, ACCOUNT optional Email; all default
off, enabling requires a consent timestamp and revocation clears it.
Neither Inbox nor urgent authentication/security mail is controlled by these
external-channel settings; marketing and Admin preferences remain deferred.
Profile timezone remains canonical. The pure policy validates strict nonempty
partial updates, merged quiet boundaries, timezone and actual-instant quiet
classification including repeated/skipped DST minutes. Reminder candidates
are absolute lead offsets; expired or quiet candidates are skipped.
It does not schedule or send, prompt permissions, or register tokens.
N02b implements authenticated GET/PATCH /users/me/notification-settings
with a repeatable-read snapshot for GET and serialized user-row locking
for PATCH, including first-write races. GET returns defaults without inserts;
PATCH changes only supplied fields, validates merged quiet boundaries and
uses server-generated consent timestamps (idempotent enable preserves the
timestamp; revocation clears it). The response contains four allowlisted
preferences in stable order with consentedAt, and the current profile timezone
(UTC when no profile; null for invalid legacy data). Unknown fields and query
parameters are rejected. No user ID, timezone, consent timestamp or delivery
state is accepted from clients. OpenAPI and generated client are updated.
The endpoint records preferences only; clients and transport are later slices. External-channel deferral, native
permission, device scheduling/dedup and security-mail routing remain gates.

**N03/N04 Inbox foundation (#566/#567):** an additive `Notification`
table uses the existing category enum and separate USER/ADMIN scope, a
cascading recipient FK, unique event/recipient/scope key, descending
recipient/scope/createdAt/id index, and unread lookup index. Outbox event
IDs are opaque references without a foreign key so transport and Inbox
retention can evolve independently. No historical backfill or dispatcher
is activated. Metadata beyond the fixed template key is deliberately deferred
until typed, event-specific safe projections are required.

| Endpoint                        | Response                                     |
| ------------------------------- | -------------------------------------------- |
| GET /notifications              | `{ data, nextCursor }`                       |
| GET /notifications/unread-count | `{ count }`                                  |
| GET /notifications/:id          | One safe notification projection             |
| PATCH /notifications/:id/read   | The same projection with stable readAt       |
| POST /notifications/read-all    | 204; marks currently eligible unread records |

The shared authenticated API uses ordinary cookie or bearer credentials,
never a caller-supplied recipient or scope. Foreign, ADMIN, expired,
unsupported and nonexistent notifications are indistinguishable (404 on
detail/mutation). All responses, including errors, are no-store.
The allowlist includes generic ACCOUNT security-change, five TRAINER relationship notifications (#570) and four PROGRAM assignment notifications (#571), and applicant review/revocation notifications (#572).
The response contains id, type, category, templateKey, createdAt and readAt.
PROGRAM notices additionally expose a typed, currently authorized assignment target.
No audit IDs, raw payloads or arbitrary navigation links are returned.
TRAINER and PROGRAM rows require current source state and recipient eligibility on every Inbox operation. Later event types require explicit projections and destination permission
checks. The USER API never includes ADMIN notifications.

N09b adds a separate admin-cookie-only /admin/notifications API with the
same five Inbox operations and strict limit/cursor/unread query. It requires
current active ADMIN status and the existing admin.accounts.manage operator
allowlist on every operation. Pending review alerts use ACCOUNT category
and ADMIN scope; no new preference channel or privilege is granted.
The source is the pending eligible trainer application, not the notification.
No private applicant identifiers or notes are returned.

List defaults to 20 rows, max 50; query fields are limit, cursor, category
and unread (true/false). Pagination sorts by createdAt DESC, id DESC and
uses a value cursor (UTC ISO timestamp plus ID); no row lookup or foreign
cursor can grant access. Replaying a single read preserves the original
read timestamp. Read-all uses a server-side cutoff and is safe to repeat;
it never changes source business state. OpenAPI and generated client
contracts are updated. Existing device registration, recipient resolution,
dispatch and external channels remain later slices.

## Product ownership and permissions

- **Athlete Web/Mobile:** read their USER-scope Inbox, workout/program/trainer links only if current resource policy allows.
- **Trainer Web:** same USER-scope account Inbox for authorized Trainer-capability events; a person can also have Athlete capability. Relationship termination or moderator revocation blocks protected resource details.
- **Admin:** ADMIN-scope records and review links require current, explicit server permissions. Current Prisma `Role` is ATHLETE/TRAINER/ADMIN; Super Admin privileges are not a standalone Prisma role today. Do not turn a general `ADMIN` role or a client flag into unrestricted Inbox/audit access.
- **Super Admin billing reviews:** [#539](https://github.com/sauron9521/gym-platform/issues/539), [#542](https://github.com/sauron9521/gym-platform/issues/542), [#543](https://github.com/sauron9521/gym-platform/issues/543), [#544](https://github.com/sauron9521/gym-platform/issues/544) own privilege checks, source workflow and review UI. Their notifications reuse this core; they do not create a second Notification table.
- **Owner work queue:** [#557](https://github.com/sauron9521/gym-platform/issues/557) aggregates authorized task/case state across owning domains; unread notifications and pending approval are **different counters**.
- **Public Landing:** no authenticated notification content.

## Delivery phases and dependency separation

1. **Contracts/settings:** #564 ADR; #565 user settings/consent/quiet-hours policy (coordinates [#297](https://github.com/sauron9521/gym-platform/issues/297)).
2. **Persistent Inbox:** #566 Prisma model; #567 typed authenticated Inbox REST; #568 transactional outbox; #569 dispatcher and bounded retries.
3. **Event producers:** #570 Trainer–Athlete; #571 program assignment; #572 account/moderation.
4. **Clients:** #573 Athlete Web; #574 Athlete Mobile; #575 Trainer Web; #581 Admin shell; #576/#577 settings UI.
5. **Device and channel-specific scope:** E11 [#321](https://github.com/sauron9521/gym-platform/issues/321) owns #340–343 calendar, timezone/DST, Mobile local reminders, Expo push token/sender. Device QA gates #348/#349 remain open until observed on real devices. #578 owns optional notification email, #579 operations and privacy. SSE #580 deferred until measured.
6. **Governance:** Admin billing #543 and Owner aggregation #557 plug into shared infrastructure only when their respective approval/security dependencies are satisfied.

**No new Redis/BullMQ requirement for MVP.** Start with PostgreSQL outbox/lease and existing NestJS scheduling. If measured workload justifies separate queues/workers, introduce BullMQ in a reviewed design slice without changing the domain events or persistent Inbox contract.

## Non-goals for this ADR

This is documentation only: **no migrations, API endpoints, job runners, client routes, push credentials, SMTP template updates, production enabling, or completed QA claims**. Web Push, marketing campaigns and native behavior not verified on devices are explicitly outside its completion criteria.

See [event taxonomy](notification-events.md) and [delivery policy](notification-delivery.md) before implementing an event producer or transport adapter.

### N10: Athlete Web Inbox (#573)

The Athlete shell mounts a single notification session boundary and
unread-count bell. The authenticated `/notifications` page uses the
existing browser session API client and FSD notification feature
(`api/model/ui`), shared design tokens and uk/en catalog. Only the
unread-count query has a 60-second foreground interval. Hidden tabs
disable queries and cancel outstanding reads; focus/reconnect revalidate
the account. List fetching is page-driven (20 items per cursor), with
category/unread filters and explicit load more. Successful or ambiguous
read mutations invalidate the owner-scoped count/list without optimistic
read changes. Mark-all applies to the entire currently eligible Inbox,
not just the selected filter.

Cache keys include the verified account ID and share the canonical profile
query with the shell and profile editor. The Web client sends the expected
owner in the optional `x-inbox-owner` header for every Inbox operation.
The API compares it with the authenticated principal before accessing the
Inbox; a mismatch returns 409 and never reads or mutates another account.
The client hides stale data, revalidates the shared profile on mismatch
and removes previous-owner queries. HTTP 401 clears private cache and
redirects; 403 fails closed without logging out. Other clients may omit
the header; existing authenticated recipient checks remain unchanged.
Polling performs only the unread-count request, not additional profile
requests. No notification content is persisted locally.

Semantic program targets and trainer events navigate only to the existing
authorized athlete programs/trainers lists. Exact assignment detail Web
navigation is a follow-up; review/security notices are generic and never
invent a decision or link. No ADMIN scope, push, SSE or arbitrary URLs.

### N11: Athlete Mobile Inbox (#574)

The four approved bottom tabs remain unchanged; Athlete-capable accounts
have a bell and unread count in the tab header. The protected, account-keyed
`/notifications` route provides the Inbox, category/unread filters, cursor
pagination, pull-to-refresh and explicit read/read-all actions. UK/EN and
the native design tokens support both themes. There is no polling interval,
background job, push permission or device registration. Query refresh is
driven by mount, focus, reconnect, explicit refresh and read mutations.
Read-all affects every currently eligible Inbox item, not just the filter.

The verified account cache entry is retained for the authenticated
lifetime and removed by the existing AuthProvider clear on logout,
background and re-verification. The Inbox captures the entry identity as
an epoch; a replacement invalidates outstanding operations, even for
the same account. Existing revision-scoped API tokens and the optional
`x-inbox-owner` server fence prevent stale requests from attaching a
different account. No extra profile requests or persistent notification
storage. Offline read writes are not queued, never automatically retried,
and invalidate server-authoritative list/count after an ambiguous result.
Stale or denied data is suppressed rather than displayed from cache.

The existing notification open coordinator accepts only an opaque UUID
envelope, validates current Athlete scope, reads fresh authorized Inbox
detail, then reads the actual assigned program with a scoped token and
verifies its ID and athlete ownership. Navigation uses the fixed
`/programs/[id]` route, not a URL from a payload or cached list.
Blur, logout, background and session epoch replacement cancel or invalidate
outstanding open intents. No unsupported trainer relationship or account
deep link is invented. OS push listeners, native permissions and token
registration remain #343; native device QA remains #348/#349.

### N12: Trainer Web Inbox (#575)

Trainer workspace mounts a single TanStack Query provider (the same pinned
version as Athlete Web). Public routes do not mount it; confirmed sign-out
clears its cache before navigation. The header bell and protected Inbox
share USER records and read state with Athlete and Mobile; dual-role users
can see their own eligible personal notices, not another athlete's notices
or ADMIN records. The client reads the account once per workspace mount
and again on an owner mismatch. Only the count polls every 60 seconds in
the visible tab; focus/reconnect and writes invalidate the relevant queries.
No additional profile polling, external delivery or notification storage.

All five shared Inbox operations accept an optional
`x-inbox-audience: trainer` header, requiring a fresh trainer capability
check after the existing authenticated-owner fence. This is an additional
restriction, not a new permission or recipient selector. Existing USER
authorization and visibility remain authoritative; the capability check
is not a cross-operation transaction fence. A 401 clears private cache,
403 suppresses the Trainer Inbox and 409 revalidates identity. Existing
Athlete and Mobile callers can omit the audience header.

Only an accepted, currently ACTIVE relationship whose recipient is its
trainer has a typed `TRAINER_RELATIONSHIP` target. It exposes no athlete
contact data. Before opening, the client fetches fresh detail and checks
the existing owner-scoped progress endpoint, then navigates to the
fixed Trainer client route, whose SSR guards recheck independently.
Termination removes obsolete targets. Program-assignment notifications
are athlete-owned; Trainer shows generic personal notices without claiming
trainer access to the assignment. No trainer-specific program event
or editor destination is invented.

### N13: Athlete Web notification settings (#576)

The existing protected `/profile/settings` page contains an account-owned
notification settings panel. It uses generated API contracts, the four
allowlisted category/channel pairs, server-projected IANA timezone and
15/60/1440-minute reminder lead times. Time inputs are local wall-clock
minutes; equal/invalid endpoints cannot be submitted and both endpoints
are sent atomically, including overnight intervals. Consent toggles send
one pair and update only after a validated server response. Time edits are
explicitly unsaved until Save. Quiet-hour edits remain available when
quiet hours are disabled. No native permission request or marketing UI.

The optional `x-notification-owner` header fences GET/PATCH to the
authenticated account without adding profile polling or selecting a
recipient. Existing clients may omit it. Account-scoped TanStack Query
state is not persisted; the form suppresses stale or denied responses,
disables offline/hidden writes, and never replays PATCH. Ambiguous writes
reconcile via GET only. A current 401 clears private cache and redirects;
403/409 require reopening the protected page. Existing locale/workout
preferences and urgent account/security delivery remain independent.

### N14: Athlete Mobile notification settings (#577)

The protected profile settings route now composes the existing workout,
theme and locale controls with account notification preferences. It uses
the same four server-authoritative category/channel pairs, canonical
timezone, local-minute quiet interval, and 15/60/1440-minute lead times
as Web. Explicit consent changes and atomic time saves use the existing
verified account epoch, revision-scoped token client and optional
`x-notification-owner` header. No extra profile fetch, duplicate storage,
polling, optimistic consent, offline mutation queue or PATCH retry.
After an ambiguous response, GET-only reconciliation confirms the current
state. Logout/account switch/background invalidate outstanding work;
401 expires only the current verified session, 403/409 hide controls
and require a fresh authorized read.

Device permission is a separate read-only adapter contract with
granted/denied/undetermined/unavailable states. Current builds have no
native notification module and honestly show unavailable. No permission
prompt, token registration, scheduler, native dependency or delivery
is added. #342/#343 must supply the actual native status reader and
opt-in/revocation lifecycle, with physical device verification #348/#349.
The existing server consent UI never grants OS permission.

### N15: optional transactional email (#578)

The existing PostgreSQL delivery state machine and SMTP transport now
support the optional account-update email for committed trainer reviews.
Both dispatch and email feature flags must be enabled; default is off.
Consent, source ownership, current verified address and quiet hours are
rechecked before each bounded attempt. The UK/EN templates link only to
the protected Athlete Inbox without revealing the review result or
application data. Verification and recovery mail remain canonical Auth
flows. See [delivery policy](notification-delivery.md) for deadlines,
retry classification, privacy and rollout limits.

### N18: Admin notification shell (#581)

Authorized Admin pages reuse a shared header bell and account-keyed,
memory-only TanStack Query provider. The dedicated protected
`/notifications` page checks the admin-purpose session before rendering;
every subsequent API read/write enforces current operator permission
and the optional expected-account fence `x-inbox-owner`. Only the
allowlisted moderation review notification projection is accepted.
Foreground-only 60-second polling and focus/reconnect reconciliation
replace any need for SSE at this stage. Hidden/offline states suppress
private content; 401/403/409 stop access until a fresh page verification.
A permission change is enforced immediately by the next API request;
the UI cannot detect a server-side change before revalidation.

Unread status is separate from pending action. Marking read changes
only Inbox state, never a review decision or financial approval. The
dedicated trainer-review action route is not yet available in Admin,
so the current generic notice has no fabricated target or approval
control. Future deep links must revalidate current source and permissions.
Billing and Owner queues remain owned by #543/#557; no additional
notification store is created. SSE #580 remains evidence-gated.
