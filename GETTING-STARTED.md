# Getting Started — Team Onboarding Guide

This framework is a **shared, reusable test automation platform**. Your team installs it and builds on top of it — you write only what's specific to your application.

---

## What You Get Out of the Box

| Capability | Description |
|------------|-------------|
| `BasePage` | Generic page object with navigation, clicks, fills, screenshots, iframes, keyboard — all auto-logged |
| `log` fixture | Structured Winston logger with test name, step numbers, file output |
| `apiClient` fixture | HTTP client (GET/POST/PUT/DELETE) with request/response logging |
| `testData` fixture | Faker-based dynamic data factory (users, addresses, products, orders) |
| `waitHelper` fixture | Smart waits — API responses, spinners, toasts, retry with backoff |
| `networkInterceptor` fixture | Monitors all network requests, flags failures automatically |
| `a11y` fixture | axe-core accessibility scanning with WCAG 2.1 AA assertions |
| `visual` fixture | Screenshot comparison — full-page, element-level, responsive viewports |
| `authenticatedPage` fixture | Pre-authenticated browser context from stored session |
| Custom Reporter | Console summary + JSON output (`run-summary.json`) for CI dashboards |
| Multi-environment | dev / staging / prod config with `.env` files |
| CI/CD pipeline | GitHub Actions with 4-way sharding, artifact collection, manual dispatch |

---

## Step 1: Install the Framework

```bash
npm install @yourorg/playwright-core
npx playwright install --with-deps
```

Or if working locally within this repo, imports use relative paths (e.g., `../src/fixtures/index.js`).

---

## Step 2: Set Up Your Project Structure

```
your-project/
├── pages/                    ← YOUR app's page objects (extend BasePage)
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   └── components/
│       └── Header.js
├── fixtures/
│   └── index.js              ← YOUR extended fixtures (adds your page objects)
├── tests/
│   ├── sanity/               ← Quick health checks (< 2 min)
│   ├── smoke/                ← Core flows (< 10 min)
│   ├── regression/           ← Full coverage (30+ min)
│   ├── e2e/                  ← End-to-end user journeys
│   ├── api/                  ← API-only tests
│   ├── accessibility/        ← WCAG a11y scans
│   └── visual/               ← Visual regression screenshots
├── test-data/
│   └── fixtures/             ← Static test data (JSON)
├── .env.dev                  ← Environment config
├── .env.staging
└── playwright.config.js      ← Copy from framework, customize baseURL
```

---

## Step 3: Create Your Page Objects

Every page object extends `BasePage`. You only write **your app's selectors and actions**.

```js
// pages/LoginPage.js
import { BasePage } from '@yourorg/playwright-core/pages';
// Local: import { BasePage } from '../src/pages/BasePage.js';

export class LoginPage extends BasePage {
  constructor(page, testInfo) {
    super(page, testInfo);
    // YOUR app's selectors — only thing you define
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: /log in/i });
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    await this.navigate('/login');  // inherited from BasePage — auto-logged
  }

  async login(username, password) {
    this.logger.step(`Logging in as "${username}"`);  // inherited logger
    await this.fill(this.usernameInput, username, 'username');  // inherited — auto-logged
    await this.fill(this.passwordInput, password, 'password');
    await this.click(this.loginButton, 'login button');
  }

  async getErrorMessage() {
    return await this.getTextContent(this.errorMessage);  // inherited
  }
}
```

**Selector best practices** (in priority order):
1. `page.getByRole('button', { name: 'Submit' })` — accessible role + name
2. `page.getByLabel('Email')` — form labels
3. `page.getByTestId('checkout-btn')` — data-testid attributes
4. Never use raw CSS selectors like `.btn-primary` or `#submit`

---

## Step 4: Create Your Extended Fixtures

Extend the framework's fixtures to add your page objects.

