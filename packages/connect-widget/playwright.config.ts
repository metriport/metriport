import * as dotenv from "dotenv";
// somewhat what react-script does, tries to load .env.local, then .env
process.env.CI
  ? dotenv.config({ path: `.env.staging` }) // TODO still need to validate this approach when we enable tests on CI
  : dotenv.config({ path: `.env.${process.env.REACT_APP_ENV_TYPE}.local` }).parsed ??
    dotenv.config({ path: `.env.${process.env.REACT_APP_ENV_TYPE}` }).parsed ??
    dotenv.config({ path: `.env.local` }).parsed ??
    dotenv.config({ path: `.env` });
// Keep dotenv import and config before everything else
import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/__tests__",
  testMatch: /.*(e2e|spec|test).ts/,
  /* Run tests in files in parallel */
  fullyParallel: true,
  timeout: 10_000,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["html", { open: "never" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    // Test against mobile viewports.
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ..devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  // reuseExistingServer: !process.env.CI,
  // },
});
