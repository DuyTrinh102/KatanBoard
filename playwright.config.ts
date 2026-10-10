import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Môi trường cloud có Chromium cài sẵn ở /opt/pw-browsers; máy khác dùng trình duyệt Playwright mặc định.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath = existsSync(preinstalled) ? preinstalled : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1920, height: 1080 },
    hasTouch: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, hasTouch: true } }],
  // Máy chủ cục bộ thật (phục vụ dist + WebSocket) với thư mục dữ liệu riêng cho test.
  webServer: {
    command: 'rm -rf .e2e-data && npm run build && DATA_DIR=.e2e-data PORT=4173 npm run server',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