```js
// fixtures/index.js
import { test as baseTest, expect } from '@yourorg/playwright-core/fixtures';
// Local: import { test as baseTest, expect } from '../src/fixtures/index.js';

import { LoginPage } from '../pages/LoginPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { Header } from '../pages/components/Header.js';

export const test = baseTest.extend({
  loginPage: async ({ page }, use, testInfo) => {
    await use(new LoginPage(page, testInfo));
  },
  dashboardPage: async ({ page }, use, testInfo) => {
    await use(new DashboardPage(page, testInfo));
  },
  header: async ({ page }, use) => {
    await use(new Header(page));
  },
});

export { expect };
```

**Your tests now get everything merged:**
```
From framework (automatic):       From your project (you added):
├── log                           ├── loginPage
├── apiClient                     ├── dashboardPage
├── testData                      └── header
├── waitHelper
├── networkInterceptor
├── a11y
├── visual
└── authenticatedPage
```

---

## Step 5: Write Tests

```js
// tests/smoke/login.spec.js
import { test, expect } from '../../fixtures/index.js';
import { CREDENTIALS, TEST_TAGS } from '@yourorg/playwright-core/constants';

test('should login with valid credentials @smoke @critical', async ({ loginPage, page, log }) => {
  log.step('Navigate to login page');
  await loginPage.goto();

  log.step('Login with admin credentials');
  await loginPage.login(CREDENTIALS.ADMIN.username, CREDENTIALS.ADMIN.password);

  log.step('Verify redirect to dashboard');
  await expect(page).toHaveURL(/dashboard/);
});
```

---

## Tagging System

The framework supports **two ways to organize and run tests**: directory-based projects and tag-based filtering. Use both together.

### Available Tags

| Tag | Purpose | When to use |
|-----|---------|-------------|
| `@sanity` | Ultra-fast health checks | After every deployment — "is the app alive?" (< 2 min) |
| `@smoke` | Core user flows | Pre-merge PR checks — "do critical paths work?" (< 10 min) |
| `@regression` | Full feature coverage | Nightly/scheduled runs — "did anything break?" (30+ min) |
| `@e2e` | End-to-end user journeys | Complex multi-step workflows |
| `@api` | API-only tests | Backend validation without a browser |
| `@critical` | Business-critical tests | Must-pass for release sign-off |
| `@flaky` | Known unstable tests | Excluded from release gates, tracked for fixing |
| `@a11y` | Accessibility tests | WCAG compliance checks |
| `@visual` | Visual regression tests | UI screenshot comparisons |

### How to Tag Tests

**Option A — Tag in the test title** (simple, visible):
```js
test('should load homepage @sanity @critical', async ({ page, log }) => {
  // ...
});
```

**Option B — Tag via Playwright's tag option** (structured):
```js
test('should load homepage', { tag: ['@sanity', '@critical'] }, async ({ page, log }) => {
  // ...
});
```

**Option C — Tag an entire describe block**:
```js
test.describe('Login', { tag: '@smoke' }, () => {
  test('should login with valid credentials', async ({ loginPage }) => {
    // This test inherits @smoke from the describe block
  });

  test('should show error for invalid credentials', async ({ loginPage }) => {
    // This test also inherits @smoke
  });
});
```

### How to Run by Tag

```bash
# Run all tests tagged @sanity (across ALL directories)
npm run tag:sanity

# Run all tests tagged @smoke
npm run tag:smoke

# Run all tests tagged @regression
npm run tag:regression

# Run all tests tagged @critical
npm run tag:critical

# Exclude flaky tests from a run
npm run tag:exclude-flaky

# Combine: run smoke tests on staging, excluding flaky
TEST_ENV=staging npx playwright test --grep @smoke --grep-invert @flaky

# Combine: run critical smoke tests only
npx playwright test --grep "(?=.*@smoke)(?=.*@critical)"

# Run by directory project (all tests in tests/smoke/)
npm run test:smoke

# Combine project + tag: only critical tests within the smoke directory
npx playwright test --project=smoke --grep @critical
```

### Directory Projects vs Tags — When to Use Which

| Approach | Use when | Example |
|----------|----------|---------|
| **Directory** (`--project=smoke`) | Tests live in a dedicated folder and always run together | `tests/smoke/`, `tests/api/` |
| **Tag** (`--grep @smoke`) | Tests are spread across folders but share a category | A login test tagged `@smoke @critical` in `tests/e2e/` |
| **Both** | Maximum flexibility | `npx playwright test --project=e2e --grep @critical` |

