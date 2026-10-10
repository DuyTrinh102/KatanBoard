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

test('khổ iPad dọc và ngang: bàn chơi nằm trong màn hình', async ({ page }) => {
  for (const size of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.getByTestId('new-game').click();
    await page.getByTestId('start-game').click();
    const box = (await page.locator('svg.board').boundingBox())!;
    expect(box.width).toBeGreaterThan(100);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
  }
});
