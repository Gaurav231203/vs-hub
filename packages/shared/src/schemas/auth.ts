import { z } from 'zod';
import { ROLES } from '../roles.js';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const verify2faSchema = z.object({
  challengeId: z.string().min(1, 'Challenge ID is required'),
  code: z.string().min(6, 'Verification code or recovery code is required').max(32),
});

export type Verify2faInput = z.infer<typeof verify2faSchema>;

export const acceptInviteSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(ROLES),
  brandIds: z.array(z.string()).default([]),
  message: z.string().max(500).optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
