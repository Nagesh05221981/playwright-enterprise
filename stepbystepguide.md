# Enterprise Playwright Framework — Step-by-Step Build Guide (Production-Grade)

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Git
- A target web application to test (e.g., `http://localhost:8080`)

---

## Phase 1: Project Foundation

### Step 1: Initialize the project

```bash
mkdir playwright-enterprise && cd playwright-enterprise
npm init -y
```

### Step 2: Install dependencies

```bash
npm install -D @playwright/test
npm install -D dotenv                  # environment variable management
npm install -D @faker-js/faker         # dynamic test data generation
npm install -D winston                 # structured logging framework
npm install -D allure-playwright       # rich test reporting
npm install -D @axe-core/playwright    # accessibility testing
npm install -D eslint @eslint/js       # linting
npx playwright install --with-deps    # install browser binaries
```

### Step 3: Update `package.json`

Set module type and add script commands:

```json
{
  "name": "@yourorg/playwright-framework",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "npx playwright test",
    "test:smoke": "npx playwright test --project=smoke",
    "test:regression": "npx playwright test --project=regression",
    "test:api": "npx playwright test --project=api",
    "test:a11y": "npx playwright test --project=accessibility",
    "test:visual": "npx playwright test --project=visual",
    "test:dev": "TEST_ENV=dev npx playwright test",
    "test:staging": "TEST_ENV=staging npx playwright test",
    "test:prod": "TEST_ENV=prod npx playwright test",
    "test:headed": "npx playwright test --headed",
    "test:debug": "npx playwright test --debug",
    "test:ui": "npx playwright test --ui",
    "report": "npx playwright show-report",
    "report:allure": "allure generate allure-results --clean -o allure-report && allure open allure-report",
    "lint": "eslint tests/ src/",
    "lint:fix": "eslint tests/ src/ --fix",
    "clean": "rm -rf test-results playwright-report allure-results allure-report logs/"
  }
}
```

### Step 4: Create the folder structure

```bash
mkdir -p src/pages/components
mkdir -p src/fixtures
mkdir -p src/utils
mkdir -p src/reporters
mkdir -p src/config
mkdir -p src/logging
mkdir -p src/helpers
mkdir -p tests/smoke
mkdir -p tests/regression
mkdir -p tests/e2e
mkdir -p tests/api
mkdir -p tests/visual
mkdir -p tests/accessibility
mkdir -p test-data/fixtures
mkdir -p test-data/uploads
mkdir -p scripts
mkdir -p auth
mkdir -p logs
```

Your tree should now look like:

```
playwright-enterprise/
├── src/
│   ├── pages/
│   │   └── components/
│   ├── fixtures/
│   ├── utils/
│   ├── reporters/
│   ├── logging/          ← NEW: structured logging
│   ├── helpers/          ← NEW: accessibility, visual, db helpers
│   └── config/
├── tests/
│   ├── smoke/
│   ├── regression/
│   ├── e2e/
│   ├── api/
│   ├── visual/           ← NEW: visual regression tests
│   └── accessibility/    ← NEW: a11y tests
├── test-data/
│   ├── fixtures/
│   └── uploads/
├── scripts/
├── auth/
├── logs/                 ← NEW: log output directory
├── package.json
└── playwright.config.js
```

---

## Phase 2: Structured Logging

> **Why logging matters:** In production automation, `console.log` is useless. You need structured, leveled, searchable logs that correlate to specific test runs. When a nightly regression suite fails at 3 AM, logs are how you diagnose without re-running.

### Step 5: Create the Logger

Create `src/logging/Logger.js`:

```js
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../logs');

// Custom format: timestamp + level + test context + message
const logFormat = winston.format.printf(({ timestamp, level, message, testName, step, ...meta }) => {
  const parts = [`[${timestamp}]`, `[${level.toUpperCase()}]`];
  if (testName) parts.push(`[Test: ${testName}]`);
  if (step) parts.push(`[Step: ${step}]`);
  parts.push(message);
  if (Object.keys(meta).length > 0) {
    parts.push(JSON.stringify(meta));
  }
  return parts.join(' ');
});

export function createLogger(options = {}) {
  const runId = options.runId || new Date().toISOString().replace(/[:.]/g, '-');
  const level = process.env.LOG_LEVEL || 'info';

  const logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      logFormat,
    ),
    defaultMeta: { runId },
    transports: [
      // Console — colored, concise
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat,
        ),
        level: process.env.CI ? 'warn' : level, // quieter in CI
      }),

      // File — full detail, one file per run
      new winston.transports.File({
        filename: path.join(LOG_DIR, `test-run-${runId}.log`),
        level: 'debug',
        maxsize: 10 * 1024 * 1024, // 10MB per file
        maxFiles: 20,
      }),

      // Error-only file — quick access to failures
      new winston.transports.File({
        filename: path.join(LOG_DIR, 'errors.log'),
        level: 'error',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 10,
      }),
    ],
  });

  return logger;
}

// Singleton for shared use
let _defaultLogger;
export function getLogger() {
  if (!_defaultLogger) {
    _defaultLogger = createLogger();
  }
  return _defaultLogger;
}
```

### Step 6: Create a Test-Aware Logger wrapper

Create `src/logging/TestLogger.js`:

```js
import { getLogger } from './Logger.js';

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
```

### Step 7: Create logging index

Create `src/logging/index.js`:

```js
export { createLogger, getLogger } from './Logger.js';
export { TestLogger } from './TestLogger.js';
```

---

## Phase 3: Environment Configuration

### Step 8: Create environment config

Create `src/config/environments.js`:

```js
import { getLogger } from '../logging/index.js';

const envConfig = {
  dev: {
    baseURL: 'http://localhost:8080',
    apiURL: 'http://localhost:8080/api',
    name: 'Development',
  },
  staging: {
    baseURL: 'https://staging.yourapp.com',
    apiURL: 'https://staging.yourapp.com/api',
    name: 'Staging',
  },
  prod: {
    baseURL: 'https://yourapp.com',
    apiURL: 'https://yourapp.com/api',
    name: 'Production',
  },
};

export function getEnvConfig() {
  const logger = getLogger();
  const env = process.env.TEST_ENV || 'dev';
  if (!envConfig[env]) {
    const msg = `Unknown environment: "${env}". Valid values: ${Object.keys(envConfig).join(', ')}`;
    logger.error(msg);
    throw new Error(msg);
  }
  logger.info(`Environment resolved: ${envConfig[env].name} (${envConfig[env].baseURL})`);
  return envConfig[env];
}
```

### Step 9: Create constants file

Create `src/config/constants.js`:

```js
export const TIMEOUTS = {
  SHORT: 5_000,
  DEFAULT: 15_000,
  LONG: 30_000,
  NAVIGATION: 60_000,
  API: 10_000,
};

export const TEST_TAGS = {
  SMOKE: '@smoke',
  REGRESSION: '@regression',
  CRITICAL: '@critical',
  FLAKY: '@flaky',
  A11Y: '@a11y',
  VISUAL: '@visual',
};

export const CREDENTIALS = {
  ADMIN: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  STANDARD: {
    username: process.env.STD_USERNAME || 'user',
    password: process.env.STD_PASSWORD || 'user123',
  },
};

export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};
```

### Step 10: Create `.env` files

Create `.env.dev`:

```
TEST_ENV=dev
BASE_URL=http://localhost:8080
API_URL=http://localhost:8080/api
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
STD_USERNAME=user
STD_PASSWORD=user123
LOG_LEVEL=debug
```

Create `.env.staging`:

```
TEST_ENV=staging
BASE_URL=https://staging.yourapp.com
API_URL=https://staging.yourapp.com/api
ADMIN_USERNAME=staging_admin
ADMIN_PASSWORD=staging_pass
STD_USERNAME=staging_user
STD_PASSWORD=staging_pass
LOG_LEVEL=info
```

Add to `.gitignore`:

```
.env*
auth/
test-results/
playwright-report/
allure-results/
allure-report/
logs/
node_modules/
```

---

## Phase 4: Generic Base Page (Framework Core — app-agnostic)

> **Architecture principle:** The framework core must contain ZERO app-specific selectors. It provides a `BasePage` with generic browser operations that ANY project extends. Each consuming project creates its own page objects (LoginPage, DashboardPage, etc.) with selectors specific to their app.

```
Layer 1: @yourorg/playwright-core (this framework — shared npm package)
├── src/pages/BasePage.js       → Generic browser operations only
├── src/logging/                → Logger, TestLogger
├── src/config/                 → Environment, constants
├── src/utils/                  → ApiClient, TestDataFactory, WaitHelper, NetworkInterceptor
├── src/helpers/                → AccessibilityHelper, VisualHelper
├── src/fixtures/               → Framework fixtures (log, apiClient, a11y, visual, etc.)
└── src/reporters/              → CustomReporter

Layer 2: Each consuming project (e.g., ecommerce-app, admin-portal, mobile-web)
├── pages/LoginPage.js          → extends BasePage — selectors for THIS app
├── pages/DashboardPage.js      → extends BasePage — selectors for THIS app
├── pages/components/Header.js  → component-level page objects for THIS app
├── fixtures/index.js           → extends framework fixtures, adds project-specific ones
└── tests/                      → tests using both layers
```

### Step 11: Create the Base Page (with logging)

This class lives in the **framework core**. It has NO app-specific selectors — only generic, reusable browser operations that every page object across every project inherits.

Create `src/pages/BasePage.js`:

```js
import { TestLogger } from '../logging/index.js';

export class BasePage {
  constructor(page, testInfo) {
    this.page = page;
    this.logger = new TestLogger(testInfo?.title || 'unknown');
  }

  // ---- Navigation ----

  async navigate(path = '/') {
    this.logger.step(`Navigating to ${path}`);
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
    this.logger.debug(`Navigation complete, URL: ${this.page.url()}`);
  }

  async getTitle() {
    const title = await this.page.title();
    this.logger.debug(`Page title: ${title}`);
    return title;
  }

  async getCurrentURL() {
    return this.page.url();
  }

  // ---- Wait operations ----

  async waitForPageLoad() {
    this.logger.debug('Waiting for network idle');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForURL(urlPattern, options = {}) {
    this.logger.debug(`Waiting for URL matching: ${urlPattern}`);
    await this.page.waitForURL(urlPattern, options);
  }

  // ---- Element interactions (generic) ----

  async click(locator, description = '') {
    this.logger.step(`Clicking: ${description || 'element'}`);
    await locator.click();
  }

  async fill(locator, value, description = '') {
    this.logger.step(`Filling "${description || 'field'}" with value`);
    await locator.fill(value);
  }

  async selectOption(locator, value, description = '') {
    this.logger.step(`Selecting "${value}" in ${description || 'dropdown'}`);
    await locator.selectOption(value);
  }

  async check(locator, description = '') {
    this.logger.step(`Checking: ${description || 'checkbox'}`);
    await locator.check();
  }

  async uncheck(locator, description = '') {
    this.logger.step(`Unchecking: ${description || 'checkbox'}`);
    await locator.uncheck();
  }

  async uploadFile(locator, filePath, description = '') {
    this.logger.step(`Uploading file: ${description || filePath}`);
    await locator.setInputFiles(filePath);
  }

  async clickAndWaitForNavigation(locator, description = '') {
    this.logger.step(`Clicking "${description || 'element'}" and waiting for navigation`);
    await Promise.all([
      this.page.waitForLoadState('domcontentloaded'),
      locator.click(),
    ]);
  }

  // ---- Element state queries ----

  async isElementVisible(locator) {
    return await locator.isVisible();
  }

  async isElementEnabled(locator) {
    return await locator.isEnabled();
  }

  async getTextContent(locator) {
    return await locator.textContent();
  }

  async getInputValue(locator) {
    return await locator.inputValue();
  }

  async getElementCount(locator) {
    return await locator.count();
  }

  async getAllTextContents(locator) {
    return await locator.allTextContents();
  }

  // ---- Screenshots ----

  async takeScreenshot(name) {
    this.logger.info(`Taking screenshot: ${name}`);
    return await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  // ---- Iframe support ----

  getFrame(nameOrUrl) {
    this.logger.debug(`Switching to frame: ${nameOrUrl}`);
    return this.page.frameLocator(nameOrUrl);
  }

  // ---- Keyboard and mouse ----

  async pressKey(key) {
    this.logger.debug(`Pressing key: ${key}`);
    await this.page.keyboard.press(key);
  }

  async hover(locator, description = '') {
    this.logger.debug(`Hovering: ${description || 'element'}`);
    await locator.hover();
  }
}
```

### Step 12: Create the pages index (framework core only exports BasePage)

Create `src/pages/index.js`:

```js
export { BasePage } from './BasePage.js';
```

### Step 13: How consuming projects create their own page objects

> **This step is NOT part of the framework core.** This shows what each team does in THEIR project after installing the framework.

In each consuming project, create app-specific page objects that extend `BasePage`:

**Example: `pages/LoginPage.js` (in the consuming project)**

```js
// Import BasePage from the shared framework
import { BasePage } from '@yourorg/playwright-core/pages';
// Or if building locally: import { BasePage } from '../src/pages/BasePage.js';

export class LoginPage extends BasePage {
  constructor(page, testInfo) {
    super(page, testInfo);
    // These selectors are specific to YOUR app — not the framework
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: /sign in|log in|login/i });
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    await this.navigate('/login');
  }

  async login(username, password) {
    this.logger.step(`Logging in as "${username}"`);
    await this.fill(this.usernameInput, username, 'username');
    await this.fill(this.passwordInput, password, 'password');
    await this.click(this.loginButton, 'login button');
    this.logger.info(`Login form submitted for user: ${username}`);
  }

  async loginAndVerify(username, password, expectedURL) {
    await this.login(username, password);
    await this.waitForURL(expectedURL || '**/dashboard');
    this.logger.info(`Login verified, redirected to: ${this.page.url()}`);
  }

  async getErrorMessage() {
    return await this.getTextContent(this.errorMessage);
  }

  async isErrorVisible() {
    return await this.isElementVisible(this.errorMessage);
  }
}
```

**Example: `pages/DashboardPage.js` (in the consuming project)**

```js
import { BasePage } from '@yourorg/playwright-core/pages';

export class DashboardPage extends BasePage {
  constructor(page, testInfo) {
    super(page, testInfo);
    this.welcomeMessage = page.getByTestId('welcome-message');
    this.statsCards = page.getByTestId('stats-card');
    this.recentActivity = page.getByTestId('recent-activity');
    this.settingsLink = page.getByRole('link', { name: /settings/i });
  }

  async goto() {
    await this.navigate('/dashboard');
  }

  async getWelcomeText() {
    return await this.getTextContent(this.welcomeMessage);
  }

  async getStatsCount() {
    return await this.getElementCount(this.statsCards);
  }

  async goToSettings() {
    await this.clickAndWaitForNavigation(this.settingsLink, 'settings link');
  }
}
```

**Example: `pages/components/Header.js` (in the consuming project)**

```js
export class Header {
  constructor(page) {
    this.page = page;
    // Selectors specific to YOUR app's header
    this.logo = page.getByRole('banner').getByRole('img', { name: /logo/i });
    this.navLinks = page.getByRole('navigation');
    this.userMenu = page.getByTestId('user-menu');
    this.logoutButton = page.getByRole('menuitem', { name: /log out|sign out/i });
  }

  async clickNavLink(name) {
    await this.navLinks.getByRole('link', { name }).click();
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
  }

  async getUserName() {
    return await this.userMenu.textContent();
  }
}
```

