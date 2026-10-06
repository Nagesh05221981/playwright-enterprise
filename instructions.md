# Enterprise Playwright Framework — Team Setup Instructions

## Overview

This is a **shared, reusable test automation framework** built on Playwright. Teams install it as a dependency in their own repos and build on top of it — writing only page objects and tests specific to their application.

```
┌─────────────────────────────────────────────┐
│   Nagesh05221981/playwright-enterprise      │  ← Framework (this repo)
│   READ-ONLY for consuming teams             │
└──────────────────┬──────────────────────────┘
                   │ npm install (git dependency)
       ┌───────────┴───────────┐
       │                       │
┌──────┴──────┐         ┌──────┴──────┐
│  Team A     │         │  Team B     │
│  ecommerce- │         │  admin-     │
│  tests      │         │  tests      │
└─────────────┘         └─────────────┘
```

---

## Prerequisites

- **Node.js** v18 or later
- **Git** with SSH access to GitHub
- **Playwright browsers** (installed during setup)

```bash
node -v      # should print v18+
npm -v       # should print 9+
git --version
```

---

## Step 1 — Create Your Team's Repo

Each team creates their own repo. Do NOT clone the framework repo directly.

```bash
mkdir my-app-tests
cd my-app-tests
git init
npm init -y
```

---

## Step 2 — Install the Framework

Install the shared framework as a git dependency:

```bash
npm install git+ssh://git@github.com:Nagesh05221981/playwright-enterprise.git
npm install -D @playwright/test
npx playwright install --with-deps
```

This installs the framework into `node_modules/playwright-enterprise/` — **read-only**. You extend it, never modify it.

To pin to a specific version (recommended):

```bash
npm install git+ssh://git@github.com:Nagesh05221981/playwright-enterprise.git#v1.0.0
```

Your `package.json` will look like:

```json
{
  "name": "my-app-tests",
  "type": "module",
  "dependencies": {
    "playwright-enterprise": "git+ssh://git@github.com:Nagesh05221981/playwright-enterprise.git"
  },
  "devDependencies": {
    "@playwright/test": "^1.62.1"
  }
}
```

---

## Step 3 — Set Up Your Project Structure

```bash
mkdir -p pages/components
mkdir -p fixtures
mkdir -p tests/sanity tests/smoke tests/regression tests/e2e tests/api tests/accessibility tests/visual
mkdir -p test-data/fixtures test-data/uploads
```

Your project should look like:

```
my-app-tests/
├── pages/                          ← YOUR page objects (extend BasePage)
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   └── components/
│       └── Header.js
├── fixtures/
│   └── index.js                    ← YOUR extended fixtures
├── tests/
│   ├── sanity/                     ← Ultra-fast health checks (< 2 min)
│   ├── smoke/                      ← Core flows (< 10 min)
│   ├── regression/                 ← Full coverage (30+ min)
│   ├── e2e/                        ← End-to-end user journeys
│   ├── api/                        ← API tests
│   ├── accessibility/              ← WCAG a11y scans
│   └── visual/                     ← Visual regression
├── test-data/
│   └── fixtures/                   ← Static test data (JSON)
├── .env.dev                        ← YOUR environment config
├── .env.staging
├── playwright.config.js            ← YOUR config
└── package.json
```

---

## Step 4 — Create Your Environment Config

Create `.env.dev` with YOUR application's URLs:

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

Create `.env.staging`:

```env
TEST_ENV=staging
BASE_URL=https://staging.myapp.com
API_URL=https://staging.myapp.com/api
ADMIN_USERNAME=staging_admin
ADMIN_PASSWORD=staging_pass
LOG_LEVEL=info
```

---

## Step 5 — Create Your Playwright Config

Create `playwright.config.js` that uses the framework's environment config:

```js
import { defineConfig, devices } from '@playwright/test';
import { getEnvConfig } from 'playwright-enterprise/src/config/environments.js';
import dotenv from 'dotenv';

const envName = process.env.TEST_ENV || 'dev';
dotenv.config({ path: `.env.${envName}` });

const env = getEnvConfig();

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['playwright-enterprise/src/reporters/CustomReporter.js'],
  ],

  use: {
    baseURL: env.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'sanity',
      testMatch: 'tests/sanity/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke',
      testMatch: 'tests/smoke/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'regression',
      testMatch: 'tests/regression/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
      retries: 1,
    },
    {
      name: 'e2e',
      testMatch: 'tests/e2e/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testMatch: 'tests/api/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'accessibility',
      testMatch: 'tests/accessibility/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual',
      testMatch: 'tests/visual/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

---

## Step 6 — Create Your Page Objects

Import `BasePage` from the framework. Write only YOUR app's selectors.

```js
// pages/LoginPage.js
import { BasePage } from 'playwright-enterprise/src/pages/BasePage.js';

