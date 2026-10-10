import { buildTopology, hexCenter, vertexPoint, type EdgeId, type HexId, type VertexId } from '../board/topology';
import type { PublicGameView } from '../projections/views';
import type { Terrain } from '../rules';
import { CARD_LABEL } from '../engine/text';
import { ICON_GLYPH } from './format';
import { hashString, ResourceGlyph, seeded, TERRAIN_SPRITES } from './art';

export const HEX_SIZE = 66;

const TERRAIN_LABEL: Record<Terrain, string> = {
  forest: 'Rừng (Forest)',
  hills: 'Đồi (Hills)',
  pasture: 'Đồng cỏ (Pasture)',
  fields: 'Ruộng (Fields)',
  mountains: 'Núi (Mountains)',
  desert: 'Sa mạc (Desert)',
};

export interface BoardTargets {
  readonly kind: 'vertex' | 'edge' | 'hex';
  readonly ids: readonly string[];
  readonly color: string;
  readonly selected: string | null;
  /** Quân xem trước khi đã chọn vị trí đỉnh. */
  readonly piece?: 'settlement' | 'city';
  readonly onPick: (id: string) => void;
}

type Pt = { x: number; y: number };

function hexPoints(cx: number, cy: number, size: number, offsetDeg = -30): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i + offsetDeg);
    return `${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`;
  }).join(' ');
}

/** Vùng chạm hình chữ nhật quanh cạnh (đường kẻ ngang có bbox cao 0 → không chạm được). */
function edgeHitArea(a: Pt, b: Pt, half: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;
  const ix = (dx / len) * 6;
  const iy = (dy / len) * 6;
  return [
    `${a.x + ix + nx},${a.y + iy + ny}`,
    `${b.x - ix + nx},${b.y - iy + ny}`,
    `${b.x - ix - nx},${b.y - iy - ny}`,
    `${a.x + ix - nx},${a.y + iy - ny}`,
  ].join(' ');
}

/** Hoạ tiết rải cố định theo ID ô (sắp theo y để vật phía trước che vật phía sau). */
function TerrainArt({ hex, terrain, cx, cy }: { hex: HexId; terrain: Terrain; cx: number; cy: number }) {
  const spec = TERRAIN_SPRITES[terrain];
  const rnd = seeded(hashString(hex + terrain));
  const items: { x: number; y: number; id: string; s: number; flip: boolean }[] = [];
  let guard = 0;
  while (items.length < spec.count && guard++ < 400) {
    const x = (rnd() * 2 - 1) * HEX_SIZE * 0.78;
    const y = (rnd() * 2 - 1) * HEX_SIZE * 0.72 + 8;
    if (Math.hypot(x, y - 2) < 27) continue; // chừa chỗ token số
    if (Math.abs(x) * 0.577 + Math.abs(y) > HEX_SIZE * 0.86 || Math.abs(x) > HEX_SIZE * 0.78) continue;
    items.push({ x, y, id: spec.ids[Math.floor(rnd() * spec.ids.length)]!, s: spec.scale[0] + rnd() * (spec.scale[1] - spec.scale[0]), flip: rnd() < 0.5 });
  }
  items.sort((a, b) => a.y - b.y);
  return (
    <g clipPath={`url(#clip-${hex.replace(/[^\w-]/g, '_')})`}>
      {items.map((it, i) => (
        <use key={i} href={`#${it.id}`} transform={`translate(${cx + it.x} ${cy + it.y}) scale(${it.flip ? -it.s : it.s} ${it.s})`} />
      ))}
    </g>
  );
}

function pips(n: number): number {
  return 6 - Math.abs(7 - n);
}

