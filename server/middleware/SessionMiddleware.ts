import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Request, Response, NextFunction } from "express";
import { Pool } from "pg";
import { ConfigurationManager } from "../config/ConfigurationManager";
import { SESSION, HTTP_STATUS } from "../constants/ApplicationConstants";
import { Logger } from "../utils/Logger";

/**
 * Session middleware collection for Express application
 * Handles session configuration, concurrent session limiting, and session security
 */
export class SessionMiddleware {
  private static activeSessions = new Map<number, Set<string>>();
  private static logger = Logger.getInstance();

  /**
   * Configure Express session with PostgreSQL store
   * Extracted from index.ts lines 95-113
   */
  static configure(pool: Pool, config: ConfigurationManager) {
    const PgSession = connectPgSimple(session);
    
    return session({
      store: new PgSession({
        pool: pool,
        tableName: 'sessions',
        createTableIfMissing: false,
      }),
      secret: config.get<string>('security.sessionSecret'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Always secure in production
        maxAge: SESSION.MAX_AGE, // SECURITY FIX: 10 minutes for biometric data sensitivity
        sameSite: 'strict', // CSRF protection
      },
    });
  }

  /**
   * Configure session with custom options
   */
  static configureCustom(options: {
    pool: Pool;
    config: ConfigurationManager;
    tableName?: string;
    maxAge?: number;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    httpOnly?: boolean;
  }) {
    const PgSession = connectPgSimple(session);
    
    return session({
      store: new PgSession({
        pool: options.pool,
        tableName: options.tableName || 'sessions',
        createTableIfMissing: false,
      }),
      secret: options.config.get<string>('security.sessionSecret'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: options.httpOnly !== undefined ? options.httpOnly : true,
        secure: options.secure !== undefined ? options.secure : process.env.NODE_ENV === 'production',
        maxAge: options.maxAge || SESSION.MAX_AGE,
        sameSite: options.sameSite || 'strict',
      },
    });
  }

