import { chromium } from '@playwright/test';
import { getEnvConfig } from '../src/config/environments.js';
import { CREDENTIALS } from '../src/config/constants.js';
import { getLogger } from '../src/logging/index.js';

export default async function globalSetup() {
  const logger = getLogger();
  const env = getEnvConfig();

  logger.info('Global setup: starting authentication');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${env.baseURL}/login`);
    await page.getByLabel('Username').fill(CREDENTIALS.ADMIN.username);
    await page.getByLabel('Password').fill(CREDENTIALS.ADMIN.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.context().storageState({ path: 'auth/session.json' });
    logger.info('Global setup: authentication state saved to auth/session.json');
  } catch (error) {
    logger.error(`Global setup: login failed — ${error.message}`);
    await page.screenshot({ path: 'test-results/global-setup-failure.png' });
    throw error;
  } finally {
    await browser.close();
  }
}
