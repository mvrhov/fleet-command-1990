## Battleship — Online Two-Player

A web-based Battleship game (Milton Bradley 1990 nomenclature). Two players connect online via a 4-character room code. Modern clean nautical look.

### Backend — self-hosted Node.js server

Located in `/server` (separate from the Lovable frontend). Stack:
- Node.js 20+
- `ws` for WebSocket transport
- `better-sqlite3` for persistent game state (single `battleship.db` file)
- No framework; tiny `http` + `ws` server.

The user deploys this server themselves on Fly.io / Railway / a VPS. The frontend reads `VITE_WS_URL` to know where to connect (e.g. `wss://battleship.example.com`).

Server responsibilities (all authoritative — clients cannot cheat):
- `create` → new game with 4-char code (no 0/O/1/I), assigns slot 1, returns sessionId.
- `join` → joins by code as slot 2, returns sessionId.
- `reconnect` → re-attach using sessionId.
- `place` → store fleet placement, mark ready; when both ready, transition to `playing`, randomly pick first turn.
- `fire` → validate it's caller's turn, compute hit/miss/sunk, apply "shoot again on hit" rule, check win, broadcast.
- `rematch` → reset boards, swap or keep code, status → `placing`.

SQLite tables:
- `games(id, code UNIQUE, status, current_turn, winner, created_at)`
- `players(game_id, slot, session_id, board JSON, shots JSON, ready)`

Broadcasts: every state change pushes a `state` message (sanitised per recipient — opponent's board never includes ship positions, only revealed shots) to both connected sockets.

### Game rules
- 10×10 grid, columns A–J, rows 1–10.
- Fleet: Carrier(5), Battleship(4), Cruiser(3), Submarine(3), Destroyer(2).
- Horizontal/vertical placement, no overlap, no off-board.
- Shoot again on HIT; turn passes on MISS.
- Sunk notification: "You sunk my Battleship!".
- Win when opponent's fleet fully sunk.

### Frontend screens
1. **Home** — title + Create / Join buttons.
2. **Lobby** — share code, "Waiting for opponent…".
3. **Placement** — board + fleet list, R to rotate, Random, Reset, Ready.
4. **Battle** — your fleet + target grid, status banner, fleet status.
5. **Game over** — reveal + Rematch / New game.

Mobile (<768px): tabs to switch between "My fleet" and "Target".

### Visual style
Soft white background, deep navy + ocean-blue accents, subtle wave/grid texture. Hits = red dot, misses = small white dot, ships = navy capsule, sunk = darker overlay. Smooth fade/scale animations.
