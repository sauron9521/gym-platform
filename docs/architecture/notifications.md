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
checks. No separate Admin API is introduced.

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
