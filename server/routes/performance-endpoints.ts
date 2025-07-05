import { Request, Response } from 'express';
import { performanceMonitoringService } from '../services/performance/PerformanceMonitoringService';
import { HTTP_STATUS } from '../constants/ApplicationConstants';

/**
 * Performance monitoring endpoints
 * Provides comprehensive performance metrics and monitoring data
 */
export class PerformanceEndpoints {

  /**
   * Get current performance metrics
   */
  static getCurrentMetrics = async (req: Request, res: Response) => {
    try {
      const metrics = performanceMonitoringService.getCurrentMetrics();
      
      if (!metrics) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'No performance metrics available yet',
          message: 'Metrics collection may still be initializing'
        });
      }

      res.json({
        timestamp: new Date().toISOString(),
        metrics,
        uptime: process.uptime()
      });
    } catch (error) {
      console.error('Failed to get current metrics:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve performance metrics',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Get performance summary for dashboards
   */
  static getPerformanceSummary = async (req: Request, res: Response) => {
    try {
      const summary = performanceMonitoringService.getPerformanceSummary();
      
      res.json({
        timestamp: new Date().toISOString(),
        summary,
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error('Failed to get performance summary:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve performance summary',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Get performance trends over time
   */
  static getPerformanceTrends = async (req: Request, res: Response) => {
    try {
      const timeWindow = parseInt(req.query.timeWindow as string) || 60; // Default 60 minutes
      
      if (timeWindow < 1 || timeWindow > 1440) { // Max 24 hours
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Time window must be between 1 and 1440 minutes'
        });
      }

      const trends = performanceMonitoringService.getPerformanceTrends(timeWindow);
      
      res.json({
        timestamp: new Date().toISOString(),
        timeWindow: `${timeWindow} minutes`,
        trends
      });
    } catch (error) {
      console.error('Failed to get performance trends:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve performance trends',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Get detailed system metrics for specific component
   */
  static getComponentMetrics = async (req: Request, res: Response) => {
    try {
      const { component } = req.params;
      const validComponents = ['requests', 'database', 'redis', 'weaviate', 'memory', 'cpu', 'security', 'application'];
      
      if (!validComponents.includes(component)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Invalid component',
          validComponents
        });
      }

      const metrics = performanceMonitoringService.getCurrentMetrics();
      if (!metrics) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'No metrics available'
        });
      }

      const componentMetrics = metrics[component as keyof typeof metrics];
      
      res.json({
        timestamp: new Date().toISOString(),
        component,
        metrics: componentMetrics
      });
    } catch (error) {
      console.error('Failed to get component metrics:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve component metrics',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Get performance alerts configuration
   */
  static getPerformanceAlerts = async (req: Request, res: Response) => {
    try {
      const alerts = performanceMonitoringService.getAlerts();
      
      res.json({
        timestamp: new Date().toISOString(),
        alerts,
        totalAlerts: alerts.length,
        enabledAlerts: alerts.filter(a => a.enabled).length
      });
    } catch (error) {
      console.error('Failed to get performance alerts:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve performance alerts',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Add or update performance alert
   */
  static createPerformanceAlert = async (req: Request, res: Response) => {
    try {
      const alertData = req.body;
      
      // Validate required fields
      const requiredFields = ['id', 'name', 'threshold', 'comparison', 'metricPath', 'severity'];
      const missingFields = requiredFields.filter(field => !alertData[field]);
      
      if (missingFields.length > 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Missing required fields',
          missingFields
        });
      }

      // Validate comparison operator
      if (!['gt', 'lt', 'eq'].includes(alertData.comparison)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Invalid comparison operator',
          validOperators: ['gt', 'lt', 'eq']
        });
      }

      // Validate severity
      if (!['critical', 'warning', 'info'].includes(alertData.severity)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Invalid severity level',
          validSeverities: ['critical', 'warning', 'info']
        });
      }

      // Set defaults
      const alert = {
        enabled: true,
        cooldownMs: 5 * 60 * 1000, // 5 minutes default
        ...alertData
      };

      performanceMonitoringService.addAlert(alert);
      
      res.status(HTTP_STATUS.CREATED).json({
        message: 'Performance alert created successfully',
        alert,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to create performance alert:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to create performance alert',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Delete performance alert
   */
  static deletePerformanceAlert = async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      
      const removed = performanceMonitoringService.removeAlert(alertId);
      
      if (!removed) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Performance alert not found',
          alertId
        });
      }

      res.json({
        message: 'Performance alert removed successfully',
        alertId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to delete performance alert:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to delete performance alert',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Export performance data for analysis
   */
  static exportPerformanceData = async (req: Request, res: Response) => {
    try {
      const timeRange = parseInt(req.query.timeRange as string) || 60; // Default 60 minutes
      const format = req.query.format as string || 'json';
      
      if (timeRange < 1 || timeRange > 2880) { // Max 48 hours
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Time range must be between 1 and 2880 minutes'
        });
      }

      const exportData = performanceMonitoringService.exportMetricsData(timeRange);
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvData = this.convertToCsv(exportData.metrics);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="performance-metrics-${Date.now()}.csv"`);
        res.send(csvData);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="performance-metrics-${Date.now()}.json"`);
        res.json(exportData);
      }
    } catch (error) {
      console.error('Failed to export performance data:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to export performance data',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Get real-time performance metrics (Server-Sent Events)
   */
  static getRealtimeMetrics = async (req: Request, res: Response) => {
    try {
      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Send initial metrics
      const initialMetrics = performanceMonitoringService.getCurrentMetrics();
      if (initialMetrics) {
        res.write(`data: ${JSON.stringify(initialMetrics)}\n\n`);
      }

      // Set up metrics listener
      const metricsListener = (metrics: any) => {
        res.write(`data: ${JSON.stringify(metrics)}\n\n`);
      };

      performanceMonitoringService.on('metricsUpdated', metricsListener);

      // Cleanup on client disconnect
      req.on('close', () => {
        performanceMonitoringService.removeListener('metricsUpdated', metricsListener);
      });

      // Send heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        res.write(`: heartbeat\n\n`);
      }, 30000);

      req.on('close', () => {
        clearInterval(heartbeatInterval);
      });

    } catch (error) {
      console.error('Failed to setup realtime metrics:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to setup realtime metrics',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Force metrics collection (for testing/debugging)
   */
  static forceMetricsCollection = async (req: Request, res: Response) => {
    try {
      const metrics = await performanceMonitoringService.collectMetrics();
      
      res.json({
        message: 'Metrics collection forced successfully',
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to force metrics collection:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to force metrics collection',
        timestamp: new Date().toISOString()
      });
    }
  };

  // ==================== Private Helper Methods ====================

  /**
   * Convert metrics data to CSV format
   */
  private static convertToCsv(metrics: any[]): string {
    if (metrics.length === 0) return '';

    // Get all unique keys from metrics
    const allKeys = new Set<string>();
    metrics.forEach(metric => {
      this.flattenObject(metric).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys).sort();
    const csvRows = [headers.join(',')];

    // Convert each metric to CSV row
    metrics.forEach(metric => {
      const flatMetric = this.flattenObject(metric);
      const row = headers.map(header => {
        const value = flatMetric.get(header) || '';
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Flatten nested object for CSV conversion
   */
  private static flattenObject(obj: any, prefix = ''): Map<string, any> {
    const flattened = new Map<string, any>();

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.flattenObject(value, newKey);
        nested.forEach((v, k) => flattened.set(k, v));
      } else {
        flattened.set(newKey, value);
      }
    }

    return flattened;
  }
}