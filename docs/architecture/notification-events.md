# Notifications — event taxonomy, ownership and contract

- **Status:** Accepted target contract (documentation only; not yet emitted in running applications)
- **Parent:** [#563](https://github.com/sauron9521/gym-platform/issues/563); contract slice [#564](https://github.com/sauron9521/gym-platform/issues/564)
- **Architecture:** [notifications.md](notifications.md) · **Delivery:** [notification-delivery.md](notification-delivery.md)

## Event envelope (conceptual, versioned)

Producers publish an event **only after a successfully committed business-state transition**, by inserting its record in the **same database transaction**. The envelope is not a public user-controlled mutation DTO:

```json
{
  "eventId": "96c8ab2a-3b2c-4a61-8d4c-835d78b07e43",
  "eventKey": "program-assignment:sample-uuid:assigned:v1",
  "type": "program.assigned",
  "schemaVersion": 1,
  "occurredAt": "2026-11-21T18:00:00.000Z",
  "actorUserId": "d1d2e777-7a2e-4183-a68f-6dd6e125b6a1",
  "aggregate": {
    "kind": "TrainingProgramAssignment",
    "id": "21b68dd6-a42b-4237-a8f3-303af6c2291d"
  },
  "context": {
    "athleteId": "219ad88b-15dd-42c0-ac74-6370b5c4ace5"
  }
}
```

The sample IDs are placeholders. Producers should prefer IDs and a minimum non-sensitive routing context, **not snapshots** of names, emails, messages, workout logs, health data, pricing/payment details, credentials or a full resource. The recipient resolver re-reads current authoritative domain state. `eventKey` must be deterministic for the same legitimate transition (and different for a new legitimate revision/state transition); do not use time alone or infer uniqueness from a request retry.

When a domain transition is atomic under an existing repository transaction, add outbox insertion to **that same transaction** (never emit from an after-commit best-effort handler without durable reconciliation). A failed/rolled-back update generates **no event**. Do not publish duplicate events when an idempotent operation returns an already persisted result.

## Initial event-to-recipient policy matrix

Legend: `I` = durable In-App; `P` = opt-in Mobile Push; `E` = optional transactional email subject to settings; `L` = Mobile Local Reminder scheduled on device, not a generic server fanout. All external channels are disabled if consent/device eligibility is absent; sensitive account-recovery messages continue through existing auth flow.

| Event type                                    | Domain source                                                         | Recipient resolver                                           | Category / scope | MVP vs later                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `trainer.invitation.created`                  | TrainerAthlete                                                        | Invited participant (not actor)                              | TRAINER / USER   | I; P optional later                                                                                  |
| `trainer.invitation.accepted`                 | TrainerAthlete                                                        | Initiating participant                                       | TRAINER / USER   | I; P later                                                                                           |
| `trainer.invitation.declined` / `cancelled`   | TrainerAthlete                                                        | Initiating/other eligible participant if policy allows       | TRAINER / USER   | I                                                                                                    |
| `trainer.relationship.terminated`             | TrainerAthlete                                                        | Other participant(s) with safe redacted status               | TRAINER / USER   | I; P later                                                                                           |
| `program.assigned`                            | TrainingProgramAssignment                                             | Assigned athlete                                             | PROGRAM / USER   | I; P later                                                                                           |
| `program.assignment.cancelled` / `terminated` | TrainingProgramAssignment                                             | Affected athlete                                             | PROGRAM / USER   | I                                                                                                    |
| `workout.reminder.due`                        | Schedule/Workout                                                      | Workout athlete with PLANNED future schedule                 | WORKOUT / USER   | **L** from mobile schedule; server-side reminders only if explicitly designed with per-device dedupe |
| `account.security.changed`                    | Auth/User                                                             | Affected account holder                                      | ACCOUNT / USER   | I; urgent security E policy                                                                          |
| `trainer.application.reviewed`                | Trainer onboarding                                                    | Applicant (only after review committed)                      | ACCOUNT / USER   | I; optional E                                                                                        |
| `admin.trainer.review.required`               | Trainer onboarding                                                    | Current permitted moderators/operators                       | ADMIN / ADMIN    | I; optional E later                                                                                  |
| `admin.billing.approval.requested`            | Billing [#542](https://github.com/sauron9521/gym-platform/issues/542) | Current authorized Super Admin(s), filtered on read/delivery | ADMIN / ADMIN    | I via [#543](https://github.com/sauron9521/gym-platform/issues/543)                                  |
| `admin.billing.approval.resolved`             | Billing                                                               | Proposal owner, subject to current access                    | ADMIN / ADMIN    | I via #543                                                                                           |
| Marketing/news                                | Future campaign module                                                | Only explicit, revocable marketing opt-in                    | MARKETING / USER | **Deferred; no producer now**                                                                        |

These are logical types. E11 [#342](https://github.com/sauron9521/gym-platform/issues/342) owns Mobile local scheduling; [#343](https://github.com/sauron9521/gym-platform/issues/343) owns Expo delivery implementation and device token lifecycle. Some future notification types may not require an Inbox row (e.g. purely local repeated reminders); this must be explicit in the event registry to avoid Inbox spam.

## Scope, actor and recipient rules

- `actorUserId` is for audit/correlation, **not** the trusted recipient. The resolver uses persisted aggregate relationships and current capabilities. Never trust a client-provided `recipientId`, `scope` or arbitrary deep link.
- Resolve whether the account is active and eligible. Admin notifications additionally need current role, verified granular permission/superadmin conditions and scope on **every read**; revocation hides details immediately, even for previously delivered notifications.
- In dual-capability accounts (ATHLETE+TRAINER), avoid sending the same event twice merely because two products can render it. One logical user record may be read in multiple authorized clients.
- Derive `resourceType` / `resourceId` and semantic navigation target on the API; client must still call protected resource GET. No plain, user-controlled external URLs or embedded HTML.
- Template keys and localized labels (uk/en) are separate from event routing data. Rendering must escape text and avoid leaking protected content through a stale push preview.
- Timestamp comparisons use UTC instants; locale + existing Profile IANA timezone affect **presentation and future scheduling**, not event ID or order.

## Replay, conflicts and ordering

- Atomic producer event insertion uses unique `eventKey`; consumer creates one logical `Notification` per (`eventId`, `recipientId`, `scope`) even after restart/replay.
- Order for Inbox pagination is (`createdAt` DESC, `id` DESC); clients must not assume network delivery order reflects domain event order.
- A later cancel/terminate/revoke transition invalidates a previously planned **external** action or link. Revalidate at dispatch and on target GET rather than sending a stale private body.
- Permanent provider failure does not trigger a new source-domain mutation. Missing optional email/push does not roll back program/approval records.
- Retain an opaque event ID/correlation ID for audit, safe traces and debug; event payload data must be bounded/versioned and not usable for privilege escalation.

## Producer-specific tests / handoff

| Owning issue                                                  | Required checks                                                                                                                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#570](https://github.com/sauron9521/gym-platform/issues/570) | invite by either party, duplicate request, accept/decline, relationship revoked while outbox pending, rollback, denied foreign recipient            |
| [#571](https://github.com/sauron9521/gym-platform/issues/571) | assignment committed/rejected, duplicate idempotency, cancellation, wrong athlete, revoked trainer, no full workout leak                            |
| [#572](https://github.com/sauron9521/gym-platform/issues/572) | verify existing auth mail not duplicated, correct account owner, moderator eligibility and role revocation, missing permission denial               |
| [#543](https://github.com/sauron9521/gym-platform/issues/543) | submitted proposal/revision only, privileged recipients, proposer outcome, revoked role and provider mismatch, approval never implied by read/click |

The first implementation PR must decide exact Zod discriminated-union schema and stable IDs; **this ADR does not add code or make the events available**.
