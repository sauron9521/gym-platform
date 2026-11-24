# Authentication production security gates

Before connecting production traffic, verify the Zod environment contract and the isolated authentication regression suite:

```sh
pnpm --filter @gym/api test
pnpm --filter @gym/api test:e2e
```

The tests assert HTTPS-only application, JWT issuer and CORS origins, encrypted SMTP, strong JWT keys, restricted scrape-token configuration and explicit trusted proxies. These are **unit contracts**, not evidence of deployed TLS, real proxy behavior, email deliverability or a third-party penetration test. Real staging auth and refresh-token rotation require device/browser smoke tests.

The environment schema validates lengths, character diversity and encoding, but **cannot prove secret entropy**. Generate JWT secrets and metrics tokens with a cryptographically secure random generator; never use repetitive example strings or commit credentials. The metrics contract deliberately accepts a 43-character placeholder in unit tests to verify shape only.

## Existing password hashes before a production import

The credential service uses NestJS `PasswordHasher` for registration and sign-in,
including rehashing after successful verification. The frozen legacy API source
(`79e53bc1b7a78bb3856ff2aeab2529559240521e`) uses the same abstraction.
The unused direct bcrypt dependencies are not a legacy-hash compatibility layer.
Before importing existing accounts, verify supported hash formats in the target
release using a read-only aggregate inventory and disposable test accounts. Do not
log password hashes or credentials. If an unsupported legacy format exists,
require a separately reviewed migration or password-recovery plan before cutover.
