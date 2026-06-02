import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3115",
    channel: "chrome",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node ./scripts/testing/start-playwright-server.mjs",
    url: "http://127.0.0.1:3115",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
