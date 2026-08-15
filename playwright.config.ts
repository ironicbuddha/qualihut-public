import { defineConfig } from "@playwright/test"

const hostedBaseUrl = process.env.PUBLIC_SITE_BASE_URL
const localBaseUrl = "http://127.0.0.1:4371"

export default defineConfig({
  testDir: "tests/browser",
  outputDir: "output/playwright/test-results",
  reporter: [["list"]],
  use: {
    baseURL: hostedBaseUrl ?? localBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: hostedBaseUrl
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4371",
        url: localBaseUrl,
        reuseExistingServer: false,
      },
})
