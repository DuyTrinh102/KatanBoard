import { expect, test, type Page } from '@playwright/test';

async function confirmTarget(page: Page, kind: 'v' | 'e' | 'h') {
  const target = page.getByTestId(`${kind}-target`).first();
  await target.click();
  await page.getByTestId('confirm').click();
}

async function finishSetup(page: Page, players: number) {
  for (let i = 0; i < players * 2; i++) {
    await confirmTarget(page, 'v');
    await confirmTarget(page, 'e');
  }
}

for (const n of [3, 4] as const) {
  test(`tạo ván ${n} người, đặt quân, tung xúc xắc, reload giữ nguyên`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('new-game').click();
    await page.getByTestId(`count-${n}`).click();
    await page.getByTestId('start-game').click();
    await expect(page.getByTestId('ruleset-warning')).toBeVisible();

    await finishSetup(page, n);
    await expect(page.getByTestId('status-p1')).toContainText('tung xúc xắc');

    // Người không trong lượt không có nút tung.
    await expect(page.getByTestId('tray-p2').getByTestId('roll')).toHaveCount(0);

    await page.getByTestId('roll').click();
    const dice = (await page.getByTestId('dice').textContent())!;

    // Dữ liệu riêng không có trong DOM khi khay úp.
    await expect(page.getByTestId('private-hand')).toHaveCount(0);

    // Xử lý 7 nếu có (robber chưa hoạt động → chỉ bỏ bài nếu ai quá 7 lá; đầu ván thì không).
    await page.screenshot({ path: `test-results/table-${n}.png` });

    // Reload: quay lại đúng state, không tung lại.
    await page.reload();
    const resume = page.locator('[data-testid^="resume-"]').first();
    await resume.click();
    await expect(page.getByTestId('dice')).toHaveText(dice);
  });
}

test('giữ để xem bài: hiện khi giữ, che khi thả; chỉ một người xem cùng lúc', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-game').click();
  await page.getByTestId('count-3').click();
  await page.getByTestId('start-game').click();
  await finishSetup(page, 3);

  const hold = page.getByTestId('hold-p1');
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('private-hand')).toHaveCount(1);
  await expect(page.getByTestId('hold-p2')).toContainText('đang xem bài');
  await page.mouse.up();
  await expect(page.getByTestId('private-hand')).toHaveCount(0);
});
