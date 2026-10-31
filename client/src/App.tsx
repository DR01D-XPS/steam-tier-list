import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { Download, Link2, RotateCcw, Trash2 } from "lucide-react";
import { toPng } from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
import ErrorMessage from "./components/ErrorMessage";
import GameList from "./components/GameList";
import Loader from "./components/Loader";
import MacGamesPanel from "./components/MacGamesPanel";
import SteamInput from "./components/SteamInput";
import TierList from "./components/TierList";
import type {
  ApiErrorResponse,
  DragItemData,
  SavedTierListState,
  SortMode,
  SteamGame,
  TierRowData
} from "./types/steam";
import { clearSavedState, loadSavedState, saveState } from "./utils/localStorage";
import { isPotentialSteamProfile, normalizeSteamInput } from "./utils/steamUrl";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const DEFAULT_ROWS: TierRowData[] = [
  { id: "tier-s", label: "S", color: "#ff5d73", gameIds: [] },
  { id: "tier-a", label: "A", color: "#ffb84d", gameIds: [] },
  { id: "tier-b", label: "B", color: "#5ad8a6", gameIds: [] },
  { id: "tier-c", label: "C", color: "#56c5ff", gameIds: [] },
  { id: "tier-d", label: "D", color: "#9b8cff", gameIds: [] },
  { id: "tier-f", label: "F", color: "#8b98a9", gameIds: [] }
];

const EXTRA_ROW_COLORS = ["#f87171", "#facc15", "#34d399", "#38bdf8", "#a78bfa", "#fb7185"];
const LANDING_COVERS = [730, 570, 292030, 1172470, 271590, 1086940, 1245620, 413150, 252490, 236390];

function createDefaultRows() {
  return DEFAULT_ROWS.map((row) => ({ ...row, gameIds: [] }));
}

function moveRow(rows: TierRowData[], activeRowId: string, targetRowId: string) {
  const oldIndex = rows.findIndex((row) => row.id === activeRowId);
  const newIndex = rows.findIndex((row) => row.id === targetRowId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return rows;
  }

  const nextRows = [...rows];
  const [movedRow] = nextRows.splice(oldIndex, 1);
  nextRows.splice(newIndex, 0, movedRow);

  return nextRows;
}

async function parseApiError(response: Response) {
  try {
    const data = (await response.json()) as ApiErrorResponse;
    return data.message ?? "Запрос завершился ошибкой.";
  } catch {
    return "Запрос завершился ошибкой.";
  }
}

