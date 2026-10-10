/**
 * Thu lỗi toàn cục và thông tin thiết bị để nhân viên chụp màn hình khi app hiển thị sai
 * (đặc biệt trên iPad/Safari, nơi không mở được DevTools dễ dàng).
 */
const errors: string[] = [];
const listeners = new Set<() => void>();

export function installErrorCollector(): void {
  const push = (msg: string) => {
    errors.push(`${new Date().toLocaleTimeString('vi-VN')} ${msg}`);
    if (errors.length > 8) errors.shift();
    listeners.forEach((l) => l());
  };
  window.addEventListener('error', (e) => push(`${e.message} @${(e.filename ?? '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => push(`Promise: ${String((e.reason as Error)?.message ?? e.reason)}`));
}

export function getErrors(): readonly string[] {
  return errors;
}

export function onErrorsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function deviceInfo(): [string, string][] {
  const vv = window.visualViewport;
  const has = (x: unknown) => (x ? 'có' : 'KHÔNG');
  return [
    ['Trình duyệt', navigator.userAgent],
    ['Màn hình', `${window.innerWidth}×${window.innerHeight} (visual ${Math.round(vv?.width ?? 0)}×${Math.round(vv?.height ?? 0)}), DPR ${window.devicePixelRatio}`],
    ['Secure context', has(window.isSecureContext)],
    ['structuredClone', has((globalThis as { structuredClone?: unknown }).structuredClone)],
    ['BroadcastChannel', has(typeof BroadcastChannel === 'function')],
    ['Web Locks', has(navigator.locks)],
    ['IndexedDB', has(window.indexedDB)],
    ['Điểm chạm', String(navigator.maxTouchPoints)],
  ];
}
