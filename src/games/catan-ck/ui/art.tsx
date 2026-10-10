/**
 * Minh hoạ tự vẽ bằng SVG (không dùng ảnh/asset chính thức).
 * Các sprite dùng chung đặt trong <BoardDefs/>, tham chiếu bằng <use href="#…">.
 */
import type { CardType, EventFace, Terrain } from '../rules';

/** Hash ổn định từ chuỗi → dùng để rải hoạ tiết cố định cho từng ô (không random runtime). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seeded(seed: number): () => number {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

export const TERRAIN_BASE: Record<Terrain, [string, string]> = {
  forest: ['#4f8a3c', '#24521f'],
  hills: ['#d8814f', '#9c4527'],
  pasture: ['#a9d46a', '#6d9e37'],
  fields: ['#f5d571', '#cf9f2e'],
  mountains: ['#a7a8ab', '#5f6166'],
  desert: ['#f0dfb0', '#cdb27a'],
};

export const TERRAIN_SPRITES: Record<Terrain, { ids: string[]; count: number; scale: [number, number] }> = {
  forest: { ids: ['tree', 'tree', 'tree2'], count: 12, scale: [0.95, 1.35] },
  hills: { ids: ['bricks', 'mound', 'bricks'], count: 9, scale: [0.95, 1.3] },
  pasture: { ids: ['tuft', 'sheep', 'tuft', 'sheep'], count: 11, scale: [0.95, 1.3] },
  fields: { ids: ['wheat', 'wheat', 'wheat'], count: 16, scale: [0.95, 1.3] },
  mountains: { ids: ['peak', 'peak', 'rock'], count: 8, scale: [0.85, 1.3] },
  desert: { ids: ['dune', 'dune', 'cactus'], count: 6, scale: [0.9, 1.2] },
};

export function BoardDefs() {
  return (
    <defs>
      {(Object.entries(TERRAIN_BASE) as [Terrain, [string, string]][]).map(([t, [a, b]]) => (
        <radialGradient key={t} id={`g-${t}`} cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </radialGradient>
      ))}
      <linearGradient id="g-sea" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#5db3e4" />
        <stop offset="55%" stopColor="#2f86c4" />
        <stop offset="100%" stopColor="#1f5f99" />
      </linearGradient>
      <pattern id="p-waves" width="46" height="22" patternUnits="userSpaceOnUse">
        <path d="M2 14 q 9 -8 18 0 t 18 0" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="2" strokeLinecap="round" />
        <path d="M-21 3 q 9 -6 18 0" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5" />
      </pattern>
      <linearGradient id="g-frame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7a4a26" />
        <stop offset="100%" stopColor="#4b2b14" />
      </linearGradient>
      <radialGradient id="g-token" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#fffaf0" />
        <stop offset="100%" stopColor="#e6d3a5" />
      </radialGradient>
      <radialGradient id="g-robber" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#9a9a9a" />
        <stop offset="100%" stopColor="#2c2c2c" />
      </radialGradient>
      <radialGradient id="g-hexshade" cx="50%" cy="45%" r="60%">
        <stop offset="60%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,.28)" />
      </radialGradient>
      <filter id="f-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" floodColor="#000" floodOpacity=".45" />
      </filter>
      <filter id="f-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#000" floodOpacity=".35" />
      </filter>

      {/* Sprites địa hình — gốc toạ độ ở chân hoạ tiết */}
      <g id="tree">
        <rect x="-1.5" y="-4" width="3" height="5" fill="#5b3a1e" />
        <path d="M0 -20 L7 -9 L3.5 -9 L9 -2 L-9 -2 L-3.5 -9 L-7 -9 Z" fill="#1e5a24" />
        <path d="M0 -20 L7 -9 L3.5 -9 L9 -2 L0 -2 Z" fill="#13421a" />
      </g>
      <g id="tree2">
        <rect x="-1.5" y="-5" width="3" height="6" fill="#5b3a1e" />
        <circle cx="0" cy="-11" r="7" fill="#2f7a2c" />
        <circle cx="3" cy="-9" r="5" fill="#215c22" />
        <circle cx="-2.5" cy="-13" r="3" fill="#4c9a3d" />
      </g>
      <g id="tuft">
        <path d="M-4 0 Q-3 -6 -5 -9 M0 0 Q0 -7 1 -10 M4 0 Q3 -5 5 -8" stroke="#5b8f2b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
      <g id="sheep">
        <ellipse cx="0" cy="1" rx="8" ry="1.6" fill="rgba(0,0,0,.18)" />
        <rect x="-5" y="-3" width="1.6" height="4" fill="#333" />
        <rect x="3" y="-3" width="1.6" height="4" fill="#333" />
        <circle cx="-4" cy="-6" r="3.6" fill="#fdfdf8" />
        <circle cx="0" cy="-7" r="4.2" fill="#ffffff" />
        <circle cx="4" cy="-6" r="3.6" fill="#f4f4ee" />
        <ellipse cx="8" cy="-7.5" rx="2.6" ry="2" fill="#2e2a26" />
      </g>
      <g id="wheat">
        <path d="M0 0 L0 -16" stroke="#a47a1c" strokeWidth="1.2" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <ellipse cx="-1.8" cy={-15 + i * 3} rx="1.5" ry="2.4" fill="#e8b832" transform={`rotate(-25 -1.8 ${-15 + i * 3})`} />
            <ellipse cx="1.8" cy={-15 + i * 3} rx="1.5" ry="2.4" fill="#d9a521" transform={`rotate(25 1.8 ${-15 + i * 3})`} />
          </g>
        ))}
      </g>
      <g id="bricks">
        {[
          [-8, -4], [0, -4], [-4, -8], [4, -8], [0, -12],
        ].map(([x, y], i) => (
          <rect key={i} x={x! - 1} y={y} width="8" height="3.8" rx=".6" fill={i % 2 ? '#a8432a' : '#c45a37'} stroke="#7a2c18" strokeWidth=".6" />
        ))}
      </g>
      <g id="mound">
        <path d="M-12 0 Q-6 -10 0 -9 Q7 -11 12 0 Z" fill="#b8613a" />
        <path d="M0 -9 Q7 -11 12 0 L4 0 Q5 -5 0 -9 Z" fill="#8f4325" />
      </g>
      <g id="peak">
        <path d="M-14 0 L-2 -22 L12 0 Z" fill="#7d7f84" />
        <path d="M-2 -22 L12 0 L2 0 Z" fill="#55575b" />
        <path d="M-2 -22 L-6.5 -14 L-3 -15.5 L0 -13 L2.5 -16 Z" fill="#f4f6f8" />
      </g>
      <g id="rock">
        <path d="M-7 0 L-5 -6 L1 -8 L6 -4 L7 0 Z" fill="#8a8c90" />
        <path d="M1 -8 L6 -4 L7 0 L2 0 Z" fill="#636569" />
      </g>
      <g id="dune">
        <path d="M-14 0 Q-4 -9 6 -3 Q10 -1 14 0 Z" fill="#e3c88d" />
        <path d="M-6 -4 Q0 -7 5 -3" stroke="#c9a764" strokeWidth="1" fill="none" />
      </g>
      <g id="cactus">
        <path d="M0 0 V-14 M0 -8 H-4 V-12 M0 -6 H4 V-11" stroke="#5a8a3a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </g>
    </defs>
  );
}

