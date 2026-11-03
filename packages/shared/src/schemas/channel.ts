import { z } from 'zod';
import { NETWORKS } from '../networkLimits.js';

export const connectChannelSchema = z.object({
  brandId: z.string().min(1),
  network: z.enum(NETWORKS),
  handle: z.string().min(1),
  externalId: z.string().min(1),
  avatarUrl: z.string().url().optional(),
});

export type ConnectChannelInput = z.infer<typeof connectChannelSchema>;

export const togglePostingSchema = z.object({
  postingEnabled: z.boolean(),
});

export type TogglePostingInput = z.infer<typeof togglePostingSchema>;
