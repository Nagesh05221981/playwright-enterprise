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