**Recommended approach**: Put tests in the directory matching their primary suite, then add tags for cross-cutting concerns:

```js
// tests/e2e/checkout.spec.js — lives in e2e directory
test.describe('Checkout', { tag: ['@regression', '@critical'] }, () => {
  test('should complete purchase @smoke', async ({ checkoutPage, log }) => {
    // Tagged @smoke because this specific test is also part of smoke suite
    // Tagged @regression + @critical from the describe block
  });

  test('should apply discount code', async ({ checkoutPage, log }) => {
    // Inherits @regression + @critical from describe
    // NOT @smoke — only runs in full regression
  });
});
```

### Tagging Pyramid (recommended distribution)

```
        ┌──────────┐
        │  @sanity  │   5-10 tests    — "Is the app alive?"
        │  (< 2m)  │   Login, homepage loads, API health
        ├──────────┤
        │  @smoke   │   20-50 tests   — "Do critical paths work?"
        │  (< 10m) │   Login, search, checkout, key CRUD
        ├──────────┤
        │@regression│   100+ tests    — "Did anything break?"
        │  (30m+)  │   Full feature coverage, edge cases
        └──────────┘
```

### When Each Suite Runs

| Suite | Trigger | Environment |
|-------|---------|-------------|
| `@sanity` | After every deployment | Production / Staging |
| `@smoke` | Every PR, pre-merge | Dev / Staging |
| `@regression` | Nightly scheduled run | Staging |
| `@a11y` | Weekly or per-sprint | Staging |
| `@visual` | After UI changes | Staging |
| `@critical` | Release gate — must pass | Staging / Pre-prod |

---

## Step 6: Configure Your Environment

Copy and edit `.env.dev` for your app:

```env
TEST_ENV=dev
BASE_URL=http://localhost:3000
API_URL=http://localhost:3000/api
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
STD_USERNAME=user
STD_PASSWORD=user123
LOG_LEVEL=debug
```

---

## Step 7: Run Tests

```bash
# ---- By Suite (directory-based) ----
npm run test:sanity              # Quick health checks
npm run test:smoke               # Core flows
npm run test:regression          # Full coverage
npm run test:e2e                 # End-to-end journeys
npm run test:api                 # API tests
npm run test:a11y                # Accessibility scans
npm run test:visual              # Visual regression

# ---- By Tag (cross-directory) ----
npm run tag:sanity               # All @sanity tagged tests
npm run tag:smoke                # All @smoke tagged tests
npm run tag:regression           # All @regression tagged tests
npm run tag:critical             # All @critical tagged tests
npm run tag:exclude-flaky        # Everything except @flaky

# ---- By Environment ----
npm run test:dev                 # Run against dev
npm run test:staging             # Run against staging
npm run test:prod                # Run against production

# ---- Development helpers ----
npm run test:headed              # See the browser
npm run test:debug               # Step-by-step debugging
npm run test:ui                  # Playwright interactive UI

# ---- Reporting ----
npm run report                   # Open HTML report
npm run report:allure            # Generate + open Allure report

# ---- Maintenance ----
npm run lint                     # Check code quality
npm run lint:fix                 # Auto-fix lint issues
npm run clean                    # Delete all output artifacts
```

---

## Step 8: Using Framework Fixtures in Tests

### Logger (`log`)
```js
test('example', async ({ log }) => {
  log.step('Navigate to page');        // Numbered step — [Step 1] Navigate to page
  log.info('Additional context');       // Info level
  log.debug('Verbose detail');          // Debug level (set LOG_LEVEL=debug)
  log.warn('Something unexpected');     // Warning
  log.error('Something failed');        // Error
});
```

### API Client (`apiClient`)
```js
test('example', async ({ apiClient }) => {
  await apiClient.authenticate('admin', 'password');  // Sets Bearer token
  const { status, data } = await apiClient.get('/users');
  const { status: s2, data: created } = await apiClient.post('/users', { name: 'Test' });
  await apiClient.put('/users/1', { name: 'Updated' });
  await apiClient.delete('/users/1');
  // Every call is logged with method, URL, status, and duration
});
```

