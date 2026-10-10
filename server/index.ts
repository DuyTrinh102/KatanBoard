/**
 * Máy chủ cục bộ cho chế độ TV + điện thoại.
 * - Phục vụ bản build tĩnh (dist/) và WebSocket /ws trên cùng một cổng.
 * - Chạy trong mạng LAN của quán; không cần Internet.
 *   PORT (mặc định 8787), DATA_DIR (mặc định ./data), STATIC_DIR (mặc định ./dist).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, type WebSocket } from 'ws';
import { GameHub, type Conn } from '../src/remote/hub';
import { WS_PATH, type ClientMsg } from '../src/remote/protocol';
import { FileGameStore, FileSeatStore } from './fileStore';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data/catan-ck');
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

export function lanHosts(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(STATIC_DIR, path);
    if (!file.startsWith(STATIC_DIR)) {
      res.writeHead(403).end();
      return;
    }
    const isFile = await stat(file).then((s) => s.isFile()).catch(() => false);
    if (!isFile) {
      // SPA: /tv/<id>, /play/<id> … trả index.html
      path = '/index.html';
      file = join(STATIC_DIR, path);
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': path === '/index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Chưa có bản build — chạy "npm run build" trước.');
  }
});

const hub = new GameHub(new FileGameStore(DATA_DIR), new FileSeatStore(DATA_DIR), { lanHosts });
const wss = new WebSocketServer({ server, path: WS_PATH, maxPayload: 64 * 1024 });

wss.on('connection', (ws: WebSocket) => {
  const conn: Conn = {
    role: 'lobby',
    send: (msg) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
  };
  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw)) as ClientMsg;
    } catch {
      conn.send({ t: 'error', message: 'Tin nhắn không hợp lệ' });
      return;
    }
    void hub.handle(conn, msg);
  });
  ws.on('close', () => hub.disconnect(conn));
  // Giữ kết nối qua Wi-Fi quán (ping mỗi 20 s).
  const ping = setInterval(() => ws.readyState === ws.OPEN && ws.ping(), 20_000);
  ws.on('close', () => clearInterval(ping));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`KatanBoard server: http://localhost:${PORT}`);
  for (const h of lanHosts()) console.log(`  Mạng LAN: http://${h}:${PORT}  (mở trên TV, điện thoại quét QR)`);
  console.log(`  Dữ liệu ván: ${DATA_DIR}`);
});
