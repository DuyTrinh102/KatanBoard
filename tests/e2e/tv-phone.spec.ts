import { expect, test, type Browser, type Page } from '@playwright/test';

async function phone(browser: Browser, url: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url);
  await expect(page.getByTestId('phone-screen')).toBeVisible();
  return page;
}

test('TV + điện thoại: quét QR, đặt quân trên điện thoại, TV cập nhật realtime, bài riêng không lên TV', async ({ page: tv, browser }) => {
  await tv.goto('/');
  await tv.getByTestId('mode-tv').click();
  await tv.getByTestId('new-game').click();
  await tv.getByTestId('count-3').click();
  await tv.getByTestId('start-game').click();
  await expect(tv.getByTestId('tv-screen')).toBeVisible();
  await expect(tv).toHaveURL(/\/tv\//);

  const urls: Record<string, string> = {};
  for (const p of ['p1', 'p2', 'p3']) urls[p] = (await tv.getByTestId(`qr-${p}`).getAttribute('data-url'))!;
  expect(urls.p1).toMatch(/\/play\/.+\?t=[0-9a-f]{32}$/);
  await tv.screenshot({ path: 'test-results/tv-qr.png' });

  const phones: Record<string, Page> = {};
  // Link QR trỏ tới IP LAN của máy chủ. Trong sandbox test, proxy chặn IP đó nên đổi về localhost
  // (cùng máy chủ, cùng cổng) — trên mạng quán thật, điện thoại mở thẳng IP LAN.
  for (const p of ['p1', 'p2', 'p3']) {
    const u = new URL(urls[p]!);
    u.hostname = 'localhost';
    phones[p] = await phone(browser, u.toString());
  }

  // Mọi ghế đã kết nối → TV tự ẩn mã QR.
  await expect(tv.getByTestId('qr-overlay')).toHaveCount(0);

  // Đặt quân khởi đầu: 3 người × 2 vòng × (công trình + đường).
  const order = ['p1', 'p2', 'p3', 'p3', 'p2', 'p1'];
  let placed = 0;
  for (const p of order) {
    const ph = phones[p]!;
    for (const kind of ['v', 'e'] as const) {
      await ph.getByTestId(`${kind}-target`).first().click();
      await ph.getByTestId('phone-confirm').click();
      if (kind === 'v') {
        placed++;
        await expect(tv.locator('svg.board .road')).toHaveCount(placed - 1);
      }
    }
    // TV thấy đường vừa đặt ngay (realtime).
    await expect(tv.locator('svg.board .road')).toHaveCount(placed);
  }

  await expect(phones.p1!.getByTestId('phone-status')).toContainText('tung xúc xắc');
  await phones.p1!.getByTestId('phone-roll').click();
  await expect(tv.getByTestId('tv-dice')).toBeVisible();

  // Bài riêng: có trên điện thoại, không có trên TV.
  await expect(phones.p1!.getByTestId('private-hand')).toBeVisible();
  await expect(tv.getByTestId('private-hand')).toHaveCount(0);
  // Người không trong lượt không có nút tung/kết thúc lượt.
  await expect(phones.p2!.getByTestId('phone-roll')).toHaveCount(0);
  await expect(phones.p2!.getByTestId('phone-end-turn')).toHaveCount(0);

  await tv.screenshot({ path: 'test-results/tv-playing.png' });
  await phones.p1!.screenshot({ path: 'test-results/phone-p1.png' });

  // Điện thoại tải lại trang (mất kết nối) → vào lại đúng ghế, đúng state.
  await phones.p2!.reload();
  await expect(phones.p2!.getByTestId('phone-status')).toContainText('Lượt của');
});

test('mã ghế sai → báo lỗi, không vào được ván', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/play/khong-co-van?t=abc');
  await expect(page.getByText('Không vào được ghế')).toBeVisible();
});