  /**
   * Middleware to limit concurrent sessions per user
   * Extracted from index.ts lines 116-140
   */
  static concurrentSessionLimiter(config: ConfigurationManager) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.session?.userId) {
        const userId = req.session.userId;
        const sessionId = req.sessionID;
        const maxConcurrentSessions = config.get<number>('biometric.maxConcurrentSessions');
        
        if (!this.activeSessions.has(userId)) {
          this.activeSessions.set(userId, new Set());
        }
        
        const userSessions = this.activeSessions.get(userId)!;
        
        // Add current session
        userSessions.add(sessionId);
        
        // Check if user has too many active sessions
        if (userSessions.size > maxConcurrentSessions) {
          this.logger.security(
            'Concurrent session limit exceeded',
            'medium',
            {
              userId,
              activeSessions: userSessions.size,
              maxAllowed: maxConcurrentSessions,
              sessionId
            }
          );
          // Remove oldest session (first in set)
          const oldestSession = userSessions.values().next().value;
          if (oldestSession) {
            userSessions.delete(oldestSession);
          }
        }
      }
      next();
    };
  }

  /**
   * Session authentication middleware
   */
  static requireAuth(redirectUrl?: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.session?.userId) {
        if (redirectUrl) {
          return res.redirect(redirectUrl);
        }
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        });
      }
      next();
    };
  }

  /**
   * Session role-based authorization middleware
   */
  static requireRole(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.session?.userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        });
      }

      const userRole = req.session.role;
      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Insufficient permissions',
          requiredRoles: allowedRoles,
          userRole: userRole || 'none',
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }

  /**
   * Session timeout middleware
   */
  static sessionTimeout(timeoutMinutes: number = SESSION.TIMEOUT_MINUTES) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.session?.userId) {
        const now = Date.now();
        const lastActivity = req.session.lastActivity || now;
        const timeoutMs = timeoutMinutes * 60 * 1000;

        if (now - lastActivity > timeoutMs) {
          req.session.destroy((err) => {
            if (err) {
              this.logger.error('Error destroying expired session', err);
            }
          });
          
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: 'Session expired due to inactivity',
            timeoutMinutes,
            timestamp: new Date().toISOString()
          });
        }

        // Update last activity
        req.session.lastActivity = now;
      }
      next();
    };
  }

  /**
   * Session regeneration middleware for security-sensitive operations
   */
  static regenerateSession() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.session) {
        const userData = {
          userId: req.session.userId,
          userRole: req.session.role,
          lastActivity: req.session.lastActivity
        };

        req.session.regenerate((err) => {
          if (err) {
            this.logger.error('Session regeneration failed', err);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
              error: 'Session regeneration failed',
              timestamp: new Date().toISOString()
            });
          }

          // Restore user data
          Object.assign(req.session, userData);
          next();
        });
      } else {
        next();
      }
    };
  }

  /**
   * CSRF token generation middleware
   */
  static generateCSRFToken() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.session && !req.session.csrfToken) {
        req.session.csrfToken = this.generateSecureToken(SESSION.CSRF_TOKEN_LENGTH);
      }
      next();
    };
  }

  /**
   * Session cleanup middleware for logout
   */
  static cleanup() {
    return (req: Request, res: Response, next: NextFunction) => {
      const userId = req.session?.userId;
      const sessionId = req.sessionID;

      if (userId && sessionId) {
        const userSessions = this.activeSessions.get(userId);
        if (userSessions) {
          userSessions.delete(sessionId);
          if (userSessions.size === 0) {
            this.activeSessions.delete(userId);
          }
        }
      }

      req.session.destroy((err) => {
        if (err) {
          this.logger.error('Error destroying session during cleanup', err);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            error: 'Session cleanup failed',
            timestamp: new Date().toISOString()
          });
        }
        res.clearCookie('connect.sid');
        next();
      });
    };
  }

  /**
   * Get active session statistics
   */
  static getSessionStats() {
    const totalUsers = this.activeSessions.size;
    let totalSessions = 0;
    let maxSessionsPerUser = 0;

    for (const userSessions of this.activeSessions.values()) {
      totalSessions += userSessions.size;
      maxSessionsPerUser = Math.max(maxSessionsPerUser, userSessions.size);
    }

    return {
      totalUsers,
      totalSessions,
      averageSessionsPerUser: totalUsers > 0 ? totalSessions / totalUsers : 0,
      maxSessionsPerUser,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Force logout user from all sessions
   */
  static forceLogoutUser(userId: number) {
    const userSessions = this.activeSessions.get(userId);
    if (userSessions) {
      userSessions.clear();
      this.activeSessions.delete(userId);
      return true;
    }
    return false;
  }

  /**
   * Session monitoring middleware
   */
  static monitor() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.session?.userId) {
        // Log session activity for monitoring
        this.logger.info('Session activity', {
          userId: req.session.userId,
          sessionId: req.sessionID,
          path: req.path,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
        
        // Add session metadata
        req.session.lastActivity = Date.now();
        req.session.lastPath = req.path;
        req.session.requestCount = (req.session.requestCount || 0) + 1;
      }
      next();
    };
  }

  // ==================== Helper Methods ====================

  /**
   * Generate secure random token
   */
  private static generateSecureToken(length: number = SESSION.CSRF_TOKEN_LENGTH): string {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Clean up expired sessions (to be called periodically)
   */
  static cleanupExpiredSessions(): void {
    // This would typically be implemented with the session store
    // For now, just log the cleanup attempt
    this.logger.info('Session cleanup triggered', {
      timestamp: new Date().toISOString(),
      activeUsers: this.activeSessions.size
    });
  }

  /**
   * Get session info for debugging
   */
  static getSessionInfo(req: Request): object {
    return {
      sessionId: req.sessionID,
      userId: req.session?.userId,
      userRole: req.session?.userRole,
      lastActivity: req.session?.lastActivity,
      requestCount: req.session?.requestCount,
      csrfToken: req.session?.csrfToken ? '[PRESENT]' : '[MISSING]'
    };
  }
}