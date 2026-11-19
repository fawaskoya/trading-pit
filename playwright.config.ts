import { defineConfig, devices } from "@playwright/test";

// Port 3000 is often taken by another project; `E2E_PORT=3210 pnpm test:e2e` runs the app elsewhere.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Runs against a production build by default (fast, and what Vercel serves). Set E2E_DEV=1 to use `pnpm dev`.
  webServer: {
    command: process.env.E2E_DEV ? `pnpm dev --port ${port}` : `pnpm build && pnpm start --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
