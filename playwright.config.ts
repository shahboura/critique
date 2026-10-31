import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun run --cwd cli worker:dev --port 8787",
      url: "http://127.0.0.1:8787/a/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "bun run e2e/server.ts",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
})