---

## Phase 5: Utilities

### Step 14: Create an API Client (with request/response logging)

Create `src/utils/ApiClient.js`:

```js
import { TestLogger } from '../logging/index.js';

export class ApiClient {
  constructor(baseURL, request, testInfo) {
    this.baseURL = baseURL;
    this.request = request;
    this.token = null;
    this.logger = new TestLogger(testInfo?.title || 'api-client');
  }

  async authenticate(username, password) {
    this.logger.step(`Authenticating as "${username}"`);
    const start = Date.now();
    const response = await this.request.post(`${this.baseURL}/auth/login`, {
      data: { username, password },
    });
    const body = await response.json();
    this.token = body.token;
    this.logger.logRequest('POST', '/auth/login', response.status(), Date.now() - start);
    return body;
  }

  async get(endpoint) {
    const start = Date.now();
    const response = await this.request.get(`${this.baseURL}${endpoint}`, {
      headers: this._headers(),
    });
    const data = await response.json();
    this.logger.logRequest('GET', endpoint, response.status(), Date.now() - start);
    return { status: response.status(), data };
  }

  async post(endpoint, data) {
    const start = Date.now();
    const response = await this.request.post(`${this.baseURL}${endpoint}`, {
      data,
      headers: this._headers(),
    });
    const responseData = await response.json();
    this.logger.logRequest('POST', endpoint, response.status(), Date.now() - start);
    return { status: response.status(), data: responseData };
  }

  async put(endpoint, data) {
    const start = Date.now();
    const response = await this.request.put(`${this.baseURL}${endpoint}`, {
      data,
      headers: this._headers(),
    });
    const responseData = await response.json();
    this.logger.logRequest('PUT', endpoint, response.status(), Date.now() - start);
    return { status: response.status(), data: responseData };
  }

  async delete(endpoint) {
    const start = Date.now();
    const response = await this.request.delete(`${this.baseURL}${endpoint}`, {
      headers: this._headers(),
    });
    this.logger.logRequest('DELETE', endpoint, response.status(), Date.now() - start);
    return { status: response.status() };
  }

  _headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }
}
```

### Step 15: Create a Test Data Factory

Create `src/utils/TestDataFactory.js`:

```js
import { faker } from '@faker-js/faker';

export class TestDataFactory {
  static createUser(overrides = {}) {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      password: faker.internet.password({ length: 12 }),
      ...overrides,
    };
  }

  static createAddress(overrides = {}) {
    return {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zip: faker.location.zipCode(),
      country: faker.location.country(),
      ...overrides,
    };
  }

  static createProduct(overrides = {}) {
    return {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: parseFloat(faker.commerce.price()),
      category: faker.commerce.department(),
      sku: faker.string.alphanumeric(8).toUpperCase(),
      ...overrides,
    };
  }

  static createOrder(overrides = {}) {
    return {
      orderId: faker.string.uuid(),
      product: this.createProduct(),
      quantity: faker.number.int({ min: 1, max: 10 }),
      shippingAddress: this.createAddress(),
      ...overrides,
    };
  }
}
```

### Step 16: Create a Wait Helper

Create `src/utils/WaitHelper.js`:

```js
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
    this.logger.debug(`Waiting for element to disappear`);
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
```

### Step 17: Create a Network Interceptor utility

Create `src/utils/NetworkInterceptor.js`:

```js
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
```

### Step 18: Create a utils index

Create `src/utils/index.js`:

```js
export { ApiClient } from './ApiClient.js';
export { TestDataFactory } from './TestDataFactory.js';
export { WaitHelper } from './WaitHelper.js';
export { NetworkInterceptor } from './NetworkInterceptor.js';
```

---

## Phase 6: Helpers — Accessibility and Visual Testing

### Step 19: Create an Accessibility Helper

Create `src/helpers/AccessibilityHelper.js`:

```js
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

    if (options.tags) builder.withTags(options.tags);           // e.g., ['wcag2a', 'wcag2aa']
    if (options.exclude) builder.exclude(options.exclude);       // e.g., '.third-party-widget'
    if (options.include) builder.include(options.include);       // e.g., 'main'

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
```

### Step 20: Create a Visual Regression Helper

Create `src/helpers/VisualHelper.js`:

```js
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
      await this.page.waitForTimeout(300); // let layout settle
      this.logger.info(`Capturing ${vp.label} (${vp.width}x${vp.height})`);
      await this.expect(this.page).toHaveScreenshot(`${name}-${vp.label}.png`, {
        fullPage: true,
      });
    }
  }
}
```

### Step 21: Create helpers index

Create `src/helpers/index.js`:

```js
export { AccessibilityHelper } from './AccessibilityHelper.js';
export { VisualHelper } from './VisualHelper.js';
```

---

## Phase 7: Custom Fixtures (Two-Layer Design)

> **Key concept:** The framework ships **generic fixtures** (logger, API client, helpers). Each consuming project **extends** those fixtures to add its own page objects. This is what makes the framework reusable across any UI project.

### Step 22: Create the framework-core fixtures

