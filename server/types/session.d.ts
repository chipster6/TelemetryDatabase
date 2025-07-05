import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    role?: string;
    userRole?: string;
    lastActivity?: number;
    lastPath?: string;
    requestCount?: number;
    csrfToken?: string;
  }
}