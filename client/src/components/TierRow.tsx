import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical, Trash2 } from "lucide-react";
import type { CSSProperties, SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import type { SteamGame, TierRowData } from "../types/steam";
import GameCard from "./GameCard";

interface TierRowProps {
  row: TierRowData;
  games: SteamGame[];
  canRemove: boolean;
  onRename: (rowId: string, label: string) => void;
  onColorChange: (rowId: string, color: string) => void;
  onRemove: (rowId: string) => void;
  onCoverUpload: (appid: number, dataUrl: string) => void;
  onRemoveGame: (appid: number) => void;
}

function getTierLabelFontSize(label: string) {
  const length = label.trim().length;

  if (length <= 1) {
    return "2.35rem";
  }

  if (length <= 2) {
    return "2rem";
  }

  if (length <= 4) {
    return "1.55rem";
  }

  if (length <= 8) {
    return "1.2rem";
  }

  if (length <= 16) {
    return "0.96rem";
  }

  if (length <= 28) {
    return "0.82rem";
  }

  return "0.72rem";
}

export default function TierRow({
  row,
  games,
  canRemove,
  onRename,
  onColorChange,
  onRemove,
  onCoverUpload,
  onRemoveGame
}: TierRowProps) {
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({ id: `tier:${row.id}` });
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: `row:${row.id}`,
    data: { type: "row", rowId: row.id }
  });
  const [localColor, setLocalColor] = useState(row.color);

  useEffect(() => {
    setLocalColor(row.color);
  }, [row.color]);

  function stopControlDrag(event: SyntheticEvent) {
    event.stopPropagation();
  }

  function commitLocalColor() {
    if (localColor !== row.color) {
      onColorChange(row.id, localColor);
    }
  }

  const style: CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
      }
    : {};

  return (
    <div
      className={`tierRow ${isOver ? "dropActive" : ""} ${isDragging ? "rowDragging" : ""}`}
      ref={setDragNodeRef}
      style={style}
    >
      <button
        className="rowDragHandle"
        type="button"
        aria-label="Переместить строку"
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>

      <div className="tierLabel" style={{ backgroundColor: localColor }}>
        <textarea
          value={row.label}
          onChange={(event) => onRename(row.id, event.target.value)}
          onPointerDown={stopControlDrag}
          aria-label="Название тира"
          maxLength={48}
          rows={4}
          style={{ fontSize: getTierLabelFontSize(row.label) }}
        />
        <input
          className="tierColorInput"
          type="color"
          value={localColor}
          onPointerDown={stopControlDrag}
          onChange={(event) => setLocalColor(event.target.value)}
          onBlur={commitLocalColor}
          aria-label="Цвет строки"
          title="Цвет строки"
        />
      </div>

      <div className="tierDropZone" ref={setDropNodeRef}>
        {games.length > 0 ? (
          games.map((game) => (
            <GameCard
              key={game.appid}
              game={game}
              compact
              dragId={`tier:${row.id}:${game.appid}`}
              data={{ type: "game", appid: game.appid, source: "tier", tierId: row.id }}
              onCoverUpload={onCoverUpload}
              onRemoveGame={onRemoveGame}
            />
          ))
        ) : (
          <span className="tierHint">Перетащите игры сюда</span>
        )}
      </div>

      <button
        className="iconButton dangerButton"
        type="button"
        onClick={() => onRemove(row.id)}
        disabled={!canRemove}
        aria-label="Удалить строку"
        title="Удалить строку"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