This file lives in the **framework core**. It contains only app-agnostic fixtures. NO app-specific page objects (LoginPage, Header, etc.) belong here.

Create `src/fixtures/index.js`:

```js
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
```

### Step 23: How consuming projects extend fixtures with their own page objects

> **This step is NOT part of the framework core.** This is what each team does in THEIR project.

In each consuming project, create a `fixtures/index.js` that extends the framework's fixtures and adds app-specific page objects:

**Example: `fixtures/index.js` (in the consuming project)**

```js
// Import the framework's base test object
import { test as baseTest, expect } from '@yourorg/playwright-core/fixtures';
// Or if building locally: import { test as baseTest, expect } from '../src/fixtures/index.js';

// Import YOUR app's page objects (not from the framework)
import { LoginPage } from '../pages/LoginPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { Header } from '../pages/components/Header.js';

// Extend the framework fixtures with your app-specific page objects
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

**What each test now gets automatically:**

```
From the framework (inherited):     From your project (added):
├── log                              ├── loginPage
├── apiClient                        ├── dashboardPage
├── testData                         └── header
├── waitHelper
├── networkInterceptor
├── a11y
├── visual
└── authenticatedPage
```

**Example test using both layers:**

```js
// tests/e2e/login.spec.js — in the consuming project
import { test, expect } from '../fixtures/index.js';  // YOUR project's extended fixtures
import { CREDENTIALS } from '@yourorg/playwright-core/constants';

test('should login and see dashboard', async ({ loginPage, dashboardPage, log }) => {
  log.step('Navigate to login');
  await loginPage.goto();

  log.step('Login with valid credentials');
  await loginPage.login(CREDENTIALS.ADMIN.username, CREDENTIALS.ADMIN.password);

  log.step('Verify dashboard loaded');
  const welcome = await dashboardPage.getWelcomeText();
  expect(welcome).toContain('Welcome');
});
```

---

## Phase 8: Global Setup and Teardown

### Step 24: Create global setup (authentication)

Create `scripts/global-setup.js`:

```js
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
    // Save a screenshot to help debug setup failures
    await page.screenshot({ path: 'test-results/global-setup-failure.png' });
    throw error;
  } finally {
    await browser.close();
  }
}
```

### Step 25: Create global teardown (with cleanup logging)

Create `scripts/global-teardown.js`:

```js
import { getLogger } from '../src/logging/index.js';

export default async function globalTeardown() {
  const logger = getLogger();
  logger.info('Global teardown: starting cleanup');

  // Add cleanup logic here:
  // - Delete test users created during the run
  // - Reset database state via API
  // - Clean up uploaded files
  // - Flush log buffers

  logger.info('Global teardown: cleanup complete');
}
```

---

## Phase 9: Custom Reporter

### Step 26: Create a production-grade custom reporter

Create `src/reporters/CustomReporter.js`:

```js
import fs from 'fs';
import path from 'path';

class CustomReporter {
  constructor(options) {
    this.options = options;
    this.results = { passed: 0, failed: 0, skipped: 0, flaky: 0, tests: [] };
    this.startTime = null;
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
    const status = result.status;
    if (status === 'passed') this.results.passed++;
    else if (status === 'skipped') this.results.skipped++;
    else if (status === 'failed') this.results.failed++;

    if (result.status === 'passed' && result.retry > 0) {
      this.results.flaky++;
    }

    if (status === 'failed') {
      this.results.tests.push({
        title: test.title,
        suite: test.parent?.title || '',
        file: test.location.file,
        line: test.location.line,
        error: result.errors?.[0]?.message || 'Unknown error',
        duration: result.duration,
        retry: result.retry,
      });
    }
  }

  async onEnd(result) {
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

    // ---- Integration hooks (implement as needed) ----
    // await this.postToSlack(summary);
    // await this.createJiraTickets(summary.failures);
    // await this.postToTeams(summary);
    // await this.updateDashboard(summary);
  }

  // --- Slack integration template ---
  // async postToSlack(summary) {
  //   const webhook = process.env.SLACK_WEBHOOK_URL;
  //   if (!webhook) return;
  //   const color = summary.status === 'passed' ? '#36a64f' : '#ff0000';
  //   const payload = {
  //     attachments: [{
  //       color,
  //       title: `Test Run: ${summary.status.toUpperCase()}`,
  //       fields: [
  //         { title: 'Environment', value: summary.environment, short: true },
  //         { title: 'Pass Rate', value: `${summary.passRate}%`, short: true },
  //         { title: 'Duration', value: `${summary.duration}s`, short: true },
  //         { title: 'Failed', value: `${summary.counts.failed}`, short: true },
  //       ],
  //     }],
  //   };
  //   await fetch(webhook, { method: 'POST', body: JSON.stringify(payload) });
  // }
}

export default CustomReporter;
```

---

## Phase 10: Playwright Configuration

### Step 27: Create the main config

Replace `playwright.config.js` with:

```js
import { defineConfig, devices } from '@playwright/test';
import { getEnvConfig } from './src/config/environments.js';
import dotenv from 'dotenv';