export default function App() {
  const [profileInput, setProfileInput] = useState("");
  const [steamId64, setSteamId64] = useState("");
  const [games, setGames] = useState<SteamGame[]>([]);
  const [rows, setRows] = useState<TierRowData[]>(createDefaultRows);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [loading, setLoading] = useState(false);
  const [macLoading, setMacLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [macError, setMacError] = useState("");
  const [macGames, setMacGames] = useState<SteamGame[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [storageScope, setStorageScope] = useState("draft");
  const [hydrated, setHydrated] = useState(false);
  const [activeDragData, setActiveDragData] = useState<DragItemData | null>(null);
  const exportRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const listId = new URLSearchParams(window.location.search).get("list");

    if (listId) {
      const scopedKey = `list:${listId}`;
      setStorageScope(scopedKey);
      setLoading(true);
      fetch(`${API_BASE}/api/tierlists/${encodeURIComponent(listId)}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(await parseApiError(response));
          }

          return response.json() as Promise<SavedTierListState>;
        })
        .then((sharedState) => {
          const cachedState = loadSavedState(scopedKey);
          const nextState = cachedState ?? sharedState;

          setProfileInput(nextState.profileInput);
          setSteamId64(nextState.steamId64);
          setGames(nextState.games);
          setRows(nextState.rows.length > 0 ? nextState.rows : createDefaultRows());
          setShareUrl(window.location.href);
        })
        .catch((loadError) => {
          setError(loadError instanceof Error ? loadError.message : "Не удалось открыть сохраненный тир-лист.");
        })
        .finally(() => {
          setLoading(false);
          setHydrated(true);
        });
      return;
    }

    const saved = loadSavedState("draft");

    if (saved) {
      setProfileInput(saved.profileInput);
      setSteamId64(saved.steamId64);
      setGames(saved.games);
      setRows(saved.rows.length > 0 ? saved.rows : createDefaultRows());
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !steamId64 || games.length === 0) {
      return;
    }

    void loadMacGames(steamId64);
  }, [hydrated, steamId64]);

  useEffect(() => {
    if (!hydrated || (!steamId64 && games.length === 0)) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      saveState(buildCurrentState(), storageScope);
    }, 250);

    return () => window.clearTimeout(saveTimer);
  }, [games, hydrated, profileInput, rows, steamId64, storageScope]);

  function buildCurrentState(): SavedTierListState {
    return {
      profileInput,
      steamId64,
      games,
      rows,
      savedAt: new Date().toISOString()
    };
  }

  const gameById = useMemo(() => {
    return new Map(games.map((game) => [game.appid, game]));
  }, [games]);

  const usedGameIds = useMemo(() => {
    return new Set(rows.flatMap((row) => row.gameIds));
  }, [rows]);

  const visibleLibraryGames = useMemo(() => {
    const query = search.trim().toLowerCase();

    return games
      .filter((game) => !usedGameIds.has(game.appid))
      .filter((game) => (query ? game.name.toLowerCase().includes(query) : true))
      .sort((a, b) => {
        if (sortMode === "playtime-desc") {
          return b.playtime_forever - a.playtime_forever;
        }

        if (sortMode === "playtime-asc") {
          return a.playtime_forever - b.playtime_forever;
        }

        return a.name.localeCompare(b.name, "ru");
      });
  }, [games, search, sortMode, usedGameIds]);

  const visibleMacGames = useMemo(() => {
    return macGames
      .filter((game) => gameById.has(game.appid))
      .map((game) => ({
        ...game,
        customCover: gameById.get(game.appid)?.customCover ?? game.customCover
      }));
  }, [gameById, macGames]);

  async function loadMacGames(targetSteamId = steamId64) {
    if (!targetSteamId) {
      return;
    }

    setMacLoading(true);
    setMacError("");

    try {
      const response = await fetch(`${API_BASE}/api/mac-games?steamId=${encodeURIComponent(targetSteamId)}`);

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setMacGames((await response.json()) as SteamGame[]);
    } catch (loadError) {
      setMacError(loadError instanceof Error ? loadError.message : "Не удалось загрузить список Mac-игр.");
      setMacGames([]);
    } finally {
      setMacLoading(false);
    }
  }

  async function handleLoadGames(rawProfileUrl: string) {
    const normalizedProfile = normalizeSteamInput(rawProfileUrl);

    if (!isPotentialSteamProfile(normalizedProfile)) {
      setError("Введите ссылку вида steamcommunity.com/id/name, steamcommunity.com/profiles/steamid64 или SteamID64.");
      return;
    }

    setLoading(true);
    setError("");
    setShareUrl("");

    try {
      const resolveResponse = await fetch(
        `${API_BASE}/api/resolve?profileUrl=${encodeURIComponent(normalizedProfile)}`
      );

      if (!resolveResponse.ok) {
        throw new Error(await parseApiError(resolveResponse));
      }

      const { steamId64: resolvedSteamId } = (await resolveResponse.json()) as { steamId64: string };
      const gamesResponse = await fetch(`${API_BASE}/api/games?steamId=${encodeURIComponent(resolvedSteamId)}`);

      if (!gamesResponse.ok) {
        throw new Error(await parseApiError(gamesResponse));
      }

      const loadedGames = (await gamesResponse.json()) as SteamGame[];

      setProfileInput(normalizedProfile);
      setSteamId64(resolvedSteamId);
      setGames(loadedGames);
      setMacGames([]);
      setMacError("");
      setRows(createDefaultRows());
      setSearch("");
      setStorageScope(`profile:${resolvedSteamId}`);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Неизвестная ошибка загрузки.");
    } finally {
      setLoading(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragData((event.active.data.current as DragItemData | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id ? String(event.over.id) : "";
    const dragData = event.active.data.current as DragItemData | undefined;

    setActiveDragData(null);

    if (!overId || !dragData) {
      return;
    }

    if (dragData.type === "row") {
      if (overId.startsWith("tier:")) {
        setRows((currentRows) => moveRow(currentRows, dragData.rowId, overId.replace("tier:", "")));
      }
      return;
    }

    if (overId === "pool") {
      setRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          gameIds: row.gameIds.filter((gameId) => gameId !== dragData.appid)
        }))
      );
      return;
    }

    if (overId.startsWith("tier:")) {
      const targetRowId = overId.replace("tier:", "");

      setRows((currentRows) =>
        currentRows.map((row) => {
          const withoutDraggedGame = row.gameIds.filter((gameId) => gameId !== dragData.appid);

          if (row.id !== targetRowId) {
            return { ...row, gameIds: withoutDraggedGame };
          }

          return { ...row, gameIds: [...withoutDraggedGame, dragData.appid] };
        })
      );
    }
  }

  function handleDragCancel() {
    setActiveDragData(null);
  }

  function handleAddRow() {
    setRows((currentRows) => [
      ...currentRows,
      {
        id: `tier-custom-${Date.now()}`,
        label: "Новый",
        color: EXTRA_ROW_COLORS[currentRows.length % EXTRA_ROW_COLORS.length],
        gameIds: []
      }
    ]);
  }

  function handleRenameRow(rowId: string, label: string) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, label: label || " " } : row))
    );
  }

  function handleColorChange(rowId: string, color: string) {
    setRows((currentRows) => currentRows.map((row) => (row.id === rowId ? { ...row, color } : row)));
  }

  function handleRemoveRow(rowId: string) {
    setRows((currentRows) => (currentRows.length > 1 ? currentRows.filter((row) => row.id !== rowId) : currentRows));
  }

  function handleCoverUpload(appid: number, dataUrl: string) {
    setGames((currentGames) =>
      currentGames.map((game) => (game.appid === appid ? { ...game, customCover: dataUrl } : game))
    );
  }

  function handleRemoveGame(appid: number) {
    setGames((currentGames) => currentGames.filter((game) => game.appid !== appid));
    setRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        gameIds: row.gameIds.filter((gameId) => gameId !== appid)
      }))
    );
  }

  async function handleAddCustomGame(title: string) {
    const response = await fetch(`${API_BASE}/api/search-game?query=${encodeURIComponent(title)}`);

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    const game = (await response.json()) as SteamGame;

    if (games.some((currentGame) => currentGame.appid === game.appid)) {
      throw new Error("Эта игра уже есть в списке.");
    }

    setGames((currentGames) => [...currentGames, game].sort((a, b) => a.name.localeCompare(b.name, "ru")));
  }

  function handleResetTierList() {
    setRows(createDefaultRows());
  }

  function handleClearAll() {
    clearSavedState();
    setProfileInput("");
    setSteamId64("");
    setGames([]);
    setMacGames([]);
    setMacError("");
    setRows(createDefaultRows());
    setSearch("");
    setSortMode("name");
    setShareUrl("");
    setError("");
    setStorageScope("draft");
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function handleSaveShareLink() {
    if (!games.length) {
      return;
    }

    setSharing(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/tierlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCurrentState())
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const { id } = (await response.json()) as { id: string };
      const nextShareUrl = `${window.location.origin}${window.location.pathname}?list=${encodeURIComponent(id)}`;

      setShareUrl(nextShareUrl);
      setStorageScope(`list:${id}`);
      await navigator.clipboard?.writeText(nextShareUrl).catch(() => undefined);
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Не удалось сохранить ссылку.");
    } finally {
      setSharing(false);
    }
  }

  async function handleExportImage() {
    if (!exportRef.current) {
      return;
    }

    setExporting(true);
    setError("");
    document.body.classList.add("exportingTierImage");

    try {
      const dataUrl = await toPng(exportRef.current, {
        backgroundColor: "#0d141d",
        cacheBust: true,
        pixelRatio: 2
      });
      const link = document.createElement("a");
      link.download = `steam-tier-list-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("Не удалось экспортировать картинку. Попробуйте еще раз после загрузки всех обложек.");
    } finally {
      document.body.classList.remove("exportingTierImage");
      setExporting(false);
    }
  }

  const hasLoadedGames = games.length > 0;
  const activeDragGame = activeDragData?.type === "game" ? gameById.get(activeDragData.appid) : undefined;

  return (
    <div className={`appShell ${hasLoadedGames ? "hasWorkspace" : "landingOnly"}`}>
      <header className={`hero ${hasLoadedGames ? "heroCompact" : ""}`}>
        <div className="coverWall" aria-hidden="true">
          {LANDING_COVERS.map((appid) => (
            <img
              key={appid}
              src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900_2x.jpg`}
              alt=""
            />
          ))}
        </div>
        <div className="heroOverlay" />

        <div className="heroContent">
          <p className="brandLabel">Steam Tier List</p>
          <h1>Создай тир-лист своих игр Steam</h1>
          <p className="heroText">
            Вставьте ссылку на публичный профиль, загрузите библиотеку с обложками и разложите игры по уровням
            перетаскиванием.
          </p>

          <SteamInput initialValue={profileInput} loading={loading} onSubmit={handleLoadGames} />

          {loading ? <Loader label={hasLoadedGames ? "Открываю сохраненный тир-лист..." : "Загружаю игры..."} /> : null}
          {error ? <ErrorMessage message={error} onClose={() => setError("")} /> : null}
        </div>
      </header>

      {hasLoadedGames ? (
        <main className="workspace">
          <div className="workspaceToolbar">
            <div>
              <p className="eyebrow">Профиль</p>
              <h2>{steamId64}</h2>
            </div>
            <div className="toolbarActions">
              <button className="secondaryButton" type="button" onClick={handleSaveShareLink} disabled={sharing}>
                <Link2 size={18} aria-hidden="true" />
                {sharing ? "Сохраняю..." : "Сохранить ссылку"}
              </button>
              <button className="secondaryButton" type="button" onClick={handleExportImage} disabled={exporting}>
                <Download size={18} aria-hidden="true" />
                {exporting ? "Экспорт..." : "Экспорт PNG"}
              </button>
              <button className="secondaryButton" type="button" onClick={handleResetTierList}>
                <RotateCcw size={18} aria-hidden="true" />
                Сбросить тир-лист
              </button>
              <button className="secondaryButton dangerTextButton" type="button" onClick={handleClearAll}>
                <Trash2 size={18} aria-hidden="true" />
                Очистить все данные
              </button>
            </div>
          </div>

          {shareUrl ? (
            <div className="shareBox" role="status">
              <span>Ссылка сохранена и скопирована:</span>
              <a href={shareUrl}>{shareUrl}</a>
            </div>
          ) : null}

          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <div className="workspaceBoard">
              <TierList
                rows={rows}
                gameById={gameById}
                exportRef={exportRef}
                onAddRow={handleAddRow}
                onRenameRow={handleRenameRow}
                onColorChange={handleColorChange}
                onRemoveRow={handleRemoveRow}
                onCoverUpload={handleCoverUpload}
                onRemoveGame={handleRemoveGame}
              />
              <div className="sidePanelStack">
                <MacGamesPanel
                  games={visibleMacGames}
                  totalCount={games.length}
                  loading={macLoading}
                  error={macError}
                  onRefresh={() => loadMacGames()}
                />
                <GameList
                  games={visibleLibraryGames}
                  search={search}
                  sortMode={sortMode}
                  totalCount={games.length}
                  onSearchChange={setSearch}
                  onSortChange={setSortMode}
                  onCoverUpload={handleCoverUpload}
                  onRemoveGame={handleRemoveGame}
                  onAddCustomGame={handleAddCustomGame}
                />
              </div>
            </div>
            <DragOverlay dropAnimation={null}>
              {activeDragGame ? (
                <div className="dragOverlayCard">
                  <img src={activeDragGame.customCover ?? activeDragGame.cover} alt="" />
                  <span>{activeDragGame.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>
      ) : null}
    </div>
  );
}
