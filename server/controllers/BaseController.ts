import { IServiceContainer, ServiceToken } from '../di/ServiceContainer';
import { Request, Response, NextFunction } from 'express';
import { ConfigurationManager } from '../config/ConfigurationManager';

export abstract class BaseController {
  constructor(protected container: IServiceContainer) {}

  protected resolve<T>(token: ServiceToken<T>): T {
    return this.container.resolve(token);
  }

  protected handleError(error: any, res: Response): void {
    const config = ConfigurationManager.getInstance();
    const status = error.status || 500;
    const message = process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : error.message;

    console.error('Controller Error:', {
      status,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(status).json({
      error: message,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }

  protected validateRequest(req: Request, requiredFields: string[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const field of requiredFields) {
      if (!req.body[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  protected sendSuccess(res: Response, data: any, message?: string): void {
    res.json({
      success: true,
      data,
      message: message || 'Operation successful',
      timestamp: new Date().toISOString()
    });
  }

  protected sendError(res: Response, status: number, message: string, details?: any): void {
    res.status(status).json({
      success: false,
      error: message,
      details,
      timestamp: new Date().toISOString()
    });
  }
}