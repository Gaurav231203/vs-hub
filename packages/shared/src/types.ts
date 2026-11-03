import { Role } from './roles.js';
import { Permission } from './permissions.js';
import { Network } from './networkLimits.js';

export type PostStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CHANGES'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED';

export type TargetStatus = 'QUEUED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'SKIPPED';

export type ReviewDecision = 'SUBMITTED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'WITHDRAWN';

export type ChannelStatus = 'CONNECTED' | 'EXPIRING' | 'DISCONNECTED' | 'PAUSED';

export type MemberStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

export type ConvoType = 'COMMENT' | 'DM' | 'MENTION';
export type ConvoStatus = 'OPEN' | 'CLOSED';
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export type SseEventType =
  | 'post.updated'
  | 'inbox.message'
  | 'channel.status'
  | 'notification'
  | 'heartbeat';

export interface SseEvent<T = any> {
  type: SseEventType;
  data: T;
  timestamp: string;
}
