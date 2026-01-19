/**
 * Error logging utilities for Telegram MCP server
 */

import winston from 'winston';
import { serializeError } from 'serialize-error';

// Configure Winston logger
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-mcp' },
  transports: [
    new winston.transports.File({ filename: 'search_errors.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Log operation errors with structured data
 */
export function logOperationError(
  operation: string,
  error: any,
  context: Record<string, any>
) {
  const serializedError = serializeError(error);
  const logData = {
    operation,
    error: {
      message: error.message,
      code: error.code || error.error_code,
      stack: error.stack,
      ...serializedError
    },
    context,
    timestamp: new Date().toISOString()
  };

  if (isOperationalError(error)) {
    logger.warn('Operational error in operation', logData);
  } else {
    logger.error('Programming error in operation', logData);
  }
}

/**
 * Check if error is operational (expected) or programming (unexpected)
 */
function isOperationalError(error: any): boolean {
  // Telegram API errors that are expected and recoverable
  const operationalCodes = [400, 401, 403, 404, 429];
  return operationalCodes.includes(error.code || error.error_code);
}