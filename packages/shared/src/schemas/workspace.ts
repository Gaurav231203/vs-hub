import { z } from 'zod';

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  timezone: z.string().min(1).optional(),
  weekStart: z.union([z.literal(0), z.literal(1)]).optional(),
  shortenLinks: z.boolean().optional(),
  utmEnabled: z.boolean().optional(),
  utmSource: z.string().max(50).optional(),
  requireMfa: z.boolean().optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const updateApprovalModeSchema = z.object({
  approvalMode: z.enum(['BY_ROLE', 'EVERY_POST', 'OFF']),
});

export type UpdateApprovalModeInput = z.infer<typeof updateApprovalModeSchema>;
