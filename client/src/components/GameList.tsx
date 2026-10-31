import { useDroppable } from "@dnd-kit/core";
import { Plus, Search } from "lucide-react";
import { FormEvent, useState } from "react";
import type { SortMode, SteamGame } from "../types/steam";
import GameCard from "./GameCard";

interface GameListProps {
  games: SteamGame[];
  search: string;
  sortMode: SortMode;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortMode) => void;
  onCoverUpload: (appid: number, dataUrl: string) => void;
  onRemoveGame: (appid: number) => void;
  onAddCustomGame: (title: string) => Promise<void>;
}

export default function GameList({
  games,
  search,
  sortMode,
  totalCount,
  onSearchChange,
  onSortChange,
  onCoverUpload,
  onRemoveGame,
  onAddCustomGame
}: GameListProps) {
  const { isOver, setNodeRef } = useDroppable({ id: "pool" });
  const [customTitle, setCustomTitle] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState("");

  async function handleAddCustomGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = customTitle.trim();

    if (!title || customLoading) {
      return;
    }

    setCustomLoading(true);
    setCustomError("");

    try {
      await onAddCustomGame(title);
      setCustomTitle("");
    } catch (error) {
      setCustomError(error instanceof Error ? error.message : "Не удалось добавить игру.");
    } finally {
      setCustomLoading(false);
    }
  }

  return (
    <section ref={setNodeRef} className={`libraryPanel ${isOver ? "dropActive" : ""}`}>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Библиотека</p>
          <h2>Список игр</h2>
        </div>
        <span className="gameCounter">
          {games.length} из {totalCount}
        </span>
      </div>

      <form className="customGameForm" onSubmit={handleAddCustomGame}>
        <label htmlFor="custom-game-title">Добавить игру из Steam</label>
        <div className="customGameRow">
          <input
            id="custom-game-title"
            value={customTitle}
            onChange={(event) => setCustomTitle(event.target.value)}
            placeholder="Например: Hades"
          />
          <button className="secondaryButton" type="submit" disabled={!customTitle.trim() || customLoading}>
            <Plus size={17} aria-hidden="true" />
            {customLoading ? "Ищу..." : "Добавить"}
          </button>
        </div>
        {customError ? <p className="inlineError">{customError}</p> : null}
      </form>

      <div className="libraryControls">
        <div className="searchBox">
          <Search size={18} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Поиск по названию"
          />
        </div>
        <select
          value={sortMode}
          onChange={(event) => onSortChange(event.target.value as SortMode)}
          aria-label="Сортировка игр"
        >
          <option value="name">По названию</option>
          <option value="playtime-desc">Сначала больше времени</option>
          <option value="playtime-asc">Сначала меньше времени</option>
        </select>
      </div>

      {games.length > 0 ? (
        <div className="gameGrid">
          {games.map((game) => (
            <GameCard
              key={game.appid}
              game={game}
              dragId={`pool:${game.appid}`}
              data={{ type: "game", appid: game.appid, source: "pool" }}
              onCoverUpload={onCoverUpload}
              onRemoveGame={onRemoveGame}
            />
          ))}
        </div>
      ) : (
        <div className="emptyState">
          {search ? "По этому запросу ничего не найдено" : "Все игры уже распределены по тирам"}
        </div>
      )}
    </section>
  );
}
