/** Game registry tối thiểu (architecture §12) — đủ để launcher liệt kê game; không phải framework plugin. */
export interface GameModuleInfo {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
}

export const GAMES: readonly GameModuleInfo[] = [
  { id: 'catan-ck', title: 'CATAN + Cities & Knights', subtitle: 'Bản phát triển M1 — dữ liệu luật chưa kiểm chứng', minPlayers: 3, maxPlayers: 4 },
];