function NumberToken({ x, y, n }: { x: number; y: number; n: number }) {
  const hot = n === 6 || n === 8;
  const count = pips(n);
  return (
    <g aria-label={`Số ${n}`}>
      <circle cx={x + 1.5} cy={y + 2.5} r={21} fill="rgba(0,0,0,.35)" />
      <circle cx={x} cy={y} r={21} fill="url(#g-token)" stroke="#8a7350" strokeWidth={1.5} />
      <circle cx={x} cy={y} r={17.5} fill="none" stroke="rgba(138,115,80,.35)" strokeWidth={1} />
      <text x={x} y={y + 5} className={`token ${hot ? 'token-red' : ''}`}>{n}</text>
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} cx={x + (i - (count - 1) / 2) * 4.2} cy={y + 12} r={1.6} fill={hot ? '#b52a1c' : '#3b2f1c'} />
      ))}
    </g>
  );
}

function Settlement({ p, color, icon }: { p: Pt; color: string; icon: string }) {
  return (
    <g transform={`translate(${p.x} ${p.y + 7}) scale(1.3)`}>
      <path d="M-10 4 V-7 L-2 -15 L3 -19 L11 -11 V0 L6 4 Z" transform="translate(2 2.5)" fill="rgba(0,0,0,.4)" />
      <path d="M-10 4 V-7 L-2 -15 L6 -7 V4 Z" fill={color} stroke="rgba(0,0,0,.55)" strokeWidth={1} />
      <path d="M6 -7 L11 -11 V0 L6 4 Z" fill={color} />
      <path d="M6 -7 L11 -11 V0 L6 4 Z" fill="rgba(0,0,0,.3)" />
      <path d="M-2 -15 L3 -19 L11 -11 L6 -7 Z" fill={color} />
      <path d="M-2 -15 L3 -19 L11 -11 L6 -7 Z" fill="rgba(255,255,255,.22)" stroke="rgba(0,0,0,.4)" strokeWidth={.8} />
      <text x={-2} y={1} className="piece-icon small">{icon}</text>
    </g>
  );
}

function City({ p, color, icon }: { p: Pt; color: string; icon: string }) {
  return (
    <g transform={`translate(${p.x + 3} ${p.y + 9}) scale(1.3)`}>
      <path d="M-14 5 V-17 L-9 -24 L-4 -28 L1 -21 V-10 H11 V1 L6 5 Z" transform="translate(2 2.5)" fill="rgba(0,0,0,.4)" />
      {/* thân nhà ngang */}
      <path d="M-14 5 V-6 H6 V5 Z" fill={color} stroke="rgba(0,0,0,.55)" strokeWidth={1} />
      <path d="M6 -6 L11 -10 V1 L6 5 Z" fill={color} />
      <path d="M6 -6 L11 -10 V1 L6 5 Z" fill="rgba(0,0,0,.3)" />
      <path d="M-14 -6 L-9 -10 H11 L6 -6 Z" fill={color} />
      <path d="M-14 -6 L-9 -10 H11 L6 -6 Z" fill="rgba(255,255,255,.2)" />
      {/* tháp */}
      <path d="M-14 -6 V-17 L-9 -24 L-4 -17 V-6 Z" fill={color} stroke="rgba(0,0,0,.55)" strokeWidth={1} />
      <path d="M-4 -17 L1 -21 L-4 -28 L-9 -24 Z" fill={color} />
      <path d="M-4 -17 L1 -21 L-4 -28 L-9 -24 Z" fill="rgba(255,255,255,.22)" />
      <text x={-2} y={2} className="piece-icon small">{icon}</text>
    </g>
  );
}

function Road({ a, b, color }: { a: Pt; b: Pt; color: string }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y) * 0.66;
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return (
    <g transform={`translate(${mx} ${my}) rotate(${ang})`} className="road">
      <rect x={-len / 2 + 1.5} y={-3.5} width={len} height={11} rx={2.5} fill="rgba(0,0,0,.35)" />
      <rect x={-len / 2} y={-5.5} width={len} height={11} rx={2.5} fill={color} stroke="rgba(0,0,0,.55)" strokeWidth={1} />
      <rect x={-len / 2 + 1.5} y={-4} width={len - 3} height={3.2} rx={1.5} fill="rgba(255,255,255,.28)" />
    </g>
  );
}

