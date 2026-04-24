# Battleship Server

Self-hosted backend for the Battleship game. Node.js + WebSocket (`ws`) + SQLite (`better-sqlite3`).

## Run locally

```bash
cd server
npm install
npm start         # listens on :8080
# or with auto-reload:
npm run dev
```

Then in the Lovable frontend, set `VITE_WS_URL=ws://localhost:8080`.

## Environment variables

| Var       | Default                  | Description                         |
| --------- | ------------------------ | ----------------------------------- |
| `PORT`    | `8080`                   | HTTP/WebSocket port                 |
| `DB_PATH` | `./data/battleship.db`   | SQLite database file path           |

## Endpoints

- `GET /health` — returns `{ ok: true }`
- `WS /` — game protocol (JSON messages, see `src/index.js`)

## Deploying

### Fly.io
```bash
fly launch --no-deploy
fly volumes create battleship_data --size 1
# add to fly.toml:
#   [[mounts]]
#   source = "battleship_data"
#   destination = "/data"
# set DB_PATH=/data/battleship.db
fly deploy
```

### Railway / Render / VPS
Any host that supports a long-running Node process and persistent disk for the SQLite file works. Set `PORT` (most platforms inject this) and point `DB_PATH` to a persistent volume.

### CORS / WSS
WebSockets do not require CORS. For production, terminate TLS at your host's load balancer so the frontend can connect via `wss://`.

## Protocol

Client → Server messages (JSON):
- `{ type: "create" }`
- `{ type: "join", code }`
- `{ type: "reconnect", sessionId }`
- `{ type: "place", board: [...] }`
- `{ type: "fire", x, y }`
- `{ type: "rematch" }`

Server → Client:
- `{ type: "joined", code, sessionId, slot }`
- `{ type: "state", state: {...} }`  — full sanitised view, broadcast on every change
- `{ type: "error", message }`
