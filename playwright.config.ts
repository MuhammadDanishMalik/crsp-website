import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://localhost:3011", viewport: { width: 1366, height: 768 } },
  webServer: {
    command: "rm -rf .data/e2e && PGLITE_DIR=.data/e2e/pglite npx next dev -p 3011",
    url: "http://localhost:3011/terminal", reuseExistingServer: false, stdout: "pipe", stderr: "pipe", timeout: 120_000,
  },
});
