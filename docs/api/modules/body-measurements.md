# Body measurements module

**Source:** [`apps/api/src/modules/body-measurements/`](../../../apps/api/src/modules/body-measurements/)

Authenticated tracking of body measurements and statistics. Use the Zod request schema / generated OpenAPI for field types, precision and date handling.

| Method | Path |
| --- | --- |
| POST | `/body-measurements` |
| GET | `/body-measurements` |
| GET | `/body-measurements/statistics` |
| GET | `/body-measurements/:id` |
| PATCH | `/body-measurements/:id` |
| DELETE | `/body-measurements/:id` |

Do not round fractional measurements in API validation or persistence unless the contract specifies it. Keep each athlete's measurements private.

**Tests:** `test/body-measurements.e2e-spec.ts` and co-located module unit tests. Cover invalid numeric input, boundaries, sorting and user isolation when changing this module.

See [testing guide](../testing.md).
