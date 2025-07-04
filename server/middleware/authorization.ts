import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';
import { AuthLogger } from '../utils/Logger.js';

// Enhanced authorization middleware for biometric data
export class AuthorizationError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// Require authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    AuthLogger.security('Unauthorized access attempt', 'medium', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Require specific user ID match (for accessing user-specific data)
export function requireUserMatch(userIdParam: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const sessionUserId = req.session?.userId;
    const targetUserId = parseInt(req.params[userIdParam] as string) || parseInt(req.body[userIdParam]) || parseInt(req.query[userIdParam] as string);
    
    if (!sessionUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (sessionUserId !== targetUserId) {
      AuthLogger.security('Unauthorized data access attempt', 'high', {
        sessionUserId,
        targetUserId,
        ip: req.ip,
        method: req.method,
        path: req.path
      });
      return res.status(403).json({ error: "Access forbidden: Cannot access other users' data" });
    }
    
    next();
  };
}

// Biometric data authorization - ensures users can only access their own biometric data
export async function authorizeBiometricAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // For POST requests, ensure the biometric data is being stored for the authenticated user
    if (req.method === 'POST') {
      // If userId is specified in body, it must match session user
      if (req.body.userId && req.body.userId !== sessionUserId) {
        AuthLogger.security('Biometric data spoofing attempt', 'critical', {
          sessionUserId,
          attemptedUserId: req.body.userId,
          ip: req.ip,
          method: req.method,
          path: req.path
        });
        return res.status(403).json({ error: "Cannot store biometric data for other users" });
      }
      
      // Set the userId to session user to prevent spoofing
      req.body.userId = sessionUserId;
    }
    
    // For GET requests with sessionId parameter, verify session ownership
    if (req.method === 'GET' && req.query.sessionId) {
      const sessionId = parseInt(req.query.sessionId as string);
      if (sessionId) {
        const session = await storage.getPromptSession(sessionId);
        if (session && session.userId !== sessionUserId) {
          AuthLogger.security('Unauthorized session access', 'high', {
            sessionUserId,
            sessionId,
            sessionOwner: session.userId,
            ip: req.ip,
            method: req.method,
            path: req.path
          });
          return res.status(403).json({ error: "Cannot access other users' session data" });
        }
      }
    }
    
    // Log biometric data access for audit trail (GDPR requirement)
    AuthLogger.audit('Biometric data access', sessionUserId, 'biometric_data', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    next();
  } catch (error) {
    AuthLogger.error('Biometric authorization error', error as Error);
    res.status(500).json({ error: "Authorization check failed" });
  }
}

// Template authorization - ensures users can only modify their own templates
export async function authorizeTemplateAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // For operations on specific templates, check ownership
    if (req.params.id) {
      const templateId = parseInt(req.params.id);
      const template = await storage.getPromptTemplate(templateId);
      
      if (template && template.userId !== sessionUserId) {
        AuthLogger.security('Unauthorized template access', 'medium', {
          sessionUserId,
          templateId,
          templateOwner: template.userId,
          ip: req.ip,
          method: req.method,
          path: req.path
        });
        return res.status(403).json({ error: "Cannot access other users' templates" });
      }
    }
    
    // For POST requests, set the userId to session user
    if (req.method === 'POST') {
      req.body.userId = sessionUserId;
    }
    
    next();
  } catch (error) {
    AuthLogger.error('Template authorization error', error as Error);
    res.status(500).json({ error: "Authorization check failed" });
  }
}

// Device connection authorization
export async function authorizeDeviceAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // For operations on specific devices, check ownership
    if (req.params.id) {
      const deviceId = parseInt(req.params.id);
      const devices = await storage.getDeviceConnections(sessionUserId);
      const device = devices.find(d => d.id === deviceId);
      
      if (!device) {
        AuthLogger.security('Unauthorized device access', 'medium', {
          sessionUserId,
          deviceId,
          ip: req.ip,
          method: req.method,
          path: req.path
        });
        return res.status(403).json({ error: "Device not found or access denied" });
      }
    }
    
    // For POST requests, set the userId to session user
    if (req.method === 'POST') {
      req.body.userId = sessionUserId;
    }
    
    next();
  } catch (error) {
    AuthLogger.error('Device authorization error', error as Error);
    res.status(500).json({ error: "Authorization check failed" });
  }
}

// Admin-only access with secure role-based authorization
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = req.session?.userId;
  const username = req.session?.username;
  const userRole = req.session?.role;
  
  // SECURITY FIX: Use role-based access control instead of hardcoded user ID
  if (!sessionUserId || !userRole || userRole !== 'admin') {
    AuthLogger.security('Admin access denied', 'high', {
      sessionUserId,
      username,
      userRole,
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    return res.status(403).json({ 
      error: "Admin access required",
      message: "This operation requires administrator privileges"
    });
  }
  
  // Additional security: Verify session is still valid and user still has admin role
  if (!req.session.userId || !req.session.role) {
    AuthLogger.security('Invalid session for admin access', 'high', {
      ip: req.ip,
      method: req.method,
      path: req.path
    });
    return res.status(401).json({ 
      error: "Session invalid",
      message: "Please log in again"
    });
  }
  
  next();
}

// Audit logging middleware for sensitive operations
export function auditLog(operation: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session?.userId;
    const username = req.session?.username;
    const ip = req.ip;
    const timestamp = new Date().toISOString();
    
    AuthLogger.audit(operation, userId || 0, 'audit_trail', {
      username,
      ip,
      method: req.method,
      path: req.path
    });
    
    // In production, this would go to a secure audit log system
    // Required for GDPR Article 30 (Records of processing activities)
    
    next();
  };
}