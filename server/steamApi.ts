export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  cover: string;
}

interface ResolveVanityResponse {
  response?: {
    success?: number;
    steamid?: string;
    message?: string;
  };
}

interface OwnedGamesResponse {
  response?: {
    game_count?: number;
    games?: Array<{
      appid: number;
      name?: string;
      playtime_forever?: number;
    }>;
  };
}

interface StoreSearchResponse {
  items?: Array<{
    id?: number;
    name?: string;
    tiny_image?: string;
  }>;
}

interface StoreAppDetailsResponse {
  [appid: string]: {
    success?: boolean;
    data?: {
      platforms?: {
        windows?: boolean;
        mac?: boolean;
        linux?: boolean;
      };
    };
  };
}

type ParsedProfile =
  | { type: "steamid"; value: string }
  | { type: "vanity"; value: string };

export class SteamApiError extends Error {
  status: number;
  code: string;
  publicMessage: string;

  constructor(status: number, code: string, publicMessage: string) {
    super(publicMessage);
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

const STEAM_API_BASE = "https://api.steampowered.com";
const STEAM_STORE_BASE = "https://store.steampowered.com";
const macSupportCache = new Map<number, boolean>();
const APP_DETAILS_CHUNK_SIZE = 10;

function getSteamApiKey() {
  const key = process.env.STEAM_API_KEY?.trim();

  if (!key) {
    throw new SteamApiError(
      500,
      "MISSING_STEAM_API_KEY",
      "На сервере не настроен STEAM_API_KEY. Добавьте ключ в server/.env."
    );
  }

  return key;
}

function normalizeInput(profileUrl: string) {
  return profileUrl.trim().replace(/\/+$/, "");
}

export function parseSteamProfile(profileUrl: string): ParsedProfile {
  const input = normalizeInput(profileUrl);

  if (!input) {
    throw new SteamApiError(
      400,
      "INVALID_PROFILE_URL",
      "Вставьте ссылку на Steam-профиль или SteamID64."
    );
  }

  if (/^\d{17}$/.test(input)) {
    return { type: "steamid", value: input };
  }

  if (/^[a-z0-9_-]{2,64}$/i.test(input)) {
    return { type: "vanity", value: input };
  }

  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new SteamApiError(
      400,
      "INVALID_PROFILE_URL",
      "Не получилось распознать ссылку. Используйте steamcommunity.com/id/name или steamcommunity.com/profiles/steamid64."
    );
  }

  if (!/(^|\.)steamcommunity\.com$/i.test(url.hostname)) {
    throw new SteamApiError(
      400,
      "INVALID_PROFILE_URL",
      "Это не похоже на ссылку Steam Community."
    );
  }

  const [kind, value] = url.pathname.split("/").filter(Boolean);

  if (kind === "profiles" && /^\d{17}$/.test(value ?? "")) {
    return { type: "steamid", value };
  }

  if (kind === "id" && value) {
    return { type: "vanity", value };
  }

  throw new SteamApiError(
    400,
    "INVALID_PROFILE_URL",
    "Поддерживаются ссылки вида /id/customname, /profiles/steamid64 или просто SteamID64."
  );
}

async function requestJson<T>(url: URL): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    throw new SteamApiError(
      502,
      "STEAM_API_UNAVAILABLE",
      "Steam API сейчас недоступен. Попробуйте еще раз позже."
    );
  }

  if (response.status === 429) {
    throw new SteamApiError(
      429,
      "RATE_LIMITED",
      "Steam API временно ограничил количество запросов. Попробуйте чуть позже."
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new SteamApiError(
      response.status,
      "STEAM_API_KEY_REJECTED",
      "Steam API отклонил ключ. Проверьте STEAM_API_KEY в server/.env."
    );
  }

  if (!response.ok) {
    throw new SteamApiError(
      response.status,
      "STEAM_API_ERROR",
      "Steam API вернул ошибку. Попробуйте позже или проверьте ссылку."
    );
  }

  return (await response.json()) as T;
}

