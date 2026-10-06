// @ts-check
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
  reporter: process.env.CI
    ? [
        ['blob'],
        ['list'],
        ['junit', { outputFile: 'test-results/junit-results.xml' }],
        ['./src/reporters/CustomReporter.js'],
      ]
    : [
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
