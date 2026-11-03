export const PERMISSIONS = [
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
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'post.create': 'Create and edit own drafts and posts',
  'post.approve': 'Approve or request changes on pending posts',
  'post.publish': 'Publish posts directly without approval',
  'post.reschedule': 'Change post publication time on calendar',
  'post.delete': 'Delete posts created by any team member',
  'inbox.reply': 'Send replies to conversations in inbox',
  'inbox.assign': 'Assign inbox conversations to team members',
  'analytics.view': 'View analytics reports and performance metrics',
  'report.export': 'Export data and analytics to CSV or scheduled reports',
  'listening.manage': 'Manage monitored keywords and sentiment tracking',
  'library.manage': 'Manage brand media assets, templates and hashtag sets',
  'channels.manage': 'Connect, reconnect, disconnect and configure social channels',
  'team.manage': 'Invite, modify and remove workspace team members',
  'workspace.manage': 'Update workspace settings and approval rules',
  'billing.manage': 'Manage subscription plans and billing details',
};
