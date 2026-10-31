import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getTierList, saveTierList, validateTierListState } from "./tierListStore.js";
import { getMacSupportedGames, getOwnedGames, resolveSteamId, searchSteamGameByName, SteamApiError } from "./steamApi.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;
const clientDistDir = process.env.CLIENT_DIST_DIR ?? join(process.cwd(), "..", "client", "dist");

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/resolve", async (req, res, next) => {
  try {
    const profileUrl = String(req.query.profileUrl ?? "");
    const steamId64 = await resolveSteamId(profileUrl);

    res.json({ steamId64 });
  } catch (error) {
    next(error);
  }
});

app.get("/api/games", async (req, res, next) => {
  try {
    const steamId = String(req.query.steamId ?? "");
    const games = await getOwnedGames(steamId);

    res.json(games);
  } catch (error) {
    next(error);
  }
});

app.get("/api/mac-games", async (req, res, next) => {
  try {
    const steamId = String(req.query.steamId ?? "");
    const games = await getMacSupportedGames(steamId);

    res.json(games);
  } catch (error) {
    next(error);
  }
});

app.get("/api/search-game", async (req, res, next) => {
  try {
    const query = String(req.query.query ?? "");
    const game = await searchSteamGameByName(query);

    res.json(game);
  } catch (error) {
    next(error);
  }
});

app.post("/api/tierlists", async (req, res, next) => {
  try {
    const state = validateTierListState(req.body);
    const record = await saveTierList(state);

    res.status(201).json({ id: record.id, savedAt: record.createdAt });
  } catch (error) {
    next(error);
  }
});

app.get("/api/tierlists/:id", async (req, res, next) => {
  try {
    const record = await getTierList(req.params.id);

    if (!record) {
      res.status(404).json({
        code: "TIER_LIST_NOT_FOUND",
        message: "Тир-лист по этой ссылке не найден."
      });
      return;
    }

    res.json(record.state);
  } catch (error) {
    next(error);
  }
});

if (existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(join(clientDistDir, "index.html"));
  });
}

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof SteamApiError) {
      res.status(error.status).json({
        code: error.code,
        message: error.publicMessage
      });
      return;
    }

    console.error(error);
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "На сервере произошла ошибка. Попробуйте еще раз."
    });
  }
);

app.listen(port, () => {
  console.log(`Steam tier list API is running on http://localhost:${port}`);
});
