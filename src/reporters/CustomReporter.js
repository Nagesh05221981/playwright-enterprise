import fs from 'fs';
import path from 'path';

class CustomReporter {
  constructor(options) {
    this.options = options;
    this.results = { passed: 0, failed: 0, skipped: 0, flaky: 0, tests: [] };
    this.startTime = null;
    this.testOutcomes = new Map(); // track per-test final outcome
  }

  onBegin(config, suite) {
    this.startTime = Date.now();
    const totalTests = suite.allTests().length;
    console.log(`\n========== TEST RUN STARTING ==========`);
    console.log(`Tests:       ${totalTests}`);
    console.log(`Projects:    ${config.projects.length}`);
    console.log(`Workers:     ${config.workers}`);
    console.log(`Environment: ${process.env.TEST_ENV || 'dev'}`);
    console.log(`========================================\n`);
  }

  onTestEnd(test, result) {
    // Store the latest result per test — overwrites previous retries
    this.testOutcomes.set(test.id, { test, result });
  }

  async onEnd(result) {
    // Count only the final outcome of each test (not per-retry)
    for (const { test, result: testResult } of this.testOutcomes.values()) {
      const status = testResult.status;
      if (status === 'passed') {
        this.results.passed++;
        if (testResult.retry > 0) this.results.flaky++;
      } else if (status === 'skipped') {
        this.results.skipped++;
      } else if (status === 'failed') {
        this.results.failed++;
        this.results.tests.push({
          title: test.title,
          suite: test.parent?.title || '',
          file: test.location.file,
          line: test.location.line,
          error: testResult.errors?.[0]?.message || 'Unknown error',
          duration: testResult.duration,
          retry: testResult.retry,
        });
      }
    }

    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const total = this.results.passed + this.results.failed + this.results.skipped;
    const passRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;

    console.log('\n========== TEST RUN SUMMARY ==========');
    console.log(`Status:    ${result.status.toUpperCase()}`);
    console.log(`Total:     ${total}`);
    console.log(`Passed:    ${this.results.passed}`);
    console.log(`Failed:    ${this.results.failed}`);
    console.log(`Skipped:   ${this.results.skipped}`);
    console.log(`Flaky:     ${this.results.flaky}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Duration:  ${duration}s`);
    console.log('=======================================\n');

    if (this.results.tests.length > 0) {
      console.log('FAILED TESTS:');
      console.log('─'.repeat(60));
      this.results.tests.forEach((t) => {
        console.log(`  FAIL: ${t.suite} > ${t.title}`);
        console.log(`        ${t.file}:${t.line}`);
        console.log(`        ${t.error.split('\n')[0]}`);
        if (t.retry > 0) console.log(`        (failed on retry ${t.retry})`);
        console.log('');
      });
    }

    // Write JSON summary for CI/CD tools to consume
    const reportPath = path.resolve('test-results', 'run-summary.json');
    const summary = {
      status: result.status,
      environment: process.env.TEST_ENV || 'dev',
      timestamp: new Date().toISOString(),
      duration: parseFloat(duration),
      passRate: parseFloat(passRate),
      counts: {
        total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        flaky: this.results.flaky,
      },
      failures: this.results.tests,
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    console.log(`Run summary written to: ${reportPath}`);
  }
}

export default CustomReporter;
