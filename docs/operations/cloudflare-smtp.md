# OVRANTO transactional SMTP

The existing NestJS SMTP transport supports Cloudflare Email Sending; no
provider SDK or separate adapter is required. This runbook is for operator
configuration and isolated live staging, not deployment approval.

## Environment boundaries

| Environment                       | Transport                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Local                             | Mailpit at `smtp://localhost:1025` or log transport                            |
| CI and disposable GHCR rehearsals | Existing synthetic SMTP; no real email or credentials                          |
| Isolated live staging             | Cloudflare Email Sending Free, verified test recipients only                   |
| Production                        | Approved provider and unrestricted recipient capability; separate rollout gate |

The operator confirmed delivery from `noreply@notify.ovranto.com` using
SMTP on port 465. That external smoke does not establish NestJS delivery,
live staging readiness, or production readiness.

## Live staging configuration

Set the following only in the private runtime environment, never in
browser variables, committed files, CI artifacts or shared logs:

```dotenv
SMTP_URL=smtps://api_token:REPLACE_WITH_URL_ENCODED_TOKEN@smtp.mx.cloudflare.net:465
MAIL_FROM="OVRANTO <noreply@notify.ovranto.com>"
SMTP_RECIPIENT_ALLOWLIST=tester@example.test,other@example.test
NOTIFICATION_EMAIL_ENABLED=false
```

Replace the illustrative recipients with exact verified test addresses.
Percent-encode the token as a URL password component. Use a scoped sending
credential, store the whole SMTP URL as a secret, and rotate on exposure.
Do not paste credentials in support requests or use unredacted Compose
configuration output. Keep TLS certificate verification enabled.

The optional SMTP recipient allowlist checks the complete envelope (To,
Cc and Bcc) before SMTP, rejects the entire message permanently if any
recipient is outside the list, and never redirects account recovery links.
Matching is exact; use the same spelling as the test account. Set a nonempty
allowlist for live staging even after a provider upgrade. An unset or empty
value disables the application restriction for backward compatibility.
Cloudflare Free independently restricts delivery to verified destinations.

## Acceptance and rollback

1. Confirm the sending domain and verified recipients in Cloudflare.
2. Start the isolated staging API with HTTPS URLs and synthetic accounts.
3. Exercise registration, verification and password reset for an allowed
   test account; confirm delivery and staging-only links.
4. Verify a non-allowlisted recipient is blocked before SMTP and no message
   is delivered. Do not use real user data in the test.
5. Inspect sanitized delivery status and SPF, DKIM and DMARC in the test
   mailbox. Keep optional notification email disabled until its own gate.
6. Revoke or rotate the staging token if needed. Roll back by restoring the
   previous approved runtime configuration; never bypass TLS or move
   production users to the test provider.

Production remains NO-GO until normal release gates, delivery validation,
provider limits and domain authentication are reviewed. Corporate mailbox
replies are separate from this transactional sending configuration.
