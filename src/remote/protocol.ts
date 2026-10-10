/**
 * Giao thức chế độ "TV + điện thoại" (WebSocket, JSON).
 * Máy chủ cục bộ giữ state và chạy engine; TV chỉ nhận dữ liệu công khai,
 * mỗi điện thoại chỉ nhận dữ liệu riêng của người cầm token ghế đó.
 */
import type { CommandBody } from '../games/catan-ck/engine/commands';
import type { PlayerConfig } from '../games/catan-ck/engine/state';
import type { ActionView, PrivateGameView, PublicGameView } from '../games/catan-ck/projections/views';
import type { CardType } from '../games/catan-ck/rules';

export const WS_PATH = '/ws';

export type ClientMsg =
  | { readonly t: 'list' }
  | { readonly t: 'create'; readonly players: readonly Omit<PlayerConfig, 'seat'>[] }
  | { readonly t: 'hello-tv'; readonly gameId: string }
  | { readonly t: 'hello-player'; readonly gameId: string; readonly token: string }
  | { readonly t: 'cmd'; readonly commandId: string; readonly expectedRevision: number; readonly body: CommandBody };

export interface SeatStatus {
  readonly playerId: string;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
  readonly connected: boolean;
  /** Chỉ gửi cho TV để vẽ mã QR vào ghế. */
  readonly token: string;
}

export interface GameSummary {
  readonly gameId: string;
  readonly revision: number;
  readonly savedAt: string;
  readonly phase: string;
  readonly players: readonly string[];
}

export type ServerMsg =
  | { readonly t: 'games'; readonly games: readonly GameSummary[] }
  | { readonly t: 'created'; readonly gameId: string }
  | { readonly t: 'tv-state'; readonly view: PublicGameView; readonly seats: readonly SeatStatus[]; readonly lanHosts: readonly string[] }
  | {
      readonly t: 'player-state';
      readonly playerId: string;
      readonly view: PublicGameView;
      readonly priv: PrivateGameView;
      readonly actions: readonly ActionView[];
      readonly bankRatios: Readonly<Record<CardType, number>>;
    }
  | { readonly t: 'ack'; readonly commandId: string; readonly ok: boolean; readonly reason?: string }
  | { readonly t: 'error'; readonly message: string };

export function joinUrl(base: string, gameId: string, token: string): string {
  return `${base.replace(/\/$/, '')}/play/${encodeURIComponent(gameId)}?t=${encodeURIComponent(token)}`;
}
