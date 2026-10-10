import type { PublicGameView, PublicLogEntry } from '../projections/views';
import { CARD_LABEL, describeBundle } from '../engine/text';
import type { Bundle, CardType, EventFace } from '../rules';

export const EVENT_LABEL: Record<EventFace, string> = {
  ship: 'Tàu barbarian',
  'gate:science': 'Cổng Khoa học (xanh lá)',
  'gate:trade': 'Cổng Thương mại (vàng)',
  'gate:politics': 'Cổng Chính trị (xanh dương)',
};

export const ICON_GLYPH: Record<string, string> = { shield: '♠', leaf: '♣', star: '★', wave: '♦' };

export function playerName(view: PublicGameView, id: unknown): string {
  return view.players.find((p) => p.id === id)?.name ?? String(id);
}

/** Câu log công khai tiếng Việt — chỉ dùng dữ liệu đã qua projection công khai. */
export function formatLog(view: PublicGameView, e: PublicLogEntry): string {
  const d = e.data;
  const n = (k: string) => playerName(view, d[k]);
  switch (e.kind) {
    case 'setupBuilding':
      return `${n('player')} đặt ${d.kind === 'city' ? 'city' : 'settlement'} khởi đầu${d.gained && Object.keys(d.gained as object).length ? ` (nhận ${describeBundle(d.gained as Bundle)})` : ''}`;
    case 'setupRoad':
      return `${n('player')} đặt đường khởi đầu`;
    case 'setupDone':
      return 'Hoàn tất đặt quân khởi đầu';
    case 'roll':
      return `${n('player')} tung ${d.red} + ${d.yellow} = ${(d.red as number) + (d.yellow as number)} · ${EVENT_LABEL[d.event as EventFace]} (hiệu ứng event: M2)`;
    case 'production': {
      const rec = d.received as Record<string, Bundle>;
      const parts = Object.entries(rec).map(([p, b]) => `${playerName(view, p)} +${describeBundle(b)}`);
      const short = (d.shortages as CardType[]).map((t) => CARD_LABEL[t]);
      return `Sản xuất ${d.sum}: ${parts.length ? parts.join('; ') : 'không ai nhận'}${short.length ? ` · Ngân hàng thiếu: ${short.join(', ')}` : ''}`;
    }
    case 'robberAsleep':
      return 'Tung 7: robber chưa hoạt động trước trận barbarian đầu tiên (luật ứng viên PRD-007)';
    case 'discardChosen':
      return `${n('player')} đã chọn lá bỏ`;
    case 'discarded':
      return `${n('player')} bỏ ${d.count} lá${d.cards ? ` (${describeBundle(d.cards as Bundle)})` : ''}`;
    case 'robber':
      return d.victim ? `${n('player')} chuyển robber và lấy 1 lá của ${n('victim')}${d.card ? ` (${CARD_LABEL[d.card as CardType]})` : ''}` : `${n('player')} chuyển robber`;
    case 'build':
      return `${n('player')} xây ${d.kind === 'road' ? 'đường' : d.kind}`;
    case 'bankTrade':
      return `${n('player')} đổi ${d.count} ${CARD_LABEL[d.give as CardType]} lấy 1 ${CARD_LABEL[d.get as CardType]} với ngân hàng`;
    case 'tradeProposed':
      return `${n('from')} đề nghị: đưa ${describeBundle(d.offer as Bundle)} ↔ nhận ${describeBundle(d.request as Bundle)}`;
    case 'tradeUpdated':
      return `Đề nghị đã sửa (bản ${d.revision}): đưa ${describeBundle(d.offer as Bundle)} ↔ nhận ${describeBundle(d.request as Bundle)}`;
    case 'tradeResponse':
      return `${n('player')} ${d.response === 'accept' ? 'đồng ý' : 'từ chối'} đề nghị`;
    case 'tradeDone':
      return `${n('from')} và ${n('partner')} trao đổi: ${describeBundle(d.offer as Bundle)} ↔ ${describeBundle(d.request as Bundle)}`;
    case 'tradeCancelled':
      return 'Đề nghị đã hủy';
    case 'longestRoad':
      return d.to ? `Longest Road thuộc về ${n('to')}` : 'Longest Road không còn ai giữ';
    case 'endTurn':
      return `${n('player')} kết thúc lượt → ${n('next')}`;
    case 'gameOver':
      return `${n('winner')} thắng với ${d.score} điểm!`;
    default:
      return e.kind;
  }
}
