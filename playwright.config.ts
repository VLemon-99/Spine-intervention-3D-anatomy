import { defineConfig } from '@playwright/test';

// Screen tests. Every test runs twice: once in the 'desktop' set-up and once in
// the 'tablet' set-up (touch only). Chromium for Playwright 1.63.0 is
// pre-installed in cloud sessions — never run 'playwright install'.

// Headless Chromium has no real GPU here, so WebGL2 runs on SwiftShader
// (a software GPU). These flags make sure it is allowed and used.
const webglLaunchArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    trace: 'off',
    launchOptions: { args: webglLaunchArgs },
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false },
    },
    {
      name: 'tablet',
      use: { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
