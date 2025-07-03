// Cloudflare Pages Functions Middleware
// Adapts our Express.js API to work with Cloudflare Pages Functions
import type { PagesFunction, EventContext } from '@cloudflare/workers-types';

// Environment interface for Cloudflare bindings
export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  SECURITY_ANALYTICS: AnalyticsEngineDataset;
  NODE_ENV: string;
  SESSION_SECRET: string;
  REAL_CRYSTALS_KYBER_ENABLED: string;
  QUANTUM_RESISTANT_ENCRYPTION: string;
}

// CORS headers for biometric security API
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://biometric-telemetry.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Real-IP, X-Forwarded-For',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

// Security headers for biometric data protection
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; media-src 'self'; frame-src 'none';",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Real-Quantum-Protection': 'CRYSTALS-Kyber-ML-KEM-768',
  'X-Biometric-Security': 'GDPR-Compliant-Post-Quantum',
};

// Global middleware for all Pages Functions
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Add timing for performance monitoring
  const startTime = Date.now();

  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          ...corsHeaders,
          ...securityHeaders,
        },
      });
    }

    // Security: Block requests without proper origin (except for API health checks)
    const origin = request.headers.get('Origin');
    const isHealthCheck = url.pathname === '/api/health';
    
    if (!isHealthCheck && origin && !origin.includes('pages.dev') && !origin.includes('localhost')) {
      console.warn(`🚫 Blocked request from unauthorized origin: ${origin}`);
      return new Response('Forbidden: Invalid origin', { 
        status: 403,
        headers: securityHeaders 
      });
    }

    // Add environment context for our API
    context.env = env;
    context.locals = {
      ...context.locals,
      db: env.DB,
      sessions: env.SESSIONS,
      analytics: env.SECURITY_ANALYTICS,
      startTime,
    };

    // Log CRYSTALS-Kyber status
    if (env.REAL_CRYSTALS_KYBER_ENABLED === 'true') {
      console.log('🔐 REAL CRYSTALS-Kyber post-quantum encryption: ENABLED');
    }

    // Process the request
    const response = await next();

    // Add security and CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.entries({ ...corsHeaders, ...securityHeaders }).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    // Add performance timing
    const processingTime = Date.now() - startTime;
    newHeaders.set('X-Response-Time', `${processingTime}ms`);

    // Log security analytics
    if (env.SECURITY_ANALYTICS) {
      const datapoint = {
        doubles: {
          responseTime: processingTime,
          timestamp: Date.now(),
        },
        blobs: {
          method: request.method,
          path: url.pathname,
          userAgent: request.headers.get('User-Agent') || 'unknown',
          origin: origin || 'direct',
          quantumProtected: env.REAL_CRYSTALS_KYBER_ENABLED === 'true' ? 'yes' : 'no',
        },
      };
      
      // Fire and forget analytics
      context.waitUntil(env.SECURITY_ANALYTICS.writeDataPoint(datapoint));
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });

  } catch (error) {
    console.error('🚨 Middleware error:', error);
    
    // Log security incident
    if (env.SECURITY_ANALYTICS) {
      const errorDatapoint = {
        doubles: {
          timestamp: Date.now(),
          responseTime: Date.now() - startTime,
        },
        blobs: {
          errorType: 'middleware_error',
          method: request.method,
          path: url.pathname,
          error: error instanceof Error ? error.message : 'unknown_error',
          quantumProtected: env.REAL_CRYSTALS_KYBER_ENABLED === 'true' ? 'yes' : 'no',
        },
      };
      
      context.waitUntil(env.SECURITY_ANALYTICS.writeDataPoint(errorDatapoint));
    }

    return new Response('Internal Server Error', {
      status: 500,
      headers: {
        ...corsHeaders,
        ...securityHeaders,
        'Content-Type': 'text/plain',
      },
    });
  }
};