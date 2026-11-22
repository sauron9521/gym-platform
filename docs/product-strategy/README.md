# OVRANTO — Product Strategy / Strategic Decisions

This directory is the **canonical home for owner-approved product strategy decisions**. The active discussion/order stays in [Strategic Roadmap #588](https://github.com/sauron9521/gym-platform/issues/588); implementation scheduling stays in [Master Roadmap #353](https://github.com/sauron9521/gym-platform/issues/353).

## Approved strategic decisions

| Topic                                     | Decision     | Version  | Owner decision | Document                                                             |
| ----------------------------------------- | ------------ | -------- | -------------- | -------------------------------------------------------------------- |
| **S01 — Product Strategy & Positioning**  | **APPROVED** | **v1.0** | 2026-11-22     | [S01 Trainer-first Product Strategy](s01-product-strategy-v1.md)     |
| **S02 — Customer Experience & Retention** | **APPROVED** | **v1.0** | 2026-11-22     | [S02 Customer Experience & Retention](s02-customer-experience-v1.md) |

**S01 and S02 are owner-approved strategic decisions. S03–S12 are NOT_STARTED / NOT APPROVED.** Publishing this document is not an implementation or Beta acceptance claim.

## Decision vs implementation

Owner approval means the strategy is the authoritative basis for **future** product/billing/UX/analytics decisions. It is not evidence that features have shipped, Beta is safe, payment processing is authorized or a release has passed external go-live gates.

Change procedure: discuss revised scope, document impact on existing Epics/Issues, obtain explicit owner confirmation, version the strategy and propose changes through **one small PR**, validated by CI and merged by the owner. Do not create competing product epics or override the canonical E1–E22 technical backlog.

For S02, current implementation owners are [UX #382](https://github.com/sauron9521/gym-platform/issues/382), [Trainer Web UX #386](https://github.com/sauron9521/gym-platform/issues/386), [Athlete Mobile UX #385](https://github.com/sauron9521/gym-platform/issues/385), [Feedback #339](https://github.com/sauron9521/gym-platform/issues/339), [Offline #322](https://github.com/sauron9521/gym-platform/issues/322), [Notifications #563](https://github.com/sauron9521/gym-platform/issues/563) and [Beta gate #352](https://github.com/sauron9521/gym-platform/issues/352). **Reminder and weekly-summary UI are post-MVP**; the approved Notification architecture remains intact. No new duplicate technical epics.

For S01, key implementation owners are [Trainer Web #355](https://github.com/sauron9521/gym-platform/issues/355), [Billing #497](https://github.com/sauron9521/gym-platform/issues/497), [Offline #322](https://github.com/sauron9521/gym-platform/issues/322), [Mobile reliability #324](https://github.com/sauron9521/gym-platform/issues/324) and [Beta readiness #352](https://github.com/sauron9521/gym-platform/issues/352). Separate Beta's zero-payment gate from real billing launch in [#512](https://github.com/sauron9521/gym-platform/issues/512).
