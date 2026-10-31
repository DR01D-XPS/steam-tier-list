# Steam Tier List

Веб-приложение для создания тир-листа по играм из публичной библиотеки Steam. Пользователь вставляет ссылку на профиль, приложение загружает игры через официальный Steam Web API и дает разложить их по тирам через drag-and-drop.

## Что внутри

- Frontend: React, TypeScript, Vite
- Drag and Drop: `@dnd-kit/core`
- Backend: Node.js, Express, TypeScript
- Steam API: `ResolveVanityURL` и `GetOwnedGames`
- Сохранение состояния: `localStorage`

## Установка

```bash
npm install
```

## Steam API Key

1. Получите ключ на странице Steam Web API: https://steamcommunity.com/dev/apikey
2. Создайте файл `server/.env`
3. Добавьте в него ключ:

```env
STEAM_API_KEY=your_key_here
PORT=3001
```

Пример лежит в `server/.env.example`.

## Запуск

Запустить frontend и backend одной командой из корня:

```bash
npm run dev
```

После запуска:

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

Можно запускать отдельно:

```bash
npm run dev --workspace client
npm run dev --workspace server
```

## Сборка

```bash
npm run build
```

## API

### `GET /api/resolve?profileUrl=...`

Принимает:

- `https://steamcommunity.com/id/customname`
- `https://steamcommunity.com/profiles/steamid64`
- `steamid64`

Возвращает:

```json
{
  "steamId64": "7656119..."
}
```

### `GET /api/games?steamId=...`

Возвращает игры:

```json
[
  {
    "appid": 730,
    "name": "Counter-Strike 2",
    "playtime_forever": 1234,
    "cover": "https://cdn.cloudflare.steamstatic.com/steam/apps/730/library_600x900_2x.jpg"
  }
]
```

## Важно

Профиль Steam и список игр должны быть публичными. Если профиль закрыт, игры скрыты, ключ Steam API отсутствует или Steam API вернул лимит запросов, приложение покажет понятную ошибку в интерфейсе.
