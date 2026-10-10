import { expect, test } from '@playwright/test';

// Mô phỏng mở qua http://<IP-LAN> (iPad trong mạng quán): không có crypto.randomUUID và Web Locks.
test('không secure context: vẫn hiện bàn chơi và chơi được', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined, configurable: true });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe('undefined');
  await page.getByTestId('new-game').click();
  await page.getByTestId('start-game').click();
  await expect(page.locator('svg.board')).toBeVisible();
  await page.getByTestId('v-target').first().click();
  await page.getByTestId('confirm').click();
  await expect(page.getByTestId('e-target').first()).toBeVisible();
  expect(errors).toEqual([]);
});

/** Sân khấu phải hiện ĐỦ (không bị co rồi cắt): cả 4 khay nằm trong màn hình, board không bị cắt. */
async function expectFullStage(page: import('@playwright/test').Page, size: { width: number; height: number }) {
  const scale = Math.min(size.width / 1920, size.height / 1080);
  const stage = (await page.locator('.stage').boundingBox())!;
  expect(Math.abs(stage.width - 1920 * scale)).toBeLessThan(2);
  expect(Math.abs(stage.height - 1080 * scale)).toBeLessThan(2);
  for (const p of ['p1', 'p2', 'p3', 'p4']) {
    const b = (await page.getByTestId(`tray-${p}`).boundingBox())!;
    expect(b.x, p).toBeGreaterThanOrEqual(-1);
    expect(b.y, p).toBeGreaterThanOrEqual(-1);
    expect(b.x + b.width, p).toBeLessThanOrEqual(size.width + 1);
    expect(b.y + b.height, p).toBeLessThanOrEqual(size.height + 1);
  }
  // Điểm giữa cạnh phải của board phải thực sự là board (không bị khung cha cắt).
  const board = (await page.locator('svg.board').boundingBox())!;
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('svg.board') !== null, [board.x + board.width * 0.8, board.y + board.height / 2]);
  expect(hit).toBe(true);
}

test('khổ iPad dọc và ngang: hiện đủ sân khấu, không bị cắt', async ({ page }) => {
  for (const size of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.getByTestId('new-game').click();
    await page.getByTestId('start-game').click();
    await expectFullStage(page, size);
  }
});

test('iPadOS < 15.4 (không có structuredClone): vẫn đặt quân được, không lỗi', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error mô phỏng Safari cũ
    delete globalThis.structuredClone;
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.getByTestId('new-game').click();
  await page.getByTestId('start-game').click();
  await page.getByTestId('v-target').first().click();
  await page.getByTestId('confirm').click();
  await page.getByTestId('e-target').first().click();
  await page.getByTestId('confirm').click();
  await expect(page.getByTestId('error-strip')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('khổ iPad ngang (cảm ứng, mobile UA): ảnh chụp + thông tin thiết bị', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByTestId('device-info').tap();
  await expect(page.locator('.diag')).toContainText('Phiên bản app');
  await page.getByTestId('new-game').tap();
  await page.getByTestId('start-game').tap();
  await expect(page.locator('svg.board')).toBeVisible();
  await expectFullStage(page, { width: 1180, height: 820 });
  await page.screenshot({ path: 'test-results/ipad-landscape.png' });
  await ctx.close();
});
