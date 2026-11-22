import { AuthenticationProvider, type SessionRecord } from '@nestjs/authentication';

/**
 * Shared provider type for @Authenticate route selection. Only the concrete
 * auth feature implementation is registered in AuthenticationRegistry.
 * The abstract marker avoids users/trainer-onboarding depending on auth.
 */
export abstract class AdminSessionCookieProvider extends AuthenticationProvider<
  { id: string },
  SessionRecord
> {}
