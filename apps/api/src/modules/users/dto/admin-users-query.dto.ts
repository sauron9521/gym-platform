import { z } from 'zod';

/** Bounded, strict filters for privileged account searches; no arbitrary Prisma clauses. */
export const adminUsersQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    search: z.string().trim().min(2).max(100).optional(),
    role: z.enum(['ATHLETE', 'TRAINER', 'ADMIN']).optional(),
    status: z.literal('ACTIVE').optional(),
    createdFrom: z.iso.datetime({ offset: true }).optional(),
    createdTo: z.iso.datetime({ offset: true }).optional(),
  })
  .refine(
    (query) =>
      !query.createdFrom ||
      !query.createdTo ||
      Date.parse(query.createdFrom) <= Date.parse(query.createdTo),
    { message: 'createdFrom must not exceed createdTo', path: ['createdTo'] },
  );

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