function Robber({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-label="Robber">
      <ellipse cx={3} cy={16} rx={12} ry={4.5} fill="rgba(0,0,0,.4)" />
      <ellipse cx={0} cy={14} rx={11} ry={4.5} fill="url(#g-robber)" />
      <path d="M-8 13 Q-9 2 -4 -4 Q0 -7 4 -4 Q9 2 8 13 Z" fill="url(#g-robber)" />
      <circle cx={0} cy={-10} r={7} fill="url(#g-robber)" />
    </g>
  );
}

function HarborBadge({ kind, x, y }: { kind: string; x: number; y: number }) {
  const generic = kind === 'generic';
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx={1.5} cy={2.5} r={23} fill="rgba(0,0,0,.35)" />
      <circle r={23} fill="#fbf4e2" stroke="#6b5a3a" strokeWidth={1.5} />
      {generic ? (
        <>
          <text y={-1} className="harbor-ratio">3:1</text>
          <text y={11} className="harbor-sub">?</text>
        </>
      ) : (
        <>
          <g transform="translate(0 -5) scale(.62)">
            <ResourceGlyph type={kind as never} />
          </g>
          <text y={15} className="harbor-ratio small">2:1</text>
        </>
      )}
    </g>
  );
}

export function Board({ view, targets }: { view: PublicGameView; targets: BoardTargets | null }) {
  const topo = buildTopology(2);
  const player = (pid: string) => view.players.find((p) => p.id === pid);
  const color = (pid: string) => player(pid)?.color ?? '#000';
  const icon = (pid: string) => ICON_GLYPH[player(pid)?.icon ?? ''] ?? '';
  const S = HEX_SIZE;
  const targetSet = new Set(targets?.ids ?? []);
  const W = 400;
  const H = 360;

  return (
    <svg className="board" viewBox={`${-W} ${-H} ${W * 2} ${H * 2}`} role="img" aria-label="Bàn chơi">
      <defs>
        {topo.hexes.map((h) => {
          const { x, y } = hexCenter(h, S);
          return (
            <clipPath key={h} id={`clip-${h.replace(/[^\w-]/g, '_')}`}>
              <polygon points={hexPoints(x, y, S - 3)} />
            </clipPath>
          );
        })}
      </defs>

      {/* Khung gỗ + biển */}
      <polygon points={hexPoints(0, 14, S * 5.85, 0)} fill="rgba(0,0,0,.45)" />
      <polygon points={hexPoints(0, 0, S * 5.75, 0)} fill="url(#g-frame)" />
      <polygon points={hexPoints(0, 0, S * 5.55, 0)} fill="url(#g-sea)" />
      <polygon points={hexPoints(0, 0, S * 5.55, 0)} fill="url(#p-waves)" />

      {/* Bờ cát: vẽ ô phóng to phía sau */}
      {topo.hexes.map((h) => {
        const { x, y } = hexCenter(h, S);
        return <polygon key={`sand-${h}`} points={hexPoints(x, y, S + 9)} fill="#e9d29a" stroke="#d6b877" strokeWidth={2} />;
      })}

      {/* Cầu tàu & cảng */}
      {view.board.harbors.map((hb) => {
        const [a, b] = hb.vertices;
        const pa = vertexPoint(a, S);
        const pb = vertexPoint(b, S);
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        const len = Math.hypot(mx, my);
        const bx = mx + (mx / len) * 36;
        const by = my + (my / len) * 36;
        return (
          <g key={hb.edge} aria-label={hb.kind === 'generic' ? 'Cảng 3:1' : `Cảng 2:1 ${CARD_LABEL[hb.kind]}`}>
            {[pa, pb].map((p, i) => (
              <g key={i}>
                <line x1={p.x} y1={p.y} x2={bx} y2={by} stroke="#6e4a26" strokeWidth={7} strokeLinecap="round" />
                <line x1={p.x} y1={p.y} x2={bx} y2={by} stroke="#c49a63" strokeWidth={4.5} strokeDasharray="3 2.5" />
              </g>
            ))}
            <HarborBadge kind={hb.kind} x={bx} y={by} />
          </g>
        );
      })}

      {/* Ô địa hình */}
      {topo.hexes.map((h) => {
        const tile = view.board.hexes[h]!;
        const { x, y } = hexCenter(h, S);
        return (
          <g key={h}>
            <title>{TERRAIN_LABEL[tile.terrain]}</title>
            <polygon points={hexPoints(x, y, S - 2)} fill={`url(#g-${tile.terrain})`} />
            <TerrainArt hex={h} terrain={tile.terrain} cx={x} cy={y} />
            <polygon points={hexPoints(x, y, S - 2)} fill="url(#g-hexshade)" stroke="#f3e5bd" strokeWidth={3.5} />
            {tile.token !== null && <NumberToken x={x} y={y} n={tile.token} />}
          </g>
        );
      })}

      {/* Đường */}
      {(Object.entries(view.roads) as [EdgeId, string][]).map(([e, owner]) => {
        const [a, b] = topo.edgeVertices[e]!;
        return <Road key={e} a={vertexPoint(a, S)} b={vertexPoint(b, S)} color={color(owner)} />;
      })}

      {/* Robber */}
      {(() => {
        const { x, y } = hexCenter(view.board.robberHex, S);
        const hasToken = view.board.hexes[view.board.robberHex]?.token !== null;
        return <Robber x={x + (hasToken ? 28 : 0)} y={y + (hasToken ? 2 : -4)} />;
      })()}

      {/* Target ô (robber) */}
      {targets?.kind === 'hex' &&
        topo.hexes
          .filter((h) => targetSet.has(h))
          .map((h) => {
            const { x, y } = hexCenter(h, S);
            return (
              <polygon
                key={`t-${h}`}
                points={hexPoints(x, y, S - 8)}
                className={`target ${targets.selected === h ? 'selected' : ''}`}
                style={{ stroke: targets.color }}
                data-testid="h-target"
                data-id={h}
                onClick={() => targets.onPick(h)}
              />
            );
          })}

      {/* Target cạnh */}
      {targets?.kind === 'edge' &&
        targets.ids.map((e) => {
          const [a, b] = topo.edgeVertices[e as EdgeId]!;
          const pa = vertexPoint(a, S);
          const pb = vertexPoint(b, S);
          const sel = targets.selected === e;
          return (
            <g key={e} data-testid="e-target" data-id={e} onClick={() => targets.onPick(e)} className="target-group">
              <polygon points={edgeHitArea(pa, pb, 14)} fill="transparent" />
              {sel ? (
                <Road a={pa} b={pb} color={targets.color} />
              ) : (
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#fff" strokeWidth={5} strokeDasharray="6 6" className="pulse" />
              )}
            </g>
          );
        })}

      {/* Công trình */}
      {(Object.entries(view.buildings) as [VertexId, { owner: string; kind: string }][])
        .sort(([a], [b]) => vertexPoint(a, S).y - vertexPoint(b, S).y)
        .map(([v, b]) => {
          const p = vertexPoint(v, S);
          return b.kind === 'city' ? <City key={v} p={p} color={color(b.owner)} icon={icon(b.owner)} /> : <Settlement key={v} p={p} color={color(b.owner)} icon={icon(b.owner)} />;
        })}

      {/* Target đỉnh */}
      {targets?.kind === 'vertex' &&
        targets.ids.map((v) => {
          const p = vertexPoint(v as VertexId, S);
          const sel = targets.selected === v;
          return (
            <g key={v} data-testid="v-target" data-id={v} onClick={() => targets.onPick(v)} className="target-group">
              <circle cx={p.x} cy={p.y} r={22} fill="transparent" />
              {sel ? (
                <g opacity={0.85}>
                  {targets.piece === 'city' ? <City p={p} color={targets.color} icon="" /> : <Settlement p={p} color={targets.color} icon="" />}
                </g>
              ) : (
                <circle cx={p.x} cy={p.y} r={9} fill="#fff" stroke={targets.color} strokeWidth={4} className="pulse" />
              )}
            </g>
          );
        })}
    </svg>
  );
}

export type { HexId };
