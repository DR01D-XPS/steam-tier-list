import { Download, Link } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

interface SteamInputProps {
  initialValue: string;
  loading: boolean;
  onSubmit: (profileUrl: string) => void;
}

export default function SteamInput({ initialValue, loading, onSubmit }: SteamInputProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(value);
  }

  return (
    <form className="steamInput" onSubmit={handleSubmit}>
      <label htmlFor="steam-profile">Steam-профиль</label>
      <div className="inputRow">
        <div className="inputShell">
          <Link size={18} aria-hidden="true" />
          <input
            id="steam-profile"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://steamcommunity.com/id/username"
            autoComplete="url"
          />
        </div>
        <button className="primaryButton" type="submit" disabled={loading || !value.trim()}>
          <Download size={18} aria-hidden="true" />
          {loading ? "Загрузка..." : "Загрузить игры"}
        </button>
      </div>
      <div className="notice">Профиль Steam должен быть публичным</div>
    </form>
  );
}
