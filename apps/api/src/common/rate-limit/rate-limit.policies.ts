import { Throttle } from '@nestjs/throttler';

// Shared one-minute defaults. Only the named endpoint overrides below change
// the budget; multiple global throttler definitions would stack all limits.
const MINUTE = 60_000;

export const RATE_LIMIT_POLICIES = {
  global: { limit: 10, ttl: MINUTE },
  read: { limit: 60, ttl: MINUTE },
  analytics: { limit: 20, ttl: MINUTE },
  auth: { limit: 3, ttl: MINUTE },
  avatar: { limit: 5, ttl: MINUTE },
  workoutSet: { limit: 120, ttl: MINUTE },
} as const;

export type RateLimitPreset = Exclude<keyof typeof RATE_LIMIT_POLICIES, 'global'>;

/** Choose an endpoint budget without duplicating Nest throttler metadata. */
export function RateLimit(preset: RateLimitPreset) {
  return Throttle({ default: RATE_LIMIT_POLICIES[preset] });
}
