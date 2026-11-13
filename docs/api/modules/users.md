# Users module

**Source:** [`apps/api/src/modules/users/`](../../../apps/api/src/modules/users/)

The current-user profile endpoints are authenticated. Public avatar serving is intentionally separate from authenticated profile mutations.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/users/me` | Read own profile |
| PATCH | `/users/me` | Update own profile |
| POST | `/users/me/avatar` | Upload/replace avatar |
| DELETE | `/users/me/avatar` | Remove avatar |
| GET | `/avatars/:key` | Public avatar retrieval |

Check the controller, validation schema and OpenAPI for the current profile field set, upload limits and response types. Do not document profile fields by copying a Prisma model: public responses must not expose credential secrets. Avatar writes have additional throttling.

**Tests:** `src/modules/users/**/test/`, `test/users.e2e-spec.ts`, `test/integration/users.repository.integration.e2e-spec.ts`. Profile/avatar API changes should update the OpenAPI-generated client and include own-user/cross-user access tests.

See [testing guide](../testing.md).
