import { useDraggable } from "@dnd-kit/core";
import { Clock3, ImagePlus, Trash2 } from "lucide-react";
import type { ChangeEvent, CSSProperties, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { DragGameData, SteamGame } from "../types/steam";
import { formatPlaytime } from "../utils/steamUrl";

interface GameCardProps {
  game: SteamGame;
  dragId: string;
  data: DragGameData;
  compact?: boolean;
  onCoverUpload?: (appid: number, dataUrl: string) => void;
  onRemoveGame?: (appid: number) => void;
}

type ImageMode = "cover" | "header" | "placeholder";

function createCompressedCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxWidth = 600;
      const maxHeight = 900;
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas is not available"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };

    image.src = objectUrl;
  });
}

function getInitials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "ST";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function GameCard({
  game,
  dragId,
  data,
  compact = false,
  onCoverUpload,
  onRemoveGame
}: GameCardProps) {
  const [imageMode, setImageMode] = useState<ImageMode>("cover");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data
  });

  useEffect(() => {
    setImageMode("cover");
  }, [game.appid, game.customCover]);

  const style: CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
      }
    : {};

  const imageSrc =
    game.customCover ??
    (imageMode === "cover"
      ? game.cover
      : `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`);

  function handleImageError() {
    if (game.customCover) {
      setImageMode("placeholder");
      return;
    }

    setImageMode((current) => (current === "cover" ? "header" : "placeholder"));
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    try {
      onCoverUpload?.(game.appid, await createCompressedCover(file));
      setImageMode("cover");
    } finally {
      event.target.value = "";
    }
  }

  function stopDrag(event: SyntheticEvent) {
    event.stopPropagation();
  }

  function openCoverPicker(event: SyntheticEvent) {
    stopDrag(event);
    fileInputRef.current?.click();
  }

  return (
    <article
      ref={setNodeRef}
      className={`gameCard ${compact ? "gameCardCompact" : ""} ${imageMode === "placeholder" ? "hasPlaceholderCover" : ""} ${isDragging ? "isDragging" : ""}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className="gameCover">
        <div className="gameCardActions">
          {onCoverUpload ? (
            <button
              className="cardIconButton"
              type="button"
              onPointerDown={stopDrag}
              onClick={openCoverPicker}
              aria-label={`Сменить обложку для ${game.name}`}
              title="Сменить обложку"
            >
              <ImagePlus size={15} aria-hidden="true" />
            </button>
          ) : null}
          {onRemoveGame ? (
            <button
              className="cardIconButton dangerCardButton"
              type="button"
              onPointerDown={stopDrag}
              onClick={(event) => {
                stopDrag(event);
                onRemoveGame(game.appid);
              }}
              aria-label={`Удалить ${game.name} из текущего тир-листа`}
              title="Удалить из текущего тир-листа"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {onCoverUpload ? (
          <input
            ref={fileInputRef}
            className="visuallyHidden"
            type="file"
            accept="image/*"
            onPointerDown={stopDrag}
            onClick={stopDrag}
            onChange={handleFileChange}
            aria-label={`Загрузить обложку для ${game.name}`}
          />
        ) : null}

        {imageMode === "placeholder" ? (
          <div className="coverPlaceholder">
            <div className="placeholderBadge">{getInitials(game.name)}</div>
            <span className="placeholderTitle">{game.name}</span>
          </div>
        ) : (
          <img src={imageSrc} alt={game.name} loading="lazy" onError={handleImageError} />
        )}
      </div>
      <div className="gameMeta">
        <h3 title={game.name}>{game.name}</h3>
        <span className="playtimeLabel">
          <Clock3 size={14} aria-hidden="true" />
          {formatPlaytime(game.playtime_forever)}
        </span>
      </div>
    </article>
  );
}
