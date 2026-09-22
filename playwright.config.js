import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/playwright",
  outputDir: "test-results",
  reporter: [["html", { open: "never" }]],
  use: {
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
  },
});
