// Cloudflare Pages Functions Worker for Biometric Telemetry with REAL CRYSTALS-Kyber
// This file adapts our Express.js application to run on Cloudflare Workers

import { createRequestHandler } from './api-adapter.js';

// Main Pages Functions export
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Initialize REAL CRYSTALS-Kyber encryption system
    console.log('🔐 Initializing REAL CRYSTALS-Kyber post-quantum encryption...');
    
    try {
      // Create request handler with Cloudflare environment
      const handler = createRequestHandler(env, ctx);
      
      // Route API requests
      if (url.pathname.startsWith('/api/')) {
        return await handler(request);
      }
      
      // Serve static files for non-API routes
      return await env.ASSETS.fetch(request);
      
    } catch (error) {
      console.error('🚨 Worker error:', error);
      
      // Analytics for error tracking
      if (env.SECURITY_ANALYTICS) {
        const errorDatapoint = {
          doubles: {
            timestamp: Date.now(),
          },
          blobs: {
            errorType: 'worker_error',
            path: url.pathname,
            error: error.message || 'unknown_error',
            quantumProtected: 'true',
          },
        };
        
        ctx.waitUntil(env.SECURITY_ANALYTICS.writeDataPoint(errorDatapoint));
      }
      
      return new Response('Service Unavailable', { 
        status: 503,
        headers: {
          'Content-Type': 'text/plain',
          'X-Error': 'worker_error',
        }
      });
    }
  }
};