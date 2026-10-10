import type { Bundle, CardType } from '../rules';

/** Tên hiển thị tiếng Việt (kèm thuật ngữ tiếng Anh trong trợ giúp). Không dùng làm khóa logic. */
export const CARD_LABEL: Record<CardType, string> = {
  lumber: 'Gỗ',
  brick: 'Gạch',
  wool: 'Len',
  grain: 'Lúa',
  ore: 'Quặng',
  paper: 'Giấy',
  cloth: 'Vải',
  coin: 'Xu',
};

export const CARD_EN: Record<CardType, string> = {
  lumber: 'Lumber',
  brick: 'Brick',
  wool: 'Wool',
  grain: 'Grain',
  ore: 'Ore',
  paper: 'Paper',
  cloth: 'Cloth',
  coin: 'Coin',
};

export function describeBundle(b: Bundle): string {
  const parts = (Object.entries(b) as [CardType, number][])
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${n} ${CARD_LABEL[t]}`);
  return parts.length ? parts.join(', ') : 'không có gì';
}
