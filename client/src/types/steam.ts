export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  cover: string;
  customCover?: string;
  mac_supported?: boolean;
}

export interface TierRowData {
  id: string;
  label: string;
  color: string;
  gameIds: number[];
}

export interface SavedTierListState {
  profileInput: string;
  steamId64: string;
  games: SteamGame[];
  rows: TierRowData[];
  savedAt: string;
}

export interface ApiErrorResponse {
  code?: string;
  message?: string;
}

export type SortMode = "name" | "playtime-desc" | "playtime-asc";

export interface DragGameData {
  type: "game";
  appid: number;
  source: "pool" | "tier";
  tierId?: string;
}

export interface DragRowData {
  type: "row";
  rowId: string;
}

export type DragItemData = DragGameData | DragRowData;
