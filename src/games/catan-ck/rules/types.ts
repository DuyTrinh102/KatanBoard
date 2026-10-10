export const RESOURCES = ['lumber', 'brick', 'wool', 'grain', 'ore'] as const;
export const COMMODITIES = ['paper', 'cloth', 'coin'] as const;
export type Resource = (typeof RESOURCES)[number];
export type Commodity = (typeof COMMODITIES)[number];
export type CardType = Resource | Commodity;
export const CARD_TYPES: readonly CardType[] = [...RESOURCES, ...COMMODITIES];

export type Terrain = 'forest' | 'hills' | 'pasture' | 'fields' | 'mountains' | 'desert';
export type HarborKind = 'generic' | Resource;
export type EventFace = 'ship' | 'gate:science' | 'gate:trade' | 'gate:politics';

export type Bundle = Partial<Record<CardType, number>>;

/** Evidence code xem rules-spec.md §0. */
export type Evidence = 'P' | 'S' | 'M';
export type RuleStatus = 'VERIFIED' | 'UNRESOLVED';

/** Mỗi hằng số luật mang theo nguồn gốc; preset chuẩn chỉ chấp nhận VERIFIED. */
export interface RuleValue<T> {
  readonly value: T;
  readonly ruleId: string;
  readonly status: RuleStatus;
  readonly evidence: Evidence;
  readonly source: string;
}

export interface CityYield {
  readonly resource: number;
  readonly commodity?: Commodity;
}

export interface Ruleset {
  readonly id: string;
  readonly label: string;
  readonly players: RuleValue<{ min: number; max: number }>;
  readonly terrainCounts: RuleValue<Record<Terrain, number>>;
  readonly numberTokens: RuleValue<number[]>;
  readonly redNumbersNotAdjacent: RuleValue<number[]>;
  readonly harbors: RuleValue<HarborKind[]>;
  readonly bankResources: RuleValue<number>;
  readonly bankCommodities: RuleValue<number>;
  readonly stock: RuleValue<{ roads: number; settlements: number; cities: number }>;
  readonly setupSecondBuilding: RuleValue<'city' | 'settlement'>;
  readonly startingYieldFromSecond: RuleValue<boolean>;
  readonly robberStart: RuleValue<Terrain>;
  readonly eventFaces: RuleValue<EventFace[]>;
  readonly terrainResource: RuleValue<Record<Exclude<Terrain, 'desert'>, Resource>>;
  readonly cityYield: RuleValue<Record<Exclude<Terrain, 'desert'>, CityYield>>;
  readonly bankShortage: RuleValue<'none-unless-single-recipient'>;
  readonly handLimit: RuleValue<number>;
  readonly robberInactiveUntilFirstAttack: RuleValue<boolean>;
  readonly costs: RuleValue<{ road: Bundle; settlement: Bundle; city: Bundle }>;
  readonly tradeRatios: RuleValue<{ bank: number; generic: number; specific: number }>;
  readonly longestRoadMin: RuleValue<number>;
  readonly longestRoadPoints: RuleValue<number>;
  readonly buildingPoints: RuleValue<{ settlement: number; city: number }>;
  readonly victoryTarget: RuleValue<number>;
  readonly winOnlyOnOwnTurn: RuleValue<boolean>;
}