/** Biểu tượng tài nguyên/commodity, vẽ trong hộp 40×40 quanh gốc (0,0). Dùng được trong SVG lớn. */
export function ResourceGlyph({ type }: { type: CardType }) {
  switch (type) {
    case 'lumber':
      return (
        <g>
          {[[-9, 6], [9, 6], [0, -6]].map(([x, y], i) => (
            <g key={i}>
              <rect x={x! - 9} y={y! - 5} width="18" height="10" rx="2" fill="#8a5a2b" stroke="#4a2e12" strokeWidth="1" />
              <circle cx={x! + 8} cy={y} r="5" fill="#e2b77a" stroke="#4a2e12" strokeWidth="1" />
              <circle cx={x! + 8} cy={y} r="2" fill="none" stroke="#a87a43" strokeWidth=".8" />
            </g>
          ))}
        </g>
      );
    case 'brick':
      return (
        <g>
          {[[-10, 6], [1, 6], [-5, -1], [6, -1], [-0.5, -8]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="10" height="6" rx="1" fill={i % 2 ? '#b0472c' : '#cf6440'} stroke="#6e2513" strokeWidth="1" />
          ))}
        </g>
      );
    case 'wool':
      return (
        <g transform="scale(1.7) translate(-1 5)">
          <use href="#sheep" />
        </g>
      );
    case 'grain':
      return (
        <g transform="scale(1.4) translate(0 9)">
          <use href="#wheat" x="-5" />
          <use href="#wheat" x="0" y="1" />
          <use href="#wheat" x="5" />
        </g>
      );
    case 'ore':
      return (
        <g>
          <path d="M-14 10 L-10 -4 L-1 -10 L9 -6 L14 10 Z" fill="#8c8e93" stroke="#3d3f43" strokeWidth="1" />
          <path d="M-1 -10 L9 -6 L14 10 L3 10 Z" fill="#5d5f63" />
          <path d="M-6 -2 L-2 -5 L1 0 Z" fill="#c9ccd1" />
        </g>
      );
    case 'paper':
      return (
        <g>
          <rect x="-11" y="-12" width="22" height="24" rx="2" fill="#fbf3dc" stroke="#7a6440" strokeWidth="1.2" />
          <ellipse cx="0" cy="-12" rx="12" ry="3" fill="#e9dbb5" stroke="#7a6440" strokeWidth="1" />
          {[-5, -1, 3, 7].map((y) => (
            <line key={y} x1="-7" y1={y} x2="7" y2={y} stroke="#9c8a63" strokeWidth="1" />
          ))}
        </g>
      );
    case 'cloth':
      return (
        <g>
          <rect x="-12" y="-9" width="24" height="18" rx="3" fill="#7b4ea3" stroke="#3e2357" strokeWidth="1.2" />
          {[-6, 0, 6].map((x) => (
            <line key={x} x1={x} y1="-9" x2={x} y2="9" stroke="#a37ccc" strokeWidth="1.4" />
          ))}
          <ellipse cx="12" cy="0" rx="3" ry="9" fill="#5e3a80" stroke="#3e2357" strokeWidth="1" />
        </g>
      );
    case 'coin':
      return (
        <g>
          <circle cx="3" cy="3" r="11" fill="#b8871b" stroke="#6b4b0c" strokeWidth="1" />
          <circle cx="-2" cy="-2" r="11" fill="#e8bd3d" stroke="#6b4b0c" strokeWidth="1.2" />
          <circle cx="-2" cy="-2" r="7" fill="none" stroke="#b8871b" strokeWidth="1.2" />
        </g>
      );
  }
}

