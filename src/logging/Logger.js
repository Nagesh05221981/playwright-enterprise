import winston from 'winston'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = path.resolve(__dirname, '../../logs')
// Custom format: timestamp + level + test context + message
const logFormat = winston.format.printf(({ timestamp, level, message, testName, step, ...meta })=> {
  const parts = [`[${timestamp}]`, `[${level.toUpperCase()}]`];
  if (testName) parts.push(`[Test: ${testName}]`);
  if (step) parts.push(`[Step: ${step}]`);
  parts.push(message);
  if (Object.keys(meta).length > 0) {
    parts.push(JSON.stringify(meta));
  }
  return parts.join(' ');
});

export function createLogger(options = {}) {
  const runId = options.runId || new Date().toISOString().replace(/[:.]/g, '-');
  const level = process.env.LOG_LEVEL || 'info';

  const logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      logFormat,
    ),
    defaultMeta: { runId },
    transports: [
      // Console — colored, concise
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat,
        ),
        level: process.env.CI ? 'warn' : level, // quieter in CI
      }),

      // File — full detail, one file per run
      new winston.transports.File({
        filename: path.join(LOG_DIR, `test-run-${runId}.log`),
        level: 'debug',
        maxsize: 10 * 1024 * 1024, // 10MB per file
        maxFiles: 20,
      }),

      // Error-only file — quick access to failures
      new winston.transports.File({
        filename: path.join(LOG_DIR, 'errors.log'),
        level: 'error',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 10,
      }),
    ],
  });

  return logger;
}

// Singleton for shared use
let _defaultLogger;
export function getLogger() {
  if (!_defaultLogger) {
    _defaultLogger = createLogger();
  }
  return _defaultLogger;
}