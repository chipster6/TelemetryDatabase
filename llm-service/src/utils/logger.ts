import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'llm-service' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      handleExceptions: true
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      handleExceptions: true
    })
  ],
});

// If we're not in production, log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    handleExceptions: true
  }));
}

// Suppress logs during testing unless explicitly requested
if (process.env.NODE_ENV === 'test' && process.env.LOG_LEVEL !== 'debug') {
  logger.transports.forEach((transport) => {
    transport.silent = true;
  });
}