export async function resolveSteamId(profileUrl: string) {
  const parsed = parseSteamProfile(profileUrl);

  if (parsed.type === "steamid") {
    return parsed.value;
  }

  const url = new URL(`${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/`);
  url.searchParams.set("key", getSteamApiKey());
  url.searchParams.set("vanityurl", parsed.value);

  const data = await requestJson<ResolveVanityResponse>(url);
  const result = data.response;

  if (result?.success === 1 && result.steamid) {
    return result.steamid;
  }

  throw new SteamApiError(
    404,
    "PROFILE_NOT_FOUND",
    "Steam-профиль не найден. Проверьте ссылку или имя профиля."
  );
}

export async function getOwnedGames(steamId: string): Promise<SteamGame[]> {
  if (!/^\d{17}$/.test(steamId)) {
    throw new SteamApiError(
      400,
      "INVALID_STEAM_ID",
      "SteamID64 должен состоять из 17 цифр."
    );
  }

  const url = new URL(`${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/`);
  url.searchParams.set("key", getSteamApiKey());
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "true");
  url.searchParams.set("include_played_free_games", "true");

  const data = await requestJson<OwnedGamesResponse>(url);
  const response = data.response;

  if (!response || !Array.isArray(response.games)) {
    throw new SteamApiError(
      403,
      "PROFILE_PRIVATE",
      "Профиль Steam закрыт или список игр скрыт. Сделайте профиль и игры публичными."
    );
  }

  const games = response.games
    .filter((game) => game.name && Number.isFinite(game.appid))
    .map((game) => ({
      appid: game.appid,
      name: game.name ?? `Steam App ${game.appid}`,
      playtime_forever: game.playtime_forever ?? 0,
      cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900_2x.jpg`
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  if (games.length === 0) {
    throw new SteamApiError(
      404,
      "NO_GAMES",
      "У профиля нет публичных игр или список игр пуст."
    );
  }

  return games;
}

async function fetchMacSupportChunk(appids: number[]): Promise<void> {
  const url = new URL(`${STEAM_STORE_BASE}/api/appdetails/`);

  url.searchParams.set("appids", appids.join(","));
  url.searchParams.set("filters", "platforms");
  url.searchParams.set("cc", "us");
  url.searchParams.set("l", "english");

  try {
    const data = await requestJson<StoreAppDetailsResponse>(url);

    for (const appid of appids) {
      const isMacSupported = data[String(appid)]?.data?.platforms?.mac === true;
      macSupportCache.set(appid, isMacSupported);
    }
  } catch (error) {
    if (appids.length === 1) {
      macSupportCache.set(appids[0], false);
      return;
    }

    for (const appid of appids) {
      await fetchMacSupportChunk([appid]);
    }
  }
}

async function getMacSupportMap(appids: number[]) {
  const uniqueAppids = Array.from(new Set(appids));
  const missingAppids = uniqueAppids.filter((appid) => !macSupportCache.has(appid));

  for (let index = 0; index < missingAppids.length; index += APP_DETAILS_CHUNK_SIZE) {
    await fetchMacSupportChunk(missingAppids.slice(index, index + APP_DETAILS_CHUNK_SIZE));
  }

  return new Map(uniqueAppids.map((appid) => [appid, macSupportCache.get(appid) === true]));
}

export async function getMacSupportedGames(steamId: string): Promise<SteamGame[]> {
  const games = await getOwnedGames(steamId);
  const macSupportMap = await getMacSupportMap(games.map((game) => game.appid));

  return games
    .filter((game) => macSupportMap.get(game.appid))
    .map((game) => ({
      ...game,
      mac_supported: true
    }));
}

export async function searchSteamGameByName(query: string): Promise<SteamGame> {
  const term = query.trim();

  if (term.length < 2) {
    throw new SteamApiError(
      400,
      "INVALID_GAME_QUERY",
      "Введите название игры минимум из двух символов."
    );
  }

  const url = new URL(`${STEAM_STORE_BASE}/api/storesearch/`);
  url.searchParams.set("term", term);
  url.searchParams.set("cc", "us");
  url.searchParams.set("l", "russian");

  const data = await requestJson<StoreSearchResponse>(url);
  const match = data.items?.find((item) => item.id && item.name);

  if (!match?.id || !match.name) {
    throw new SteamApiError(
      404,
      "GAME_NOT_FOUND",
      "Не удалось найти игру в Steam по этому названию."
    );
  }

  return {
    appid: match.id,
    name: match.name,
    playtime_forever: 0,
    cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${match.id}/library_600x900_2x.jpg`
  };
}