### Test Data (`testData`)
```js
test('example', async ({ testData }) => {
  const user = testData.createUser();                // Random user with name, email, phone, password
  const user2 = testData.createUser({ role: 'admin' }); // Override specific fields
  const address = testData.createAddress();
  const product = testData.createProduct();
  const order = testData.createOrder();              // Includes product + shipping address
});
```

### Accessibility (`a11y`)
```js
test('example', async ({ page, a11y }) => {
  await page.goto('/');
  const violations = await a11y.scan({ tags: ['wcag2a', 'wcag2aa'] });  // Returns violations
  await a11y.assertNoViolations({ tags: ['wcag2a', 'wcag2aa'] });       // Throws if violations found
});
```

### Visual Regression (`visual`)
```js
test('example', async ({ page, visual }) => {
  await page.goto('/');
  await visual.compareFullPage('homepage');                 // Full page screenshot comparison
  await visual.compareElement(page.locator('.hero'), 'hero-section'); // Element comparison
  await visual.compareResponsive('homepage-responsive');    // Desktop + tablet + mobile
});
```

### Wait Helper (`waitHelper`)
```js
test('example', async ({ waitHelper }) => {
  await waitHelper.waitForAPIResponse('/api/users', 200);
  await waitHelper.waitForLoadingSpinner(page.locator('.spinner'));
  await waitHelper.waitForToast('Item saved successfully');
  await waitHelper.waitForElementToDisappear(page.locator('.modal'));
  const result = await waitHelper.retryAction(async () => {
    // Retries up to 3 times with 1s delay
  });
});
```

### Network Interceptor (`networkInterceptor`)
```js
test('example', async ({ page, networkInterceptor }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  const failed = networkInterceptor.getFailedRequests();   // Array of failed requests
  const summary = networkInterceptor.getSummary();          // { totalRequests, failedRequests }
  expect(failed).toHaveLength(0);                          // Assert no network failures
});
```

---

## Step 9: CI/CD Setup

Copy `.github/workflows/playwright.yml` from the framework to your project. Configure:

1. **GitHub Secrets**: Add `ADMIN_USERNAME`, `ADMIN_PASSWORD` in repo settings
2. **Environment URLs**: Update `.env.staging` with your staging URLs
3. **Manual dispatch**: Trigger from GitHub Actions UI — pick environment + suite

The pipeline provides:
- 4-way parallel sharding
- Artifact collection (reports + logs + screenshots)
- Report merging across shards
- Manual trigger to pick environment and test suite

---

## Reporting

### Level 1 — Console Summary (every run)
```
========== TEST RUN SUMMARY ==========
Status:    PASSED
Total:     47
Passed:    45
Failed:    1
Skipped:   1
Pass Rate: 95.7%
Duration:  42.3s
=======================================
```

### Level 2 — JSON Machine-Readable (`test-results/run-summary.json`)
Consumed by dashboards, Slack bots, or Jira integrations. Contains pass rate, failure details, environment, duration.

### Level 3 — HTML Reports
- `npm run report` — Playwright HTML report with screenshots, traces, video
- `npm run report:allure` — Allure rich dashboards
- JUnit XML at `test-results/junit-results.xml` for Jenkins/Azure DevOps

---

## Quick Reference

| I want to... | Command |
|---------------|---------|
| Run sanity checks | `npm run test:sanity` or `npm run tag:sanity` |
| Run smoke tests | `npm run test:smoke` or `npm run tag:smoke` |
| Run full regression | `npm run test:regression` |
| Run only critical tests | `npm run tag:critical` |
| Skip flaky tests | `npm run tag:exclude-flaky` |
| Run on staging | `npm run test:staging` |
| Run one file | `npx playwright test tests/smoke/login.spec.js` |
| Run in browser | `npm run test:headed` |
| Debug step-by-step | `npm run test:debug` |
| See HTML report | `npm run report` |
| Update visual baselines | `npx playwright test --project=visual --update-snapshots` |
| Check accessibility | `npm run test:a11y` |