/** Defs dùng chung cho cả trang — render đúng MỘT lần (tránh trùng id). */
export function GlobalDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <BoardDefs />
    </svg>
  );
}

/** Icon tài nguyên dùng trong HTML (cần <GlobalDefs/> trên trang). */
export function ResourceIcon({ type, size = 28 }: { type: CardType; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" aria-hidden="true" className="ricon">
      <ResourceGlyph type={type} />
    </svg>
  );
}

export const CARD_BG: Record<CardType, [string, string]> = {
  lumber: ['#5f9a4a', '#2c5e26'],
  brick: ['#e08e5e', '#a24a2b'],
  wool: ['#c2e48a', '#7aab43'],
  grain: ['#f8df8a', '#d6a83b'],
  ore: ['#c3c5c9', '#76797e'],
  paper: ['#f6eccd', '#c9b47e'],
  cloth: ['#cbb2e4', '#7b4ea3'],
  coin: ['#f7dd8c', '#c6951f'],
};

/** Mặt xúc xắc có chấm. */
export function Die({ value, color }: { value: number; color: 'red' | 'yellow' }) {
  const pips: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };
  return (
    <svg className={`die die-${color}`} viewBox="0 0 48 48" width="52" height="52" aria-label={`${value}`} role="img">
      <rect x="2" y="2" width="44" height="44" rx="9" className="die-face" />
      {(pips[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={12 + cx * 12} cy={12 + cy * 12} r="4.2" className="die-pip" />
      ))}
    </svg>
  );
}

const GATE_COLOR: Record<string, string> = { 'gate:science': '#2e8b3e', 'gate:trade': '#d9a520', 'gate:politics': '#2668b0' };

export function EventDie({ face }: { face: EventFace }) {
  return (
    <svg className="die die-event" viewBox="0 0 48 48" width="52" height="52" role="img" aria-label={face}>
      <rect x="2" y="2" width="44" height="44" rx="9" fill="#fbf7ee" stroke="#9c8f73" strokeWidth="1.5" />
      {face === 'ship' ? (
        <g transform="translate(24 27)">
          <path d="M-14 2 L14 2 L9 10 L-9 10 Z" fill="#3b2a1a" />
          <path d="M-1 0 V-18 L11 -3 H-1 Z" fill="#1c1c1c" />
          <path d="M-3 -2 V-15 L-12 -2 Z" fill="#3a3a3a" />
        </g>
      ) : (
        <g transform="translate(24 26)" fill={GATE_COLOR[face]}>
          <path d="M-13 12 V-6 H-9 V-11 H-5 V-6 H-2 V-11 H2 V-6 H5 V-11 H9 V-6 H13 V12 H4 V3 A4 4 0 0 0 -4 3 V12 Z" />
        </g>
      )}
    </svg>
  );
}
