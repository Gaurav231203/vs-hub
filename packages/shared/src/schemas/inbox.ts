import { z } from 'zod';

export const sendReplySchema = z.object({
  body: z.string().min(1, 'Message body cannot be empty').max(5000),
  isNote: z.boolean().default(false),
});

export type SendReplyInput = z.infer<typeof sendReplySchema>;

export const assignConversationSchema = z.object({
  assigneeId: z.string().nullable(),
});

export type AssignConversationInput = z.infer<typeof assignConversationSchema>;

export const updateConversationSchema = z.object({
  status: z.enum(['OPEN', 'CLOSED']).optional(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
  priority: z.boolean().optional(),
  flagged: z.boolean().optional(),
});

export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
