// Rate Limiting Middleware for API Security
// Prevents DoS attacks and brute force attempts

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response } from 'express';

// Store for tracking login attempts by IP and username
const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockUntil?: number }>();
const usernameAttempts = new Map<string, { count: number; firstAttempt: number; lockUntil?: number }>();

// General API rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many login attempts from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Biometric data rate limiting (stricter due to sensitive nature)
export const biometricRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit each IP to 20 biometric data requests per 5 minutes
  message: {
    error: 'Too many biometric data requests, please slow down.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Progressive delay for repeated requests
export const progressiveDelay = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // Allow 2 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  skipSuccessfulRequests: true
});

// Account lockout mechanism for failed login attempts (prevents IP rotation bypass)
export const accountLockout = (req: Request, res: Response, next: Function) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const username = req.body?.username || 'unknown';
  const now = Date.now();
  const maxAttempts = 3;
  const lockoutDuration = 30 * 60 * 1000; // 30 minutes
  const attemptWindow = 15 * 60 * 1000; // 15 minutes

  const ipAttempts = loginAttempts.get(ip);
  const userAttempts = usernameAttempts.get(username);

  // Check if IP is currently locked
  if (ipAttempts?.lockUntil && now < ipAttempts.lockUntil) {
    const remainingTime = Math.ceil((ipAttempts.lockUntil - now) / 1000 / 60);
    return res.status(423).json({
      error: 'IP temporarily locked due to too many failed attempts',
      lockedUntil: new Date(ipAttempts.lockUntil).toISOString(),
      remainingMinutes: remainingTime
    });
  }

  // Check if username is currently locked (prevents IP rotation bypass)
  if (userAttempts?.lockUntil && now < userAttempts.lockUntil) {
    const remainingTime = Math.ceil((userAttempts.lockUntil - now) / 1000 / 60);
    return res.status(423).json({
      error: 'Account temporarily locked due to too many failed attempts',
      lockedUntil: new Date(userAttempts.lockUntil).toISOString(),
      remainingMinutes: remainingTime
    });
  }

  // Reset attempts if window has expired
  if (ipAttempts && (now - ipAttempts.firstAttempt) > attemptWindow) {
    loginAttempts.delete(ip);
  }
  if (userAttempts && (now - userAttempts.firstAttempt) > attemptWindow) {
    usernameAttempts.delete(username);
  }

  // Store request time for potential failed attempt tracking
  req.loginAttemptTime = now;
  req.userIP = ip;
  req.username = username;
  
  next();
};

// Track failed login attempts (both IP and username to prevent rotation bypass)
export const trackFailedLogin = (req: Request, res: Response, next: Function) => {
  const ip = req.userIP || req.ip || 'unknown';
  const username = req.username || req.body?.username || 'unknown';
  const now = req.loginAttemptTime || Date.now();
  const maxAttempts = 3;
  const lockoutDuration = 30 * 60 * 1000; // 30 minutes

  // Track IP attempts
  const ipAttempts = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
  ipAttempts.count += 1;
  ipAttempts.firstAttempt = ipAttempts.firstAttempt || now;

  // Track username attempts (prevents IP rotation bypass)
  const userAttempts = usernameAttempts.get(username) || { count: 0, firstAttempt: now };
  userAttempts.count += 1;
  userAttempts.firstAttempt = userAttempts.firstAttempt || now;

  // Lock IP if max attempts reached
  if (ipAttempts.count >= maxAttempts) {
    ipAttempts.lockUntil = now + lockoutDuration;
    console.warn(`IP locked for ${ip} due to ${ipAttempts.count} failed attempts`);
  }

  // Lock username if max attempts reached (prevents IP rotation bypass)
  if (userAttempts.count >= maxAttempts) {
    userAttempts.lockUntil = now + lockoutDuration;
    console.warn(`Account locked for username ${username} due to ${userAttempts.count} failed attempts`);
  }

  loginAttempts.set(ip, ipAttempts);
  usernameAttempts.set(username, userAttempts);
  next();
};

// Reset failed attempts on successful login
export const resetFailedAttempts = (req: Request, res: Response, next: Function) => {
  const ip = req.userIP || req.ip || 'unknown';
  const username = req.username || req.body?.username || 'unknown';
  loginAttempts.delete(ip);
  usernameAttempts.delete(username);
  next();
};

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  const cleanupTime = 60 * 60 * 1000; // 1 hour

  // Cleanup IP attempts
  for (const [ip, attempts] of loginAttempts.entries()) {
    if ((now - attempts.firstAttempt) > cleanupTime && (!attempts.lockUntil || now > attempts.lockUntil)) {
      loginAttempts.delete(ip);
    }
  }

  // Cleanup username attempts
  for (const [username, attempts] of usernameAttempts.entries()) {
    if ((now - attempts.firstAttempt) > cleanupTime && (!attempts.lockUntil || now > attempts.lockUntil)) {
      usernameAttempts.delete(username);
    }
  }
}, 60 * 60 * 1000); // Run cleanup every hour

// Extend Request interface for tracking
declare global {
  namespace Express {
    interface Request {
      loginAttemptTime?: number;
      userIP?: string;
      username?: string;
    }
  }
}