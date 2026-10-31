import { Monitor, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { SteamGame } from "../types/steam";

interface MacGamesPanelProps {
  games: SteamGame[];
  totalCount: number;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

type ImageMode = "cover" | "header" | "placeholder";

function MacGameCard({ game }: { game: SteamGame }) {
  const [imageMode, setImageMode] = useState<ImageMode>("cover");
  const imageSrc =
    imageMode === "cover"
      ? game.customCover ?? game.cover
      : `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;

  function handleImageError() {
    setImageMode((current) => (current === "cover" ? "header" : "placeholder"));
  }

  return (
    <article className="macGameCard">
      <div className="macGameCover">
        {imageMode === "placeholder" ? (
          <span>{game.name.slice(0, 2).toUpperCase()}</span>
        ) : (
          <img src={imageSrc} alt={game.name} loading="lazy" onError={handleImageError} />
        )}
      </div>
      <div>
        <h3 title={game.name}>{game.name}</h3>
        <p>macOS</p>
      </div>
    </article>
  );
}

export default function MacGamesPanel({ games, totalCount, loading, error, onRefresh }: MacGamesPanelProps) {
  const [query, setQuery] = useState("");
  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return normalizedQuery
      ? games.filter((game) => game.name.toLowerCase().includes(normalizedQuery))
      : games;
  }, [games, query]);
  const percent = totalCount > 0 ? Math.round((games.length / totalCount) * 100) : 0;

  return (
    <section className="macPanel">
      <div className="macPanelHeader">
        <div className="macPanelIcon" aria-hidden="true">
          <Monitor size={20} />
        </div>
        <div>
          <p className="eyebrow">macOS</p>
          <h2>Игры для Mac</h2>
        </div>
        <button className="iconButton" type="button" onClick={onRefresh} disabled={loading} aria-label="Обновить список Mac-игр">
          <RefreshCw size={17} className={loading ? "spinIcon" : ""} />
        </button>
      </div>

      <div className="macStats">
        <strong>{loading ? "..." : games.length}</strong>
        <span>из {totalCount} игр поддерживают macOS</span>
        <em>{percent}%</em>
      </div>

      {error ? <p className="inlineError">{error}</p> : null}

      <div className="searchBox macSearchBox">
        <Search size={17} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск среди Mac-игр"
          disabled={loading || games.length === 0}
        />
      </div>

      {loading ? (
        <div className="macSkeletonGrid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : filteredGames.length > 0 ? (
        <div className="macGameGrid">
          {filteredGames.map((game) => (
            <MacGameCard key={game.appid} game={game} />
          ))}
        </div>
      ) : (
        <div className="emptyState">{query ? "По этому запросу Mac-игр не найдено" : "Mac-игры пока не найдены"}</div>
      )}
    </section>
  );
}
