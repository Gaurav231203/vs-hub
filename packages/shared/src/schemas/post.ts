import { z } from 'zod';

export const postMediaSchema = z.object({
  assetId: z.string().min(1),
  position: z.number().int().min(0),
  altText: z.string().max(1000).optional().nullable(),
});

export const createPostSchema = z.object({
  brandId: z.string().min(1, 'Brand is required'),
  campaignId: z.string().optional().nullable(),
  caption: z.string().default(''),
  firstComment: z.string().optional().nullable(),
  channelIds: z.array(z.string()).min(1, 'At least one channel must be selected'),
  scheduledAt: z.string().datetime().optional().nullable(),
  publishMode: z.enum(['AUTOMATIC', 'MANUAL']).default('AUTOMATIC').optional(),
  media: z.array(postMediaSchema).default([]),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
  caption: z.string().optional(),
  firstComment: z.string().optional().nullable(),
  channelIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  publishMode: z.enum(['AUTOMATIC', 'MANUAL']).optional(),
  media: z.array(postMediaSchema).optional(),
  campaignId: z.string().optional().nullable(),
  version: z.number().int().min(1).optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const approvePostSchema = z.object({
  version: z.number().int().min(1, 'Post version is required for conflict prevention'),
});

export type ApprovePostInput = z.infer<typeof approvePostSchema>;

export const requestChangesSchema = z.object({
  note: z.string().min(1, 'A note explaining requested changes is required').max(1000),
  version: z.number().int().min(1).optional(),
});

export type RequestChangesInput = z.infer<typeof requestChangesSchema>;

export const bulkApproveSchema = z.object({
  postIds: z.array(z.string().min(1)).min(1, 'Select at least one post'),
});

export type BulkApproveInput = z.infer<typeof bulkApproveSchema>;

export const reschedulePostSchema = z.object({
  scheduledAt: z.string().datetime('A valid future ISO datetime is required'),
});

export type ReschedulePostInput = z.infer<typeof reschedulePostSchema>;

export const undoActionSchema = z.object({
  undoToken: z.string().min(1, 'Undo token is required'),
});

export type UndoActionInput = z.infer<typeof undoActionSchema>;

export const validatePostSchema = z.object({
  brandId: z.string().min(1),
  caption: z.string(),
  firstComment: z.string().optional().nullable(),
  channelIds: z.array(z.string()),
  mediaAssetIds: z.array(z.string()).default([]),
  mediaUrls: z.array(z.string()).default([]),
  scheduledAt: z.string().datetime().optional().nullable(),
});

export type ValidatePostInput = z.infer<typeof validatePostSchema>;
