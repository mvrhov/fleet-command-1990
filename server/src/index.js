import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import { db } from "./db.js";
import {
  FLEET,
  applyShot,
  generateCode,
  generateId,
  isFleetSunk,
  validateBoard,
} from "./game.js";

const PORT = Number(process.env.PORT) || 8080;
const STATIC_DIR = process.env.STATIC_DIR || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const target = path.normalize(path.join(root, decoded));
  if (!target.startsWith(path.resolve(root))) return null;
  return target;
}

function serveStatic(req, res) {
  if (!STATIC_DIR) return false;
  const root = path.resolve(STATIC_DIR);
  if (!fs.existsSync(root)) {
    console.warn(`[static] STATIC_DIR ${root} does not exist`);
    return false;
  }

  let filePath = safeJoin(root, req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  try {
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (stat && stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    if (!fs.existsSync(filePath)) {
      // SPA fallback
      filePath = path.join(root, "index.html");
      if (!fs.existsSync(filePath)) return false;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch {
    res.writeHead(500);
    res.end("Server error");
    return true;
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (serveStatic(req, res)) return;
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Battleship server. Connect via WebSocket.");
});

const wss = new WebSocketServer({ server });

// Map of gameId -> Map of slot -> ws
const connections = new Map();

function attach(gameId, slot, ws) {
  if (!connections.has(gameId)) connections.set(gameId, new Map());
  const m = connections.get(gameId);
  // close previous socket on same slot
  const prev = m.get(slot);
  if (prev && prev !== ws && prev.readyState === 1) {
    try { prev.close(4000, "Replaced by new connection"); } catch {}
  }
  m.set(slot, ws);
}

function getGame(code) {
  return db.prepare("SELECT * FROM games WHERE code = ?").get(code);
}
function getGameById(id) {
  return db.prepare("SELECT * FROM games WHERE id = ?").get(id);
}
function getPlayers(gameId) {
  return db.prepare("SELECT * FROM players WHERE game_id = ? ORDER BY slot").all(gameId);
}
function getPlayer(gameId, slot) {
  return db.prepare("SELECT * FROM players WHERE game_id = ? AND slot = ?").get(gameId, slot);
}
function getPlayerBySession(sessionId) {
  return db.prepare("SELECT * FROM players WHERE session_id = ? ORDER BY rowid DESC LIMIT 1").get(sessionId);
}

function parsePlayer(p) {
  if (!p) return null;
  return {
    ...p,
    board: p.board ? JSON.parse(p.board) : null,
    shots: JSON.parse(p.shots || "[]"),
    ready: !!p.ready,
  };
}

// Build state visible to a given slot (hides opponent's ship positions)
function viewFor(gameId, slot) {
  const game = getGameById(gameId);
  if (!game) return null;
  const players = getPlayers(gameId).map(parsePlayer);
  const me = players.find((p) => p.slot === slot);
  const opp = players.find((p) => p.slot !== slot);

  // Compute opponent fleet status (sunk ships visible from your shots)
  let opponentFleetStatus = FLEET.map((s) => ({ id: s.id, name: s.name, size: s.size, sunk: false }));
  if (opp?.board) {
    opponentFleetStatus = opp.board.map((ship) => ({
      id: ship.id,
      name: ship.name,
      size: ship.size,
      sunk: (ship.hits?.length || 0) === ship.size,
    }));
  }

  // Reveal opponent's full board only when game is finished
  const revealOpponentBoard = game.status === "finished";

  return {
    code: game.code,
    status: game.status,
    currentTurn: game.current_turn,
    winner: game.winner,
    yourSlot: slot,
    you: {
      board: me?.board || null,
      shots: me?.shots || [],
      ready: me?.ready || false,
    },
    opponent: {
      connected: !!opp,
      shots: opp?.shots || [],
      ready: opp?.ready || false,
      fleetStatus: opponentFleetStatus,
      board: revealOpponentBoard ? opp?.board || null : null,
    },
    fleet: FLEET,
  };
}

function broadcast(gameId) {
  const m = connections.get(gameId);
  if (!m) return;
  for (const [slot, ws] of m.entries()) {
    if (ws.readyState !== 1) continue;
    const state = viewFor(gameId, slot);
    if (state) ws.send(JSON.stringify({ type: "state", state }));
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function err(ws, message) {
  send(ws, { type: "error", message });
}

// Handlers
function handleCreate(ws, _msg) {
  let code;
  for (let i = 0; i < 10; i++) {
    code = generateCode();
    if (!getGame(code)) break;
    code = null;
  }
  if (!code) return err(ws, "Could not allocate code");
  const id = generateId();
  const sessionId = generateId();
  db.prepare(
    "INSERT INTO games (id, code, status, created_at) VALUES (?, ?, 'placing', ?)",
  ).run(id, code, Date.now());
  db.prepare(
    "INSERT INTO players (game_id, slot, session_id) VALUES (?, 1, ?)",
  ).run(id, sessionId);
  ws.gameId = id;
  ws.slot = 1;
  ws.sessionId = sessionId;
  attach(id, 1, ws);
  send(ws, { type: "joined", code, sessionId, slot: 1 });
  broadcast(id);
}

function handleJoin(ws, msg) {
  const code = String(msg.code || "").toUpperCase().trim();
  const game = getGame(code);
  if (!game) return err(ws, "Game not found");
  const players = getPlayers(game.id);
  if (players.length >= 2) return err(ws, "Game is full");
  const sessionId = generateId();
  db.prepare(
    "INSERT INTO players (game_id, slot, session_id) VALUES (?, 2, ?)",
  ).run(game.id, sessionId);
  ws.gameId = game.id;
  ws.slot = 2;
  ws.sessionId = sessionId;
  attach(game.id, 2, ws);
  send(ws, { type: "joined", code, sessionId, slot: 2 });
  broadcast(game.id);
}

function handleReconnect(ws, msg) {
  const sessionId = String(msg.sessionId || "");
  const p = getPlayerBySession(sessionId);
  if (!p) return err(ws, "Session not found");
  const game = getGameById(p.game_id);
  if (!game) return err(ws, "Game expired");
  ws.gameId = p.game_id;
  ws.slot = p.slot;
  ws.sessionId = sessionId;
  attach(p.game_id, p.slot, ws);
  send(ws, { type: "joined", code: game.code, sessionId, slot: p.slot });
  broadcast(p.game_id);
}

function handlePlace(ws, msg) {
  if (!ws.gameId) return err(ws, "Not in a game");
  const game = getGameById(ws.gameId);
  if (!game || game.status !== "placing") return err(ws, "Cannot place now");
  const board = msg.board;
  if (!validateBoard(board)) return err(ws, "Invalid fleet placement");
  const cleanBoard = board.map((s) => ({ ...s, hits: [] }));
  db.prepare(
    "UPDATE players SET board = ?, ready = 1 WHERE game_id = ? AND slot = ?",
  ).run(JSON.stringify(cleanBoard), ws.gameId, ws.slot);

  const players = getPlayers(ws.gameId).map(parsePlayer);
  if (players.length === 2 && players.every((p) => p.ready)) {
    const first = Math.random() < 0.5 ? 1 : 2;
    db.prepare("UPDATE games SET status = 'playing', current_turn = ? WHERE id = ?").run(first, ws.gameId);
  }
  broadcast(ws.gameId);
}

function handleFire(ws, msg) {
  if (!ws.gameId) return err(ws, "Not in a game");
  const game = getGameById(ws.gameId);
  if (!game || game.status !== "playing") return err(ws, "Game not in play");
  if (game.current_turn !== ws.slot) return err(ws, "Not your turn");
  const x = Number(msg.x);
  const y = Number(msg.y);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 9 || y < 0 || y > 9)
    return err(ws, "Invalid coords");
  const me = parsePlayer(getPlayer(ws.gameId, ws.slot));
  if (me.shots.some((s) => s.x === x && s.y === y)) return err(ws, "Already fired there");
  const oppSlot = ws.slot === 1 ? 2 : 1;
  const opp = parsePlayer(getPlayer(ws.gameId, oppSlot));
  const result = applyShot(opp.board, x, y);
  const newShots = [...me.shots, { x, y, result: result.result, sunk: result.sunk, shipName: result.shipName }];
  db.prepare("UPDATE players SET shots = ? WHERE game_id = ? AND slot = ?")
    .run(JSON.stringify(newShots), ws.gameId, ws.slot);
  db.prepare("UPDATE players SET board = ? WHERE game_id = ? AND slot = ?")
    .run(JSON.stringify(opp.board), ws.gameId, oppSlot);

  if (isFleetSunk(opp.board)) {
    db.prepare("UPDATE games SET status = 'finished', winner = ? WHERE id = ?").run(ws.slot, ws.gameId);
  } else if (result.result === "miss") {
    db.prepare("UPDATE games SET current_turn = ? WHERE id = ?").run(oppSlot, ws.gameId);
  }
  // hit -> keep current_turn
  broadcast(ws.gameId);
}

function handleRematch(ws) {
  if (!ws.gameId) return err(ws, "Not in a game");
  const game = getGameById(ws.gameId);
  if (!game || game.status !== "finished") return err(ws, "Game not finished");
  db.prepare("UPDATE games SET status = 'placing', current_turn = NULL, winner = NULL WHERE id = ?").run(ws.gameId);
  db.prepare("UPDATE players SET board = NULL, shots = '[]', ready = 0 WHERE game_id = ?").run(ws.gameId);
  broadcast(ws.gameId);
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return err(ws, "Invalid JSON"); }
    try {
      switch (msg.type) {
        case "create": return handleCreate(ws, msg);
        case "join": return handleJoin(ws, msg);
        case "reconnect": return handleReconnect(ws, msg);
        case "place": return handlePlace(ws, msg);
        case "fire": return handleFire(ws, msg);
        case "rematch": return handleRematch(ws);
        case "ping": return send(ws, { type: "pong" });
        default: return err(ws, "Unknown message type");
      }
    } catch (e) {
      console.error("Handler error:", e);
      err(ws, "Server error");
    }
  });

  ws.on("close", () => {
    if (ws.gameId && ws.slot) {
      const m = connections.get(ws.gameId);
      if (m && m.get(ws.slot) === ws) m.delete(ws.slot);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Battleship server listening on :${PORT}`);
  if (STATIC_DIR) {
    const root = path.resolve(STATIC_DIR);
    console.log(`[static] Serving from ${root} (exists: ${fs.existsSync(root)})`);
  } else {
    console.log(`[static] STATIC_DIR not set — static serving disabled`);
  }
});
