import { UserContext } from '@postdesk/shared';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      workspaceId?: string;
      ctx?: UserContext;
    }
  }
}
