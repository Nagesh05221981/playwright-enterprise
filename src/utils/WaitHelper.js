import { TIMEOUTS } from '../config/constants.js';
import { TestLogger } from '../logging/index.js';

export class WaitHelper {
  constructor(page, testInfo) {
    this.page = page;
    this.logger = new TestLogger(testInfo?.title || 'wait-helper');
  }

  async waitForAPIResponse(urlPattern, status = 200) {
    this.logger.debug(`Waiting for API response matching "${urlPattern}" with status ${status}`);
    return await this.page.waitForResponse(
      (response) => response.url().includes(urlPattern) && response.status() === status
    );
  }

  async waitForElementToDisappear(locator, timeout = TIMEOUTS.DEFAULT) {
    this.logger.debug('Waiting for element to disappear');
    await locator.waitFor({ state: 'hidden', timeout });
  }

  async waitForLoadingSpinner(spinnerLocator) {
    this.logger.debug('Waiting for loading spinner to complete');
    try {
      await spinnerLocator.waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });
    } catch {
      // Spinner may have already gone
    }
    await spinnerLocator.waitFor({ state: 'hidden', timeout: TIMEOUTS.LONG });
  }

  async waitForToast(expectedText) {
    this.logger.debug(`Waiting for toast: "${expectedText}"`);
    const toast = this.page.getByRole('alert').filter({ hasText: expectedText });
    await toast.waitFor({ state: 'visible', timeout: TIMEOUTS.DEFAULT });
    return toast;
  }

  async retryAction(action, maxRetries = 3, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Retry attempt ${attempt}/${maxRetries}`);
        return await action();
      } catch (error) {
        this.logger.warn(`Attempt ${attempt} failed: ${error.message}`);
        if (attempt === maxRetries) throw error;
        await this.page.waitForTimeout(delayMs);
      }
    }
  }
}
