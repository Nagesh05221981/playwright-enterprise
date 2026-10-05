import AxeBuilder from '@axe-core/playwright';
import { TestLogger } from '../logging/index.js';

export class AccessibilityHelper {
  constructor(page, testInfo) {
    this.page = page;
    this.testInfo = testInfo;
    this.logger = new TestLogger(testInfo?.title || 'a11y');
  }

  /**
   * Run an axe accessibility scan on the current page.
   * Returns violations array. Attach results to test report.
   */
  async scan(options = {}) {
    this.logger.step('Running accessibility scan');
    const builder = new AxeBuilder({ page: this.page });

    if (options.tags) builder.withTags(options.tags);
    if (options.exclude) builder.exclude(options.exclude);
    if (options.include) builder.include(options.include);

    const results = await builder.analyze();

    this.logger.info(`Accessibility scan complete: ${results.violations.length} violations found`);

    // Attach full results to the Playwright test report
    await this.testInfo.attach('a11y-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });

    // Log each violation
    for (const violation of results.violations) {
      this.logger.warn(
        `A11Y violation [${violation.impact}]: ${violation.id} — ${violation.description} (${violation.nodes.length} instances)`
      );
    }

    return results.violations;
  }

  /**
   * Assert zero violations. Use in dedicated a11y tests.
   */
  async assertNoViolations(options = {}) {
    const violations = await this.scan(options);
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
        .join('\n');
      throw new Error(`Accessibility violations found:\n${summary}`);
    }
  }
}
