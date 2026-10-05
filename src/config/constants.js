export const TIMEOUTS = {
    SHORT : 5_000,
    DEFAULT: 15_000,
    LONG: 30_000,
    NAVIGATION: 60_000,
    API: 10_000,

}
export const TEST_TAGS = {
  SANITY: '@sanity',
  SMOKE: '@smoke',
  REGRESSION: '@regression',
  E2E: '@e2e',
  API: '@api',
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
}