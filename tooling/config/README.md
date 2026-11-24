# Shared Next.js tooling

Admin, Landing, Trainer and Web re-export the same ESLint flat config. The
root package owns `eslint` and `eslint-config-next`, plus TypeScript as the
preset's peer dependency. Each application retains its own ESLint CLI and
TypeScript compiler declarations for its local scripts. Update the shared
Next.js preset at the root; do not duplicate it in application manifests.

Application-only TypeScript `paths`, `include` and `exclude` stay local:
TypeScript resolves relative paths against the file defining them.

The shared ESLint preset is intentionally **not** consumed by NestJS (Oxlint)
nor Expo (its own eslint-config-expo) to avoid incompatible rules.
