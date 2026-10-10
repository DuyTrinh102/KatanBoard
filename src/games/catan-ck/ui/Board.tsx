import { buildTopology, hexCenter, vertexPoint, type EdgeId, type HexId, type VertexId } from '../board/topology';
import type { PublicGameView } from '../projections/views';
import type { Terrain } from '../rules';
import { CARD_LABEL } from '../engine/text';
import { ICON_GLYPH } from './format';

export const HEX_SIZE = 66;

const TERRAIN_FILL: Record<Terrain, string> = {
  forest: '#2e7d32',
  hills: '#c0603a',
  pasture: '#8bc34a',
  fields: '#f2c94c',
  mountains: '#8d8f95',
  desert: '#e3d3a4',
};
const TERRAIN_LABEL: Record<Terrain, string> = {
  forest: 'Rừng',
  hills: 'Đồi',
  pasture: 'Đồng cỏ',
  fields: 'Ruộng',
  mountains: 'Núi',
  desert: 'Sa mạc',
};

export interface BoardTargets {
  readonly kind: 'vertex' | 'edge' | 'hex';
  readonly ids: readonly string[];
  readonly color: string;
  readonly selected: string | null;
  readonly onPick: (id: string) => void;
}

function hexPoints(cx: number, cy: number, size: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`;
  }).join(' ');
}

/** Vùng chạm hình chữ nhật quanh cạnh (đường kẻ ngang có bbox cao 0 → không chạm được). */
function edgeHitArea(a: { x: number; y: number }, b: { x: number; y: number }, half: number): string {
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

export function Board({ view, targets }: { view: PublicGameView; targets: BoardTargets | null }) {
  const topo = buildTopology(2);
  const color = (pid: string) => view.players.find((p) => p.id === pid)?.color ?? '#000';
  const icon = (pid: string) => ICON_GLYPH[view.players.find((p) => p.id === pid)?.icon ?? ''] ?? '';
  const S = HEX_SIZE;
  const vb = 360;
  const targetSet = new Set(targets?.ids ?? []);

  return (
    <svg className="board" viewBox={`${-vb} ${-vb * 0.85} ${vb * 2} ${vb * 1.7}`} role="img" aria-label="Bàn chơi">
      {/* Biển */}
      <polygon points={hexPoints(0, 0, S * 5.6)} fill="#2f6fa3" transform="rotate(30)" />
      {topo.hexes.map((h) => {
        const tile = view.board.hexes[h]!;
        const { x, y } = hexCenter(h, S);
        const isTarget = targets?.kind === 'hex' && targetSet.has(h);
        return (
          <g key={h}>
            <polygon points={hexPoints(x, y, S - 1)} fill={TERRAIN_FILL[tile.terrain]} stroke="#f5ecd2" strokeWidth={3} />
            <text x={x} y={y - S * 0.45} className="terrain-label">{TERRAIN_LABEL[tile.terrain]}</text>
            {tile.token !== null && (
              <g>
                <circle cx={x} cy={y} r={19} fill="#fbf4e2" stroke="#6b5a3a" />
                <text x={x} y={y + 7} className={`token ${tile.token === 6 || tile.token === 8 ? 'token-red' : ''}`}>{tile.token}</text>
              </g>
            )}
            {view.board.robberHex === h && <circle cx={x + 26} cy={y + 18} r={13} fill="#222" stroke="#eee" strokeWidth={2} aria-label="Robber" />}
            {isTarget && (
              <polygon
                points={hexPoints(x, y, S - 6)}
                className={`target ${targets!.selected === h ? 'selected' : ''}`}
                style={{ stroke: targets!.color }}
                data-testid="h-target"
                data-id={h}
                onClick={() => targets!.onPick(h)}
              />
            )}
          </g>
        );
      })}
      {view.board.harbors.map((hb) => {
        const [a, b] = hb.vertices;
        const pa = vertexPoint(a, S);
        const pb = vertexPoint(b, S);
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        const len = Math.hypot(mx, my);
        const ox = (mx / len) * 34;
        const oy = (my / len) * 34;
        const label = hb.kind === 'generic' ? '3:1' : `2:1 ${CARD_LABEL[hb.kind]}`;
        return (
          <g key={hb.edge}>
            <line x1={pa.x} y1={pa.y} x2={mx + ox} y2={my + oy} stroke="#d9c7a0" strokeWidth={4} />
            <line x1={pb.x} y1={pb.y} x2={mx + ox} y2={my + oy} stroke="#d9c7a0" strokeWidth={4} />
            <rect x={mx + ox - 34} y={my + oy - 12} width={68} height={24} rx={6} fill="#fbf4e2" />
            <text x={mx + ox} y={my + oy + 6} className="harbor-label">{label}</text>
          </g>
        );
      })}
      {(Object.entries(view.roads) as [EdgeId, string][]).map(([e, owner]) => {
        const [a, b] = topo.edgeVertices[e]!;
        const pa = vertexPoint(a, S);
        const pb = vertexPoint(b, S);
        return <line key={e} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color(owner)} strokeWidth={9} strokeLinecap="round" className="road" />;
      })}
      {targets?.kind === 'edge' &&
        targets.ids.map((e) => {
          const [a, b] = topo.edgeVertices[e as EdgeId]!;
          const pa = vertexPoint(a, S);
          const pb = vertexPoint(b, S);
          return (
            <g key={e} data-testid="e-target" data-id={e} onClick={() => targets.onPick(e)} className="target-group">
              <polygon points={edgeHitArea(pa, pb, 14)} fill="transparent" />
              <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={targets.color} strokeWidth={targets.selected === e ? 10 : 5} strokeDasharray={targets.selected === e ? undefined : '6 6'} />
            </g>
          );
        })}
      {(Object.entries(view.buildings) as [VertexId, { owner: string; kind: string }][]).map(([v, b]) => {
        const p = vertexPoint(v, S);
        return b.kind === 'city' ? (
          <g key={v}>
            <rect x={p.x - 15} y={p.y - 15} width={30} height={30} rx={4} fill={color(b.owner)} stroke="#fff" strokeWidth={3} />
            <text x={p.x} y={p.y + 6} className="piece-icon">{icon(b.owner)}</text>
          </g>
        ) : (
          <g key={v}>
            <circle cx={p.x} cy={p.y} r={12} fill={color(b.owner)} stroke="#fff" strokeWidth={3} />
            <text x={p.x} y={p.y + 5} className="piece-icon small">{icon(b.owner)}</text>
          </g>
        );
      })}
      {targets?.kind === 'vertex' &&
        targets.ids.map((v) => {
          const p = vertexPoint(v as VertexId, S);
          return (
            <g key={v} data-testid="v-target" data-id={v} onClick={() => targets.onPick(v)} className="target-group">
              <circle cx={p.x} cy={p.y} r={22} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={targets.selected === v ? 14 : 9} fill={targets.selected === v ? targets.color : '#fff'} stroke={targets.color} strokeWidth={4} />
            </g>
          );
        })}
    </svg>
  );
}

export type { HexId };
