import { TestLogger } from '../logging/index.js';

/**
 * Intercepts and logs all network requests during a test.
 * Useful for debugging flaky tests, catching unexpected API calls,
 * and performance monitoring.
 */
export class NetworkInterceptor {
  constructor(page, testInfo) {
    this.page = page;
    this.logger = new TestLogger(testInfo?.title || 'network');
    this.requests = [];
    this.failedRequests = [];
  }

  start() {
    this.logger.info('Network interception started');

    this.page.on('request', (request) => {
      this.requests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now(),
      });
    });

    this.page.on('requestfailed', (request) => {
      const failure = {
        url: request.url(),
        method: request.method(),
        error: request.failure()?.errorText || 'unknown',
      };
      this.failedRequests.push(failure);
      this.logger.error(`Request failed: ${failure.method} ${failure.url} — ${failure.error}`);
    });

    this.page.on('response', (response) => {
      if (response.status() >= 400) {
        this.logger.warn(`HTTP ${response.status()} — ${response.request().method()} ${response.url()}`);
      }
    });
  }

  getFailedRequests() {
    return this.failedRequests;
  }

  getSummary() {
    return {
      totalRequests: this.requests.length,
      failedRequests: this.failedRequests.length,
    };
  }
}
