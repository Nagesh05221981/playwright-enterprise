# Building a Playwright Project from Scratch

## Step 1 — Prerequisites

Make sure you have **Node.js** installed (v18 or later):

```bash
node -v      # should print v18+
npm -v       # should print 9+
```

---

## Step 2 — Create a New Project Folder

```bash
mkdir my-playwright-project
cd my-playwright-project
```

---

## Step 3 — Initialize Playwright

This is the key command — it scaffolds everything for you:

```bash
npm init playwright@latest
```

It will prompt you with questions:

| Prompt | Recommended Answer |
|---|---|
| Do you want to use TypeScript or JavaScript? | **JavaScript** (or TypeScript if you prefer) |
| Where to put your end-to-end tests? | **tests** |
| Add a GitHub Actions workflow? | **Yes** (creates `.github/workflows/playwright.yml`) |
| Install Playwright browsers? | **Yes** |

This creates:
```
my-playwright-project/
├── node_modules/
├── tests/
│   └── example.spec.js       ← sample test
├── tests-examples/
│   └── demo-todo-app.spec.js ← full demo test
├── playwright.config.js       ← configuration
├── package.json
└── package-lock.json
```

---

## Step 4 — Install Browsers

If you skipped browser install during init, run:

```bash
npx playwright install
```

This downloads Chromium, Firefox, and WebKit binaries.

---

## Step 5 — Understand the Config (`playwright.config.js`)

Key settings to know:

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',           // where tests live
  timeout: 30_000,              // max time per test (30s)
  fullyParallel: true,          // run tests in parallel
  retries: 0,                   // retry count (use 2 for CI)

  use: {
    baseURL: 'http://localhost:3000',  // your app's URL
    trace: 'on-first-retry',          // capture trace on retry
    screenshot: 'only-on-failure',    // screenshot on failure
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],

  // Optional: auto-start your app before tests
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
```

---

## Step 6 — Write Your First Test

Create `tests/my-first.spec.js`:

```js
import { test, expect } from '@playwright/test';

test('homepage has correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/My App/);
});

test('login button is visible', async ({ page }) => {
  await page.goto('/');
  const loginBtn = page.locator('button:has-text("Login")');
  await expect(loginBtn).toBeVisible();
});
```

---

## Step 7 — Run Tests

```bash
# Run all tests (headless)
npx playwright test

# Run in headed mode (see the browser)
npx playwright test --headed

# Run a specific file
npx playwright test tests/my-first.spec.js

# Run on one browser only
npx playwright test --project=chromium

# Run in debug mode (step-by-step)
npx playwright test --debug

# Run in UI mode (interactive dashboard)
npx playwright test --ui
```

---

## Step 8 — View Reports

After a test run:

```bash
npx playwright show-report
```

Opens an HTML report in your browser showing pass/fail, screenshots, and traces.

---

## Step 9 — Add Page Object Model (Optional but Recommended)

Organize reusable page interactions:

```
pages/
  └── LoginPage.js
tests/
  └── login.spec.js
```

**`pages/LoginPage.js`**:
```js
export class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('button[type="submit"]');
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
```

**`tests/login.spec.js`**:
```js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';

test('user can log in', async ({ page }) => {
  await page.goto('/login');
  const loginPage = new LoginPage(page);
  await loginPage.login('admin', 'password123');
  await expect(page).toHaveURL('/dashboard');
});
```

---

## Step 10 — Add Test Data with Fixtures (Optional)

Create `fixtures/users.json`:
```json
{
  "validUser": { "username": "admin", "password": "password123" },
  "invalidUser": { "username": "wrong", "password": "bad" }
}
```

Import in tests:
```js
import users from '../fixtures/users.json' assert { type: 'json' };
```

---

## Summary Cheat Sheet

| What | Command |
|---|---|
| Create project | `npm init playwright@latest` |
| Install browsers | `npx playwright install` |
| Run all tests | `npx playwright test` |
| Run headed | `npx playwright test --headed` |
| Run one file | `npx playwright test tests/file.spec.js` |
| Debug mode | `npx playwright test --debug` |
| UI mode | `npx playwright test --ui` |
| View report | `npx playwright show-report` |
| Code generator | `npx playwright codegen http://localhost:3000` |
