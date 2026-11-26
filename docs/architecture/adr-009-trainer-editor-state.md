# ADR-009 SM08: Trainer Program Builder state boundaries

- Review baseline: main `7e5b6e9`, 2026-11-26.
- Recommendation: defer a Trainer Zustand dependency until the actual multi-pane editor has a demonstrated shared interaction requirement.
- Status: proposed for owner review; no authoring, dependency or release approval.

## Verified current ownership

| Surface                  | Current implementation                                                                                           | State owner                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Trainer program choice   | `apps/trainer/src/app/workspace/clients/[relationId]/select-program/page.tsx`                                    | Server reads and URL search parameters (page, programId, versionId, beforeVersion) |
| Trainer assignment       | `trainer-assign-version-button.tsx`                                                                              | Local synchronous attempt guard, pending/outcome state; no blind resend            |
| Legacy program details   | `apps/web/src/features/training-programs/ui/trainer-program-details.tsx`                                         | TanStack Query, version-keyed child instances                                      |
| Legacy workout hierarchy | `training-program-workouts.tsx`, `program-workout-item.tsx`, `program-exercise-item.tsx`, `program-set-item.tsx` | Query cache, local editing/confirmation state, server mutation responses           |
| Legacy editor forms      | `add-program-exercise-form.tsx`, `edit-training-program-draft-form.tsx` and related forms                        | React Hook Form, local validation/search state and existing queries                |

The dedicated Trainer app has protected dashboard, client progress and published-program assignment routes, but no authoring route or multi-pane editor. The legacy editor is still operational and must not gain a second state architecture solely for its later migration. Neither web workspace declares Zustand at this baseline; mobile has the existing dependency and two scoped stores.

The approved product owner is Trainer Web, as described in [ADR-005](adr-005-product-ownership-trainer-migration.md). [#365](https://github.com/sauron9521/gym-platform/issues/365) and builder epic [#320](https://github.com/sauron9521/gym-platform/issues/320) are open. Duplicate week/day [#336](https://github.com/sauron9521/gym-platform/issues/336), accessible reorder [#337](https://github.com/sauron9521/gym-platform/issues/337) and publish review [#338](https://github.com/sauron9521/gym-platform/issues/338) already have canonical owners. No new issue or duplicate implementation is needed.

## Future editor ownership contract

| State                                                             | Owner / rule                                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Program ID, version ID, navigable week/filter                     | Route or URL when deep linking and browser history are required; parse/validate server inputs                  |
| Program records, draft version, workouts/exercises/sets, ordering | Server-authoritative read/cache; mutation acknowledgement and reconciliation; no copy in client store          |
| Unsaved editable field values, dirty state, errors                | React Hook Form and domain/Zod validation in the owning form                                                   |
| Shared transient selection and inspector mode                     | First try lifted state or scoped reducer; Zustand only if independent panels need shared actions/subscriptions |
| Drag gesture and hover/keyboard interaction                       | Local DnD interaction state; commit through authorized mutation, not a persisted reordered copy                |
| Publish/assign intent, pending requests, uncertain result         | Explicit action and local mutation/confirmation boundary; no automatic replay or optimistic publication        |
| Credentials, capabilities, authorization                          | Server and existing auth boundary; never client editor state                                                   |

A possible first store, if justified by the implemented editor, holds only ephemeral selection IDs (selected day/exercise/set), inspector mode and shared view preferences. Validate selection against the current canonical version and clear invalid descendants after deletion, revision or version change. Do not create a speculative store or introduce a dependency in this review.

## Adoption gates for #365

1. Implement the authorized Trainer editor route and three-panel layout using existing UI, form and query mechanisms; preserve legacy routes until parity.
2. Identify actual consumers and show a shared interaction (e.g. selecting a day in the outline updates the canvas and inspector). Compare lifted state/context reducer with selector subscriptions; document why the smaller solution is insufficient.
3. If justified, add a minimal Trainer-only scoped store in a separate PR. Create it within the client editor boundary keyed by verified account/session scope, program ID and version ID. No module-level singleton, no server-request shared state, no persisted editor records, no client-only permission decisions. Initial state must be deterministic across server rendering and hydration.
4. Test independent editor instances, account/program/version switches, stale callbacks, deletion/selection reconciliation, keyboard and responsive navigation, hydration, dirty form preservation and server-denied requests. Keep server validation, draft-only writes, publish review and assignment semantics intact.
5. Require parity and security review before cutover under [#367](https://github.com/sauron9521/gym-platform/issues/367). This contract does not approve cutover.

## State-management series outcome

| Stage     | Evidence at baseline                                                            |
| --------- | ------------------------------------------------------------------------------- |
| SM01–SM02 | Baseline audit and ADR proposal #891 merged                                     |
| SM03–SM04 | Mobile timer store #892 and lifecycle hardening #893 merged                     |
| SM05      | Pilot evaluation #894 merged; limited recommendation, native acceptance pending |
| SM06      | Mobile app settings selectors #895 merged                                       |
| SM07      | Active workout shortcut #896 merged; reuses timer scope, no third store         |
| SM08      | Trainer review performed; implementation deferred until #365 gates              |

GitHub Actions CI and Web / Integration E2E for #896 are completed successfully. The mobile pilot still requires physical Android/iOS verification, and application-wide performance gains have not been measured. Issue #325 remains open with broader workout acceptance requirements. Review completion is not implementation completion or release authorization.

Recommendation: stop expanding global state infrastructure for its own sake. Continue product work under existing issues and re-evaluate the editor store when the real interaction boundary exists.
