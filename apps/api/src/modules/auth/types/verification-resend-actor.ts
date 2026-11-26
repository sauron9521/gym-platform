/** Minimal authenticated identity required by verification resend. */
export type VerificationResendActor = {
  id: string;
  email: string;
  emailVerified: boolean;
};
