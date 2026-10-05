import {getLogger} from './Logger.js'
/**
 * Wraps the winston logger with test context (test name, step tracking).
 * Use this in page objects and test helpers so every log line is traceable
 * back to the test that produced it.
 */

export class TestLogger {
  constructor(testName) {
    this.logger = getLogger();
    this.testName = testName;
    this.stepCounter = 0;
  }

  step(description) {
    this.stepCounter++;
    this.logger.info(description, {
      testName: this.testName,
      step: this.stepCounter,
    });
  }

  info(message, meta = {}) {
    this.logger.info(message, { testName: this.testName, ...meta });
  }

  debug(message, meta = {}) {
    this.logger.debug(message, { testName: this.testName, ...meta });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, { testName: this.testName, ...meta });
  }

  error(message, meta = {}) {
    this.logger.error(message, { testName: this.testName, ...meta });
  }

  logRequest(method, url, status, duration) {
    this.logger.info(`API ${method} ${url} → ${status} (${duration}ms)`, {
      testName: this.testName,
      method,
      url,
      status,
      duration,
    });
  }

  logAssertion(description, passed) {
    const level = passed ? 'debug' : 'error';
    this.logger[level](`Assertion ${passed ? 'PASSED' : 'FAILED'}: ${description}`, {
      testName: this.testName,
    });
  }
}