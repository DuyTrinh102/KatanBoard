/**
 * Một tab ghi state cho một ván (architecture §10).
 * Dùng Web Locks API: tab giữ lock tới khi release; tab thứ hai không lấy được → chỉ đọc.
 */
export interface TabLock {
  readonly acquired: boolean;
  release(): void;
}

export async function acquireGameLock(gameId: string): Promise<TabLock> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks) {
    // Không có Web Locks: không thể bảo đảm — cho phép nhưng ghi cảnh báo.
    console.warn('Web Locks API không khả dụng; không chặn được tab thứ hai.');
    return { acquired: true, release: () => undefined };
  }
  return new Promise<TabLock>((resolve) => {
    let releaseFn: () => void = () => undefined;
    const held = new Promise<void>((r) => (releaseFn = r));
    void locks.request(`katanboard:catan-ck:${gameId}`, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        resolve({ acquired: false, release: () => undefined });
        return;
      }
      resolve({ acquired: true, release: () => releaseFn() });
      await held;
    });
  });
}
