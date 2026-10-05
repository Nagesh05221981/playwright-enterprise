import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../utils/ApiClient.js';
import { TestDataFactory } from '../utils/TestDataFactory.js';
import { WaitHelper } from '../utils/WaitHelper.js';
import { NetworkInterceptor } from '../utils/NetworkInterceptor.js';
import { AccessibilityHelper } from '../helpers/AccessibilityHelper.js';
import { VisualHelper } from '../helpers/VisualHelper.js';
import { TestLogger } from '../logging/TestLogger.js';
import { getEnvConfig } from '../config/environments.js';

export const test = base.extend({

  // ---- Logger fixture ----

  log: async ({}, use, testInfo) => {
    const logger = new TestLogger(testInfo.title);
    logger.info(`Test started: ${testInfo.title}`);
    await use(logger);
    logger.info(`Test finished: ${testInfo.title} — ${testInfo.status}`);
  },

  // ---- Wait helper ----

  waitHelper: async ({ page }, use, testInfo) => {
    await use(new WaitHelper(page, testInfo));
  },

  // ---- Network interceptor ----

  networkInterceptor: async ({ page }, use, testInfo) => {
    const interceptor = new NetworkInterceptor(page, testInfo);
    interceptor.start();
    await use(interceptor);
    const summary = interceptor.getSummary();
    if (summary.failedRequests > 0) {
      const logger = new TestLogger(testInfo.title);
      logger.warn(`Network summary: ${summary.totalRequests} requests, ${summary.failedRequests} failed`);
    }
  },

  // ---- Accessibility helper ----

  a11y: async ({ page }, use, testInfo) => {
    await use(new AccessibilityHelper(page, testInfo));
  },

  // ---- Visual regression helper ----

  visual: async ({ page }, use, testInfo) => {
    await use(new VisualHelper(page, expect, testInfo));
  },

  // ---- Authenticated page fixture ----

  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: 'auth/session.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // ---- API client fixture ----

  apiClient: async ({ playwright }, use, testInfo) => {
    const env = getEnvConfig();
    const requestContext = await playwright.request.newContext({
      baseURL: env.apiURL,
    });
    const client = new ApiClient(env.apiURL, requestContext, testInfo);
    await use(client);
    await requestContext.dispose();
  },

  // ---- Test data fixture ----

  testData: async ({}, use) => {
    await use(TestDataFactory);
  },
});

export { expect };
