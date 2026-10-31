import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

interface SharedSteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  cover: string;
  customCover?: string;
}

interface SharedTierRow {
  id: string;
  label: string;
  color: string;
  gameIds: number[];
}

export interface SharedTierListState {
  profileInput: string;
  steamId64: string;
  games: SharedSteamGame[];
  rows: SharedTierRow[];
  savedAt: string;
}

interface SharedTierListRecord {
  id: string;
  createdAt: string;
  state: SharedTierListState;
}

type TierListDatabase = Record<string, SharedTierListRecord>;

const dataPath = process.env.TIERLIST_DATA_PATH ?? join(process.cwd(), "data", "tierlists.json");

async function readDatabase(): Promise<TierListDatabase> {
  try {
    const raw = await readFile(dataPath, "utf8");
    return JSON.parse(raw) as TierListDatabase;
  } catch {
    return {};
  }
}

async function writeDatabase(database: TierListDatabase) {
  await mkdir(dirname(dataPath), { recursive: true });
  await writeFile(dataPath, JSON.stringify(database, null, 2), "utf8");
}

export function validateTierListState(input: unknown): SharedTierListState {
  const state = input as Partial<SharedTierListState>;

  if (!state || !Array.isArray(state.games) || !Array.isArray(state.rows)) {
    throw new Error("Некорректные данные тир-листа.");
  }

  return {
    profileInput: String(state.profileInput ?? ""),
    steamId64: String(state.steamId64 ?? ""),
    games: state.games
      .filter((game) => Number.isFinite(game.appid) && game.name)
      .map((game) => ({
        appid: game.appid,
        name: String(game.name),
        playtime_forever: Number(game.playtime_forever) || 0,
        cover: String(game.cover ?? ""),
        customCover: game.customCover ? String(game.customCover) : undefined
      })),
    rows: state.rows.map((row) => ({
      id: String(row.id),
      label: String(row.label ?? ""),
      color: String(row.color ?? "#8b98a9"),
      gameIds: Array.isArray(row.gameIds)
        ? row.gameIds.filter((gameId) => Number.isFinite(gameId))
        : []
    })),
    savedAt: new Date().toISOString()
  };
}

export async function saveTierList(state: SharedTierListState) {
  const database = await readDatabase();
  const id = randomUUID().slice(0, 8);
  const createdAt = new Date().toISOString();

  database[id] = {
    id,
    createdAt,
    state: {
      ...state,
      savedAt: createdAt
    }
  };

  await writeDatabase(database);

  return database[id];
}

export async function getTierList(id: string) {
  const database = await readDatabase();
  return database[id] ?? null;
}
