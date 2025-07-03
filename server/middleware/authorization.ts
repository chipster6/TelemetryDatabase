import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';

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
    console.warn(`Unauthorized access attempt to ${req.method} ${req.path} from ${req.ip}`);
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
      console.warn(`Unauthorized data access attempt: User ${sessionUserId} tried to access user ${targetUserId} data from ${req.ip}`);
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
        console.warn(`Biometric data spoofing attempt: User ${sessionUserId} tried to store data for user ${req.body.userId} from ${req.ip}`);
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
          console.warn(`Unauthorized session access: User ${sessionUserId} tried to access session ${sessionId} owned by user ${session.userId} from ${req.ip}`);
          return res.status(403).json({ error: "Cannot access other users' session data" });
        }
      }
    }
    
    // Log biometric data access for audit trail (GDPR requirement)
    console.log(`Biometric data access: User ${sessionUserId} ${req.method} ${req.path} from ${req.ip} at ${new Date().toISOString()}`);
    
    next();
  } catch (error) {
    console.error('Biometric authorization error:', error);
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
        console.warn(`Unauthorized template access: User ${sessionUserId} tried to access template ${templateId} owned by user ${template.userId} from ${req.ip}`);
        return res.status(403).json({ error: "Cannot access other users' templates" });
      }
    }
    
    // For POST requests, set the userId to session user
    if (req.method === 'POST') {
      req.body.userId = sessionUserId;
    }
    
    next();
  } catch (error) {
    console.error('Template authorization error:', error);
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
        console.warn(`Unauthorized device access: User ${sessionUserId} tried to access device ${deviceId} from ${req.ip}`);
        return res.status(403).json({ error: "Device not found or access denied" });
      }
    }
    
    // For POST requests, set the userId to session user
    if (req.method === 'POST') {
      req.body.userId = sessionUserId;
    }
    
    next();
  } catch (error) {
    console.error('Device authorization error:', error);
    res.status(500).json({ error: "Authorization check failed" });
  }
}

// Admin-only access (for future admin features)
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = req.session?.userId;
  const username = req.session?.username;
  
  // For now, treat the first user as admin (this should be replaced with proper role system)
  if (!sessionUserId || sessionUserId !== 1) {
    console.warn(`Admin access denied for user ${sessionUserId} (${username}) to ${req.method} ${req.path} from ${req.ip}`);
    return res.status(403).json({ error: "Admin access required" });
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
    
    console.log(`AUDIT: ${operation} - User ${userId} (${username}) from ${ip} at ${timestamp}`);
    
    // In production, this would go to a secure audit log system
    // Required for GDPR Article 30 (Records of processing activities)
    
    next();
  };
}