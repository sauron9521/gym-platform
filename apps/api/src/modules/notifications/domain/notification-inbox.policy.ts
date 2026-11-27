import { z } from 'zod';

export const notificationInboxCategories = ['TRAINER', 'PROGRAM', 'WORKOUT', 'ACCOUNT'] as const;

const cursorSchema = z
  .string()
  .max(100)
  .refine((value) => {
    const [timestamp, id, extra] = value.split('|');
    return (
      extra === undefined &&
      !!timestamp &&
      z.iso.datetime({ precision: 3 }).safeParse(timestamp).success &&
      z.uuid().safeParse(id).success &&
      Number.isFinite(Date.parse(timestamp))
    );
  }, 'Invalid notification cursor');

export const notificationInboxQuerySchema = z.strictObject({
  limit: z
    .string()
    .regex(/^(?:[1-9]|[1-4][0-9]|50)$/)
    .optional(),
  cursor: cursorSchema.optional(),
  category: z.enum(notificationInboxCategories).optional(),
  unread: z.enum(['true', 'false']).optional(),
});
export type NotificationInboxQuery = z.infer<typeof notificationInboxQuerySchema>;

export function decodeInboxCursor(cursor: string) {
  const [timestamp, id] = cursorSchema.parse(cursor).split('|');
  return { createdAt: new Date(timestamp!), id: id! };
}

export function encodeInboxCursor(row: { createdAt: Date; id: string }) {
  return row.createdAt.toISOString() + '|' + row.id;
}