// Load environment-specific .env file
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
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ['./src/reporters/CustomReporter.js'],
  ],

  use: {
    baseURL: env.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // Uncomment when global-setup login flow is configured for your app
  // globalSetup: './scripts/global-setup.js',
  // globalTeardown: './scripts/global-teardown.js',

  projects: [
    // --- Test suites ---
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

    // --- Cross-browser ---
    {
      name: 'firefox',
      testMatch: 'tests/smoke/**/*.spec.js',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: 'tests/smoke/**/*.spec.js',
      use: { ...devices['Desktop Safari'] },
    },

    // --- Mobile ---
    {
      name: 'mobile-chrome',
      testMatch: 'tests/smoke/**/*.spec.js',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      testMatch: 'tests/smoke/**/*.spec.js',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
```

---

## Phase 11: Write Tests Using the Framework (Project-Specific Examples)

> **These tests live in each consuming project, not the framework core.** They show how to use the framework's fixtures (`log`, `apiClient`, `a11y`, `visual`, `networkInterceptor`) alongside the project's own page object fixtures.

### Step 28: Write a smoke test (with logging)

Create `tests/smoke/homepage.spec.js`:

```js
import { test, expect } from '../../src/fixtures/index.js';

test.describe('Homepage', () => {

  test('should load successfully', async ({ page, log }) => {
    log.step('Navigate to homepage');
    await page.goto('/');

    log.step('Verify page has a title');
    await expect(page).toHaveTitle(/.+/);

    log.step('Verify body is visible');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display main navigation', async ({ page, header, log }) => {
    log.step('Navigate to homepage');
    await page.goto('/');

    log.step('Verify navigation is visible');
    await expect(header.navLinks).toBeVisible();
  });

});
```

### Step 29: Write a login test (with logging)

Create `tests/e2e/login.spec.js`:

```js
import { test, expect } from '../../src/fixtures/index.js';
import { CREDENTIALS } from '../../src/config/constants.js';

test.describe('Login', () => {

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('should login with valid credentials', async ({ loginPage, page, log }) => {
    log.step('Login with admin credentials');
    await loginPage.login(CREDENTIALS.ADMIN.username, CREDENTIALS.ADMIN.password);

    log.step('Verify redirect to dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should show error for invalid credentials', async ({ loginPage, log }) => {
    log.step('Login with invalid credentials');
    await loginPage.login('wrong_user', 'wrong_pass');

    log.step('Verify error message is displayed');
    await expect(loginPage.errorMessage).toBeVisible();
  });

});
```

### Step 30: Write an API test (with request logging)

Create `tests/api/health.spec.js`:

```js
import { test, expect } from '../../src/fixtures/index.js';

test.describe('API Health', () => {

  test('health endpoint should return 200', async ({ apiClient, log }) => {
    log.step('Call health endpoint');
    const response = await apiClient.get('/health');

    log.step('Verify status 200');
    expect(response.status).toBe(200);
  });

});
```

### Step 31: Write an accessibility test

Create `tests/accessibility/homepage-a11y.spec.js`:

```js
import { test, expect } from '../../src/fixtures/index.js';

test.describe('Homepage Accessibility', () => {

  test('should have no WCAG 2.1 AA violations', async ({ page, a11y, log }) => {
    log.step('Navigate to homepage');
    await page.goto('/');

    log.step('Run accessibility scan (WCAG 2.1 AA)');
    await a11y.assertNoViolations({
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
    });
  });

  test('should have accessible navigation', async ({ page, a11y, log }) => {
    log.step('Navigate to homepage');
    await page.goto('/');

    log.step('Scan navigation for a11y violations');
    const violations = await a11y.scan({ include: 'nav' });

    log.step('Verify no critical violations in nav');
    const critical = violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

});
```

### Step 32: Write a visual regression test

Create `tests/visual/homepage-visual.spec.js`:

```js
import { test, expect } from '../../src/fixtures/index.js';

test.describe('Homepage Visual Regression', () => {

  test('should match full-page baseline', async ({ page, visual, log }) => {
    log.step('Navigate to homepage');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    log.step('Compare against baseline screenshot');
    await visual.compareFullPage('homepage');
  });

  test('should match across viewports', async ({ page, visual, log }) => {
    log.step('Navigate to homepage');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    log.step('Compare responsive screenshots');
    await visual.compareResponsive('homepage-responsive');
  });

});
```

### Step 33: Write a test with network monitoring

Create `tests/e2e/dashboard.spec.js`:

```js
import { test, expect } from '../../src/fixtures/index.js';

test.describe('Dashboard', () => {

  test('should load without failed network requests', async ({ page, networkInterceptor, log }) => {
    log.step('Navigate to dashboard');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    log.step('Check for failed network requests');
    const failed = networkInterceptor.getFailedRequests();
    expect(failed).toHaveLength(0);

    log.step('Verify page loaded');
    await expect(page.locator('body')).toBeVisible();
  });

});
```

### Step 34: Write a data-driven test

Create `test-data/fixtures/users.json`:

```json
[
  { "role": "admin",   "username": "admin",  "password": "admin123",  "canAccessSettings": true  },
  { "role": "editor",  "username": "editor", "password": "editor123", "canAccessSettings": false },
  { "role": "viewer",  "username": "viewer", "password": "viewer123", "canAccessSettings": false }
]
```

Create `tests/regression/role-access.spec.js`:

```js
import { test, expect } from '../../src/fixtures/index.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const users = require('../../test-data/fixtures/users.json');

for (const user of users) {
  test(`${user.role} role — settings access should be ${user.canAccessSettings}`, async ({ page, log }) => {
    log.step(`Login as ${user.role}`);
    await page.goto('/login');
    await page.getByLabel('Username').fill(user.username);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard');

    log.step('Navigate to settings');
    await page.goto('/settings');

    log.step(`Verify access is ${user.canAccessSettings ? 'granted' : 'denied'}`);
    if (user.canAccessSettings) {
      await expect(page).toHaveURL(/settings/);
    } else {
      await expect(page).toHaveURL(/forbidden|dashboard/);
    }
  });
}
```

---

## Phase 12: CI/CD Pipeline

### Step 35: Create GitHub Actions workflow

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
        description: 'Test project to run'
        required: true
        default: 'smoke'
        type: choice
        options: [smoke, regression, e2e, api, accessibility, visual]

env:
  TEST_ENV: ${{ github.event.inputs.environment || 'dev' }}

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run tests
        run: npx playwright test --shard=${{ matrix.shard }} --project=${{ github.event.inputs.project || 'smoke' }}
        env:
          ADMIN_USERNAME: ${{ secrets.ADMIN_USERNAME }}
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
          LOG_LEVEL: info

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ strategy.job-index }}
          path: |
            test-results/
            playwright-report/
            logs/
          retention-days: 14

  report:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Download all results
        uses: actions/download-artifact@v4
        with:
          path: all-results/

      - name: Merge reports
        run: npx playwright merge-reports --reporter=html ./all-results

      - name: Publish report
        uses: actions/upload-artifact@v4
        with:
          name: full-playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Phase 13: Publish as Shared npm Package

### Step 36: Prepare the shared library for publishing

This is what makes the framework usable **across multiple projects and teams**. Notice: it ships only `BasePage` — no app-specific page objects.

Create a separate repo: `@yourorg/playwright-core`

Its `package.json`:

```json
{
  "name": "@yourorg/playwright-core",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "exports": {
    ".":            "./src/index.js",
    "./fixtures":   "./src/fixtures/index.js",
    "./pages":      "./src/pages/index.js",
    "./utils":      "./src/utils/index.js",
    "./helpers":    "./src/helpers/index.js",
    "./logging":    "./src/logging/index.js",
    "./config":     "./src/config/environments.js",
    "./constants":  "./src/config/constants.js"
  },
  "peerDependencies": {
    "@playwright/test": ">=1.40.0"
  },
  "dependencies": {
    "@axe-core/playwright": "^4.0.0",
    "@faker-js/faker": "^9.0.0",
    "dotenv": "^16.0.0",
    "winston": "^3.0.0"
  }
}
```

Create `src/index.js`:

```js
// Framework core — NO app-specific page objects
export { test, expect } from './fixtures/index.js';
export { BasePage } from './pages/index.js';
export * from './utils/index.js';
export * from './helpers/index.js';
export { createLogger, getLogger, TestLogger } from './logging/index.js';
export { getEnvConfig } from './config/environments.js';
export { TIMEOUTS, TEST_TAGS, CREDENTIALS } from './config/constants.js';
```

### Step 37: Publish to your internal registry

```bash
npm publish --registry=https://npm.yourorg.com
```

### Step 38: Consume the library in any project

In any project across the organization:

```bash
npm install @yourorg/playwright-core
```

**Step A — Create your project's page objects (extending BasePage):**

```js
// pages/CheckoutPage.js — specific to THIS project
import { BasePage } from '@yourorg/playwright-core/pages';

export class CheckoutPage extends BasePage {
  constructor(page, testInfo) {
    super(page, testInfo);
    this.cartItems = page.getByTestId('cart-item');
    this.totalPrice = page.getByTestId('total-price');
    this.checkoutButton = page.getByRole('button', { name: /checkout/i });
    this.confirmButton = page.getByRole('button', { name: /confirm order/i });
  }

  async goto() { await this.navigate('/checkout'); }

  async getItemCount() { return await this.getElementCount(this.cartItems); }

  async getTotal() { return await this.getTextContent(this.totalPrice); }

  async confirmOrder() {
    this.logger.step('Confirming order');
    await this.click(this.confirmButton, 'confirm order');
  }
}
```

**Step B — Create your project's extended fixtures:**

```js
// fixtures/index.js — in your project
import { test as baseTest, expect } from '@yourorg/playwright-core/fixtures';
import { CheckoutPage } from '../pages/CheckoutPage.js';
import { LoginPage } from '../pages/LoginPage.js';

export const test = baseTest.extend({
  loginPage: async ({ page }, use, testInfo) => {
    await use(new LoginPage(page, testInfo));
  },
  checkoutPage: async ({ page }, use, testInfo) => {
    await use(new CheckoutPage(page, testInfo));
  },
});

export { expect };
```

**Step C — Write tests using both layers:**

```js
// tests/checkout.spec.js
import { test, expect } from '../fixtures/index.js';

test('user can complete checkout', async ({ loginPage, checkoutPage, apiClient, testData, log }) => {
  log.step('Create a test product via API');
  const product = testData.createProduct();
  await apiClient.post('/products', product);

  log.step('Login and navigate to checkout');
  await loginPage.goto();
  await loginPage.login('admin', 'admin123');
  await checkoutPage.goto();

  log.step('Confirm order');
  await checkoutPage.confirmOrder();
  await expect(checkoutPage.page).toHaveURL(/order-confirmation/);
});
```

---

## Phase 14: Conventions and Standards

### Step 39: Establish team conventions

Create a `CONVENTIONS.md` at the project root:

```
## Test Writing Conventions

1.  File naming:      `<feature>.spec.js`
2.  Describe blocks:  Group by feature — `test.describe('Checkout', ...)`
3.  Test names:       Start with "should" — `test('should add item to cart', ...)`
4.  Selectors:        Prefer `getByRole`, `getByLabel`, `getByTestId` — never raw CSS selectors
5.  Assertions:       Use web-first assertions (`toBeVisible`, `toHaveText`) — they auto-wait
6.  No hardcoded waits: Never use `page.waitForTimeout()` — use locators and assertions instead
7.  Test independence: Each test must work in isolation — no order dependency
8.  Test data:        Use TestDataFactory for dynamic data — never share data between tests
9.  Page objects:     All selectors live in page objects, not in spec files
10. One assertion focus: Each test should verify one behavior (multiple assertions are fine)
11. Logging:          Use the `log` fixture in every test — call `log.step()` for major actions
12. Accessibility:    Every new page must have an a11y test in tests/accessibility/
13. Visual baselines: Update visual snapshots intentionally, never auto-accept
```

### Step 40: Add linting

Create `eslint.config.js`:

```js
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.spec.js'],
    rules: {
      'no-empty-pattern': 'off', // Playwright fixtures use destructuring
    },
  },
];
```

---

## Running the Framework

```bash
# Run all smoke tests
npm run test:smoke

# Run against staging
TEST_ENV=staging npm run test:smoke

# Run a specific test file
npx playwright test tests/smoke/homepage.spec.js

# Run accessibility tests
npm run test:a11y

# Run visual regression tests
npm run test:visual

# Update visual baselines (after intentional UI changes)
npx playwright test --project=visual --update-snapshots

# Run in headed mode (see the browser)
npm run test:headed

# Run with Playwright UI mode (interactive)
npm run test:ui

# Run with debug mode (step through)
npm run test:debug

# Run with verbose logging
LOG_LEVEL=debug npm run test:smoke

# Generate and view report
npm run report

# Run cross-browser
npx playwright test --project=firefox

# Run with sharding (CI)
npx playwright test --shard=1/4

# Clean all output
npm run clean
```

---

## Summary — What You Built

### Framework Core (`@yourorg/playwright-core` — shared across ALL projects)

| Layer | What | Why |
|-------|------|-----|
| `src/logging/` | **Winston-based structured logger** | Leveled, per-test, file-output logging — diagnose failures without re-running |
| `src/config/` | Environment + constants | Run same tests against dev/staging/prod |
| `src/pages/BasePage.js` | **Generic BasePage only** (no app-specific selectors) | Every project extends this — navigate, click, fill, screenshot, iframe, keyboard |
| `src/fixtures/` | **App-agnostic fixtures** (log, apiClient, a11y, visual, etc.) | Every project inherits these; each project adds its own page object fixtures |
| `src/utils/` | ApiClient, TestDataFactory, WaitHelper, NetworkInterceptor | Reusable helpers with request/response logging |
| `src/helpers/` | **AccessibilityHelper, VisualHelper** | axe-core a11y scans + Playwright visual regression |
| `src/reporters/` | Production reporter with JSON output | Machine-readable results + Slack/Jira integration hooks |

### Each Consuming Project (e.g., ecommerce-app, admin-portal)

| Layer | What | Why |
|-------|------|-----|
| `pages/` | **App-specific page objects** (LoginPage, CheckoutPage, etc.) | Extend BasePage with selectors for THIS app |
| `fixtures/index.js` | **Extended fixtures** adding project page objects | Merges framework + project fixtures into one `test` object |
| `tests/` | Organized by suite type (smoke / regression / e2e / api / a11y / visual) | Tests use both framework fixtures and project fixtures |
| `scripts/` | Global setup/teardown | Login once, share session, screenshot on setup failure |
| `.github/` | CI pipeline with sharding | Fast parallel runs, log artifact collection |

## What Makes This Production-Grade

| Concern | How it's addressed |
|---------|-------------------|
| **Logging** | Winston with per-test context, debug/info/warn/error levels, file rotation, error-only log |
| **Observability** | Network interceptor catches failed requests, API client logs every request with timing |
| **Accessibility** | axe-core integration with WCAG 2.1 AA checks, results attached to test reports |
| **Visual regression** | Built-in screenshot comparison, responsive viewport testing, explicit baseline management |
| **Failure diagnosis** | Structured logs + traces + screenshots + videos retained on failure |
| **CI/CD** | Sharded parallel runs, artifact collection including logs, environment-aware |
| **Reporting** | JSON summary for dashboards, Slack/Jira hooks ready to implement |
| **Test data isolation** | Faker-based dynamic data factory — no shared state between tests |
| **Multi-environment** | `.env` per environment, config resolution with validation |
| **Team scalability** | Publishable npm package, conventions doc, ESLint enforcement |