export class LoginPage extends BasePage {
  constructor(page, testInfo) {
    super(page, testInfo);
    // YOUR app's selectors
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: /log in/i });
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    await this.navigate('/login');       // inherited from BasePage — auto-logged
  }

  async login(username, password) {
    this.logger.step(`Logging in as "${username}"`);
    await this.fill(this.usernameInput, username, 'username');
    await this.fill(this.passwordInput, password, 'password');
    await this.click(this.loginButton, 'login button');
  }

  async getErrorMessage() {
    return await this.getTextContent(this.errorMessage);
  }
}
```

```js
// pages/DashboardPage.js
import { BasePage } from 'playwright-enterprise/src/pages/BasePage.js';

export class DashboardPage extends BasePage {
  constructor(page, testInfo) {
    super(page, testInfo);
    this.welcomeMessage = page.getByTestId('welcome-message');
    this.statsCards = page.getByTestId('stats-card');
    this.settingsLink = page.getByRole('link', { name: /settings/i });
  }

  async goto() {
    await this.navigate('/dashboard');
  }

  async getWelcomeText() {
    return await this.getTextContent(this.welcomeMessage);
  }
}
```

**Selector priority** (use in this order):
1. `page.getByRole()` — accessible role + name
2. `page.getByLabel()` — form labels
3. `page.getByTestId()` — data-testid attributes
4. Never use raw CSS selectors

---

## Step 7 — Create Your Extended Fixtures

Extend the framework's fixtures to add your page objects:

```js
// fixtures/index.js
import { test as baseTest, expect } from 'playwright-enterprise/src/fixtures/index.js';
import { LoginPage } from '../pages/LoginPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';

export const test = baseTest.extend({
  loginPage: async ({ page }, use, testInfo) => {
    await use(new LoginPage(page, testInfo));
  },
  dashboardPage: async ({ page }, use, testInfo) => {
    await use(new DashboardPage(page, testInfo));
  },
});

export { expect };
```

Your tests now get **everything merged**:

```
From framework (automatic):       From your project (you added):
├── log                           ├── loginPage
├── apiClient                     └── dashboardPage
├── testData
├── waitHelper
├── networkInterceptor
├── a11y
├── visual
└── authenticatedPage
```

---

## Step 8 — Write Tests

Import from YOUR fixtures, not the framework directly.

```js
// tests/smoke/login.spec.js
import { test, expect } from '../../fixtures/index.js';

