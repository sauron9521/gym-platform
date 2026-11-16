# Shared Next.js tooling

Web and Landing extend one TypeScript preset and re-export the same ESLint
flat config. Application-only `paths`, `include` and `exclude` stay local:
TypeScript resolves relative paths against the file defining them.

The shared ESLint preset is intentionally **not** consumed by NestJS (Oxlint)
or Expo (its own eslint-config-expo) to avoid incompatible rules.
