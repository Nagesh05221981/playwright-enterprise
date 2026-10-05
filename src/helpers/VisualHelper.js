import { TestLogger } from '../logging/index.js';

/**
 * Uses Playwright's built-in screenshot comparison for visual regression testing.
 * No external service required — snapshots stored in the repo.
 */
export class VisualHelper {
  constructor(page, expect, testInfo) {
    this.page = page;
    this.expect = expect;
    this.testInfo = testInfo;
    this.logger = new TestLogger(testInfo?.title || 'visual');
  }

  /**
   * Full-page screenshot comparison.
   * First run creates the baseline; subsequent runs compare against it.
   */
  async compareFullPage(name, options = {}) {
    this.logger.step(`Visual comparison: full page — "${name}"`);
    await this.expect(this.page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: options.maxDiffPixelRatio || 0.01,
      ...options,
    });
  }

  /**
   * Element-level screenshot comparison.
   */
  async compareElement(locator, name, options = {}) {
    this.logger.step(`Visual comparison: element — "${name}"`);
    await this.expect(locator).toHaveScreenshot(`${name}.png`, {
      maxDiffPixelRatio: options.maxDiffPixelRatio || 0.01,
      ...options,
    });
  }

  /**
   * Compare across multiple viewport sizes.
   */
  async compareResponsive(name, viewports) {
    const sizes = viewports || [
      { width: 1920, height: 1080, label: 'desktop' },
      { width: 768, height: 1024, label: 'tablet' },
      { width: 375, height: 812, label: 'mobile' },
    ];

    for (const vp of sizes) {
      await this.page.setViewportSize({ width: vp.width, height: vp.height });
      await this.page.waitForTimeout(300);
      this.logger.info(`Capturing ${vp.label} (${vp.width}x${vp.height})`);
      await this.expect(this.page).toHaveScreenshot(`${name}-${vp.label}.png`, {
        fullPage: true,
      });
    }
  }
}
