import { Permission } from './permissions.js';

export const ROLES = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'EDITOR',
  'COMMUNITY',
  'ANALYST',
  'CLIENT',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_RANKS: Record<Role, number> = {
  OWNER: 100,
  ADMIN: 80,
  MANAGER: 60,
  EDITOR: 40,
  COMMUNITY: 40,
  ANALYST: 40,
  CLIENT: 40,
};

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: [
    'post.create',
    'post.approve',
    'post.publish',
    'post.reschedule',
    'post.delete',
    'inbox.reply',
    'inbox.assign',
    'analytics.view',
    'report.export',
    'listening.manage',
    'library.manage',
    'channels.manage',
    'team.manage',
    'workspace.manage',
    'billing.manage',
  ],
  ADMIN: [
    'post.create',
    'post.approve',
    'post.publish',
    'post.reschedule',
    'post.delete',
    'inbox.reply',
    'inbox.assign',
    'analytics.view',
    'report.export',
    'listening.manage',
    'library.manage',
    'channels.manage',
    'team.manage',
    'workspace.manage',
  ],
  MANAGER: [
    'post.create',
    'post.approve',
    'post.publish',
    'post.reschedule',
    'post.delete',
    'inbox.reply',
    'inbox.assign',
    'analytics.view',
    'report.export',
    'listening.manage',
    'library.manage',
  ],
  EDITOR: ['post.create', 'analytics.view'],
  COMMUNITY: ['inbox.reply', 'inbox.assign', 'listening.manage'],
  ANALYST: ['analytics.view', 'report.export'],
  CLIENT: ['post.approve', 'analytics.view'],
};

export type ApprovalMode = 'BY_ROLE' | 'EVERY_POST' | 'OFF';

export interface UserContext {
  userId: string;
  workspaceId: string;
  role: Role;
  perms: readonly Permission[];
  allBrands: boolean;
  brandIds: string[];
}

export function requiresApproval(ctx: { role: Role; perms: readonly Permission[] }, mode: ApprovalMode): boolean {
  if (mode === 'OFF') return false;
  if (mode === 'EVERY_POST') return !['OWNER', 'ADMIN'].includes(ctx.role);
  return !ctx.perms.includes('post.publish');
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return ROLE_RANKS[actorRole] > ROLE_RANKS[targetRole];
}
