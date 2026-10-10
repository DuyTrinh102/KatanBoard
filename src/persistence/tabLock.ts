/**
 * Một tab ghi state cho một ván (architecture §10).
 * - Ưu tiên Web Locks API (chỉ có trong secure context: HTTPS/localhost).
 * - Khi mở qua http://<IP-LAN> (ví dụ iPad trong mạng quán) không có Web Locks → dùng BroadcastChannel:
 *   hỏi "ai đang giữ ván này?", có tab trả lời trong thời gian chờ thì tab mới chỉ được xem.
 */
export interface TabLock {
  readonly acquired: boolean;
  /** Cơ chế đang dùng — hiển thị cho nhân viên khi cần. */
  readonly mechanism: 'web-locks' | 'broadcast-channel' | 'none';
  release(): void;
}

const NAME = (gameId: string) => `katanboard:catan-ck:${gameId}`;

async function viaWebLocks(locks: LockManager, gameId: string): Promise<TabLock> {
  return new Promise<TabLock>((resolve) => {
    let releaseFn: () => void = () => undefined;
    const held = new Promise<void>((r) => (releaseFn = r));
    void locks.request(NAME(gameId), { ifAvailable: true }, async (lock) => {
      if (!lock) {
        resolve({ acquired: false, mechanism: 'web-locks', release: () => undefined });
        return;
      }
      resolve({ acquired: true, mechanism: 'web-locks', release: () => releaseFn() });
      await held;
    });
  });
}

async function viaBroadcast(gameId: string, waitMs: number): Promise<TabLock> {
  const ch = new BroadcastChannel(NAME(gameId));
  const owned = await new Promise<boolean>((resolve) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data === 'held') {
        ch.removeEventListener('message', onMsg);
        resolve(false);
      }
    };
    ch.addEventListener('message', onMsg);
    ch.postMessage('who');
    setTimeout(() => {
      ch.removeEventListener('message', onMsg);
      resolve(true);
    }, waitMs);
  });
  if (!owned) {
    ch.close();
    return { acquired: false, mechanism: 'broadcast-channel', release: () => undefined };
  }
  const answer = (e: MessageEvent) => e.data === 'who' && ch.postMessage('held');
  ch.addEventListener('message', answer);
  return {
    acquired: true,
    mechanism: 'broadcast-channel',
    release: () => {
      ch.removeEventListener('message', answer);
      ch.close();
    },
  };
}

export async function acquireGameLock(gameId: string, broadcastWaitMs = 250): Promise<TabLock> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (locks && typeof locks.request === 'function') return viaWebLocks(locks, gameId);
  if (typeof BroadcastChannel === 'function') return viaBroadcast(gameId, broadcastWaitMs);
  console.warn('Không có Web Locks lẫn BroadcastChannel; không chặn được tab thứ hai.');
  return { acquired: true, mechanism: 'none', release: () => undefined };
}
