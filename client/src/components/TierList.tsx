import { Plus } from "lucide-react";
import type { RefObject } from "react";
import type { SteamGame, TierRowData } from "../types/steam";
import TierRow from "./TierRow";

interface TierListProps {
  rows: TierRowData[];
  gameById: Map<number, SteamGame>;
  exportRef: RefObject<HTMLElement>;
  onAddRow: () => void;
  onRenameRow: (rowId: string, label: string) => void;
  onColorChange: (rowId: string, color: string) => void;
  onRemoveRow: (rowId: string) => void;
  onCoverUpload: (appid: number, dataUrl: string) => void;
  onRemoveGame: (appid: number) => void;
}

export default function TierList({
  rows,
  gameById,
  exportRef,
  onAddRow,
  onRenameRow,
  onColorChange,
  onRemoveRow,
  onCoverUpload,
  onRemoveGame
}: TierListProps) {
  return (
    <section className="tierListPanel exportTierList" ref={exportRef}>
      <div className="sectionHeader tierControls">
        <div>
          <p className="eyebrow">Tier List</p>
          <h2>Расставьте игры по уровням</h2>
        </div>
        <button className="secondaryButton" type="button" onClick={onAddRow}>
          <Plus size={18} aria-hidden="true" />
          Добавить строку
        </button>
      </div>

      <div className="tierRows">
        {rows.map((row) => (
          <TierRow
            key={row.id}
            row={row}
            games={row.gameIds.map((gameId) => gameById.get(gameId)).filter(Boolean) as SteamGame[]}
            canRemove={rows.length > 1}
            onRename={onRenameRow}
            onColorChange={onColorChange}
            onRemove={onRemoveRow}
            onCoverUpload={onCoverUpload}
            onRemoveGame={onRemoveGame}
          />
        ))}
      </div>
    </section>
  );
}
