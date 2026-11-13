import {
  emailSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verificationTokenSchema,
} from '../dto/auth.schemas.js';

describe('Auth Zod request schemas (pre-migration contract)', () => {
  const email = 'member@example.test';
  const strongPassword = 'StrongPassword123!';

  it('accepts existing credential requests without changing login email case', () => {
    expect(
      signInSchema.parse({ email: 'Member@Example.test', password: 'valid nonblank password' }),
    ).toEqual({ email: 'Member@Example.test', password: 'valid nonblank password' });

    expect(signUpSchema.parse({ email, password: strongPassword })).toEqual({
      email,
      password: strongPassword,
    });
  });

  it.each([
    [{ email: 'invalid', password: strongPassword }],
    [{ email, password: '' }],
    [{ email, password: '  \t  ' }],
    [{ email }],
    [{ email, password: strongPassword, role: 'ADMIN' }],
  ])('rejects malformed credential bodies: %j', (input) => {
    expect(signInSchema.safeParse(input).success).toBe(false);
  });

  const weakPasswords = [
    'shor1A!',
    'lowercase123!',
    'UPPERCASE123!',
    'NoNumbersHere!',
    'NoSymbols123',
  ];

  it.each(weakPasswords)('rejects weak registration and reset passwords: %s', (password) => {
    expect(signUpSchema.safeParse({ email, password }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: 'reset-token', password }).success).toBe(false);
  });

  it('normalizes ONLY password-recovery email, before validating it', () => {
    expect(emailSchema.parse({ email: '  Member@Example.TEST  ' })).toEqual({
      email: 'member@example.test',
    });
    expect(emailSchema.safeParse({ email: '  not-an-email  ' }).success).toBe(false);
    expect(emailSchema.safeParse({ email, unexpected: true }).success).toBe(false);
    expect(signInSchema.parse({ email: 'Member@Example.test', password: 'valid' }).email).toBe(
      'Member@Example.test',
    );
  });

  it('requires nonempty opaque tokens and disallows unexpected fields', () => {
    expect(verificationTokenSchema.parse({ token: 'opaque-token' })).toEqual({
      token: 'opaque-token',
    });
    expect(refreshTokenSchema.parse({ refreshToken: 'refresh-token' })).toEqual({
      refreshToken: 'refresh-token',
    });

    for (const schema of [verificationTokenSchema, refreshTokenSchema]) {
      expect(schema.safeParse({}).success).toBe(false);
    }
    expect(verificationTokenSchema.safeParse({ token: '' }).success).toBe(false);
    expect(refreshTokenSchema.safeParse({ refreshToken: '' }).success).toBe(false);
    expect(refreshTokenSchema.safeParse({ refreshToken: 'valid', role: 'ADMIN' }).success).toBe(
      false,
    );
  });

  it('requires both reset token and a strong password', () => {
    expect(resetPasswordSchema.parse({ token: 'token', password: strongPassword })).toEqual({
      token: 'token',
      password: strongPassword,
    });
    expect(resetPasswordSchema.safeParse({ password: strongPassword }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: 'token' }).success).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token: 'token', password: strongPassword, extra: 1 }).success,
    ).toBe(false);
  });
});