test.describe('Login', { tag: '@smoke' }, () => {

  test('should login with valid credentials @critical', async ({ loginPage, page, log }) => {
    log.step('Navigate to login page');
    await loginPage.goto();

    log.step('Login with admin credentials');
    await loginPage.login('admin', 'admin123');

    log.step('Verify redirect to dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should show error for invalid credentials', async ({ loginPage, log }) => {
    log.step('Navigate to login page');
    await loginPage.goto();

    log.step('Login with invalid credentials');
    await loginPage.login('wrong', 'wrong');

    log.step('Verify error message');
    const error = await loginPage.getErrorMessage();
    expect(error).toBeTruthy();
  });

});
```

---

## Step 9 — Add npm Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "test": "npx playwright test",
    "test:sanity": "npx playwright test --project=sanity",
    "test:smoke": "npx playwright test --project=smoke",
    "test:regression": "npx playwright test --project=regression",
    "test:e2e": "npx playwright test --project=e2e",
    "test:api": "npx playwright test --project=api",
    "test:a11y": "npx playwright test --project=accessibility",
    "test:visual": "npx playwright test --project=visual",
    "tag:sanity": "npx playwright test --grep @sanity",
    "tag:smoke": "npx playwright test --grep @smoke",
    "tag:critical": "npx playwright test --grep @critical",
    "tag:exclude-flaky": "npx playwright test --grep-invert @flaky",
    "test:dev": "TEST_ENV=dev npx playwright test",
    "test:staging": "TEST_ENV=staging npx playwright test",
    "test:headed": "npx playwright test --headed",
    "test:debug": "npx playwright test --debug",
    "test:ui": "npx playwright test --ui",
    "report": "npx playwright show-report",
    "clean": "rm -rf test-results playwright-report logs/"
  }
}
```

---

## Step 10 — Set Up Your .gitignore

Create `.gitignore`:

```
node_modules/
.env*
test-results/
playwright-report/
logs/
```

---

## Step 11 — Push Your Repo

```bash
git add .
git commit -m "Initial test project setup with playwright-enterprise framework"
git remote add origin git@github.com:yourorg/my-app-tests.git
git branch -M main
git push -u origin main
```

---

## Step 12 — Set Up CI/CD

Copy the workflow from the framework and customize:

Create `.github/workflows/playwright.yml`:

```yaml
name: Playwright Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options: [dev, staging]
      project:
        description: 'Test suite to run'
        required: true
        default: 'smoke'
        type: choice
        options: [sanity, smoke, regression, e2e, api, accessibility, visual]

env:
  TEST_ENV: ${{ github.event.inputs.environment || 'dev' }}

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    strategy:
      fail-fast: false
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: Run tests
        run: npx playwright test --shard=${{ matrix.shard }} --project=${{ github.event.inputs.project || 'smoke' }}
        env:
          ADMIN_USERNAME: ${{ secrets.ADMIN_USERNAME }}
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ strategy.job-index }}
          path: |
            test-results/
            playwright-report/
            logs/
          retention-days: 14
```

Add your credentials in **GitHub repo → Settings → Secrets → Actions**.

---

## Tagging System

### Available Tags

| Tag | Purpose | When to run |
|-----|---------|-------------|
| `@sanity` | "Is the app alive?" | After every deployment (< 2 min) |
| `@smoke` | "Do critical paths work?" | Every PR, pre-merge (< 10 min) |
| `@regression` | "Did anything break?" | Nightly scheduled run (30+ min) |
| `@critical` | Must-pass for release | Release gate |
| `@flaky` | Known unstable tests | Excluded from release gates |
| `@a11y` | Accessibility checks | Weekly / per-sprint |
| `@visual` | Visual regression | After UI changes |

### How to Tag

```js
// In test title
test('should load homepage @sanity @critical', async ({ page }) => { });

// Via Playwright tag option
test('should load', { tag: ['@sanity', '@critical'] }, async ({ page }) => { });

// Tag entire describe block
test.describe('Login', { tag: '@smoke' }, () => { });
```

### How to Run

```bash
npm run tag:sanity                    # All @sanity tests
npm run tag:smoke                     # All @smoke tests
npm run tag:critical                  # All @critical tests
npm run tag:exclude-flaky             # Everything except @flaky
npm run test:smoke                    # All tests in tests/smoke/
TEST_ENV=staging npm run test:smoke   # Smoke on staging
```

---

## Framework Fixtures — What You Get

| Fixture | Usage |
|---------|-------|
| `log` | `log.step('description')` — structured logging with test context |
| `apiClient` | `apiClient.get('/users')`, `.post()`, `.put()`, `.delete()` — all logged |
| `testData` | `testData.createUser()`, `.createAddress()`, `.createProduct()`, `.createOrder()` |
| `waitHelper` | `waitHelper.waitForAPIResponse()`, `.waitForToast()`, `.retryAction()` |
| `networkInterceptor` | `networkInterceptor.getFailedRequests()`, `.getSummary()` |
| `a11y` | `a11y.scan()`, `a11y.assertNoViolations({ tags: ['wcag2aa'] })` |
| `visual` | `visual.compareFullPage('name')`, `.compareElement()`, `.compareResponsive()` |
| `authenticatedPage` | Pre-authenticated browser context from `auth/session.json` |

---

## Updating the Framework

When the framework team pushes updates:

```bash
# Update to latest
npm update playwright-enterprise

# Or update to a specific tagged version
npm install git+ssh://git@github.com:Nagesh05221981/playwright-enterprise.git#v1.1.0
```

---

## Reporting

The framework provides three levels of reporting:

1. **Console** — Pass/fail summary, failed test details, pass rate, duration
2. **JSON** — `test-results/run-summary.json` for dashboards and CI tools
3. **HTML** — `npm run report` opens interactive Playwright report with screenshots, traces, video

---

## Quick Reference

| I want to... | Command |
|---------------|---------|
| Install framework | `npm install git+ssh://git@github.com:Nagesh05221981/playwright-enterprise.git` |
| Run sanity | `npm run test:sanity` or `npm run tag:sanity` |
| Run smoke | `npm run test:smoke` or `npm run tag:smoke` |
| Run regression | `npm run test:regression` |
| Run on staging | `TEST_ENV=staging npm run test:smoke` |
| Run one file | `npx playwright test tests/smoke/login.spec.js` |
| Run headed | `npm run test:headed` |
| Debug | `npm run test:debug` |
| See report | `npm run report` |
| Update framework | `npm update playwright-enterprise` |
| Update visual baselines | `npx playwright test --project=visual --update-snapshots` |

---

## Rules

1. **Never modify** files inside `node_modules/playwright-enterprise/`
2. **Always extend** — use `BasePage` for page objects, `baseTest.extend()` for fixtures
3. **Import from your fixtures**, not the framework directly (so you get your page objects)
4. **Tag every test** — at minimum `@sanity`, `@smoke`, or `@regression`
5. **No raw CSS selectors** — use `getByRole`, `getByLabel`, `getByTestId`
6. **No hardcoded waits** — use locators, assertions, and `waitHelper`
7. **Log every major step** — `log.step('description')` in every test
8. Follow `CONVENTIONS.md` in the framework repo for naming and standards
