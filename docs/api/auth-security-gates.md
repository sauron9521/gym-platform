# Authentication production security gates

Before connecting production traffic, verify the Zod environment contract and the isolated authentication regression suite:

```sh
pnpm --filter @gym/api test
pnpm --filter @gym/api test:e2e
```

The tests assert HTTPS-only application, JWT issuer and CORS origins, encrypted SMTP, strong JWT keys, restricted scrape-token configuration and explicit trusted proxies. These are **unit contracts**, not evidence of deployed TLS, real proxy behavior, email deliverability or a third-party penetration test. Real staging auth and refresh-token rotation require device/browser smoke tests.

The environment schema validates lengths, character diversity and encoding, but **cannot prove secret entropy**. Generate JWT secrets and metrics tokens with a cryptographically secure random generator; never use repetitive example strings or commit credentials. The metrics contract deliberately accepts a 43-character placeholder in unit tests to verify shape only.
