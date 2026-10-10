import type { CommandBody } from '../games/catan-ck/engine/commands';
import { newId } from '../shared/id';
import { WS_PATH, type ClientMsg, type ServerMsg } from './protocol';

export type ConnStatus = 'connecting' | 'open' | 'closed';

/**
 * Kết nối WebSocket tới máy chủ cục bộ, tự kết nối lại (Wi-Fi quán chập chờn, điện thoại khóa màn hình).
 * - Sau khi kết nối lại: gửi lại lời chào (hello) để nhận state mới nhất.
 * - Lệnh chưa có ack được gửi lại với CÙNG commandId → máy chủ bỏ qua nếu đã xử lý (không làm 2 lần).
 */
export class RemoteConnection {
  private ws: WebSocket | null = null;
  private hello: ClientMsg | null = null;
  private retry = 0;
  private closedByUser = false;
  private pending = new Map<string, { msg: ClientMsg; resolve: (r: { ok: boolean; reason?: string }) => void }>();
  private msgListeners = new Set<(m: ServerMsg) => void>();
  private statusListeners = new Set<(s: ConnStatus) => void>();
  status: ConnStatus = 'connecting';

  constructor(private readonly url: string = defaultUrl()) {
    this.open();
  }

  private setStatus(s: ConnStatus) {
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
  }

  private open() {
    this.setStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus('open');
      if (this.hello) this.raw(this.hello);
      for (const p of this.pending.values()) this.raw(p.msg);
    };
    ws.onmessage = (e) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(String(e.data)) as ServerMsg;
      } catch {
        return;
      }
      if (m.t === 'ack') {
        const p = this.pending.get(m.commandId);
        if (p) {
          this.pending.delete(m.commandId);
          p.resolve({ ok: m.ok, ...(m.reason ? { reason: m.reason } : {}) });
        }
      }
      this.msgListeners.forEach((l) => l(m));
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.closedByUser) return this.setStatus('closed');
      this.setStatus('connecting');
      const delay = Math.min(5000, 300 * 2 ** this.retry++);
      setTimeout(() => this.open(), delay);
    };
    ws.onerror = () => ws.close();
  }

  private raw(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Gửi một lần (list/create). */
  send(msg: ClientMsg) {
    if (msg.t === 'hello-tv' || msg.t === 'hello-player') this.hello = msg;
    if (this.ws?.readyState === WebSocket.OPEN) this.raw(msg);
    else if (msg.t !== 'hello-tv' && msg.t !== 'hello-player') {
      const once = (s: ConnStatus) => {
        if (s === 'open') {
          this.statusListeners.delete(once);
          this.raw(msg);
        }
      };
      this.statusListeners.add(once);
    }
  }

  command(body: CommandBody, expectedRevision: number, commandId: string = newId()): Promise<{ ok: boolean; reason?: string }> {
    const msg: ClientMsg = { t: 'cmd', commandId, expectedRevision, body };
    return new Promise((resolve) => {
      this.pending.set(commandId, { msg, resolve });
      this.raw(msg);
    });
  }

  onMessage(fn: (m: ServerMsg) => void): () => void {
    this.msgListeners.add(fn);
    return () => this.msgListeners.delete(fn);
  }

  onStatus(fn: (s: ConnStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  close() {
    this.closedByUser = true;
    this.ws?.close();
  }
}

function defaultUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${WS_PATH}`;
}
