## Battleship — Online Two-Player

A web-based Battleship game (Milton Bradley 1990 nomenclature) where two players connect online via a short room code. Modern clean nautical look. Real-time over the network using the project's own server (Lovable Cloud) — no third-party game service.

### Game rules

- 10×10 grid, columns A–J, rows 1–10.
- Standard 1990 fleet, placed by each player at the start:
  - Carrier — 5 squares
  - Battleship — 4 squares
  - Cruiser — 3 squares
  - Submarine — 3 squares
  - Destroyer — 2 squares
- Ships placed horizontally or vertically; no overlap, no off-board.
- Turn rule (per your spec): a player keeps firing as long as their shot is a HIT. Turn passes to the opponent on a MISS.
- A ship is "Sunk" when all its squares are hit — opponent is notified ("You sunk my Battleship!").
- Game ends when one player's entire fleet is sunk.

### Screens / flow

1. **Home** — Game title, two buttons:
   - "Create game" → generates a 4-character code (A–Z, 0–9, no ambiguous chars like 0/O/1/I), shows it large with a copy button, waits for opponent.
   - "Join game" → input for the 4-character code.
2. **Lobby** — Once both players are connected, both see "Opponent connected" and proceed to placement.
3. **Place your fleet** — Player's 10×10 board on the left, fleet list on the right. Click a ship, choose orientation (rotate button or R key), click a cell to place. Drag-to-reposition supported. "Random placement" and "Reset" buttons. "Ready" button enabled once all 5 ships placed.
4. **Battle** — Two boards side by side:
   - Left: "Your fleet" with ship positions, hits (red), misses (white).
   - Right: "Target grid" — opponent's board, hidden; click a cell to fire (only on your turn).
   - Status banner: "Your turn — fire!" / "Opponent's turn" / "HIT — fire again" / "MISS" / "You sunk their Cruiser!".
   - Fleet status panel for each side showing which ships are still afloat.
5. **Game over** — Victory / defeat screen with final boards revealed and "Play again" (re-uses same room) and "New game" buttons.

### Visual style

- Modern clean nautical: soft white background, deep navy and ocean-blue accents, subtle wave/grid texture.
- Hits = filled red circle, Misses = small white dot, Ships on own board = rounded navy capsule spanning the cells, Sunk ships shown with a darker overlay.
- Smooth fade/scale animations on shots; subtle splash for miss, flash for hit.
- Fully responsive: side-by-side boards on desktop, stacked with a tab toggle ("My fleet" / "Target") on mobile.

### Technical approach (for reference)

- **Backend**: Lovable Cloud (Supabase). Two tables:
  - `games` (id, code unique, status: waiting/placing/playing/finished, current_turn, winner, created_at)
  - `game_players` (game_id, player_slot 1|2, session_id, board jsonb [ship placements], shots jsonb [list of {x,y,result}], ready bool)
- No login required — each browser gets an anonymous session id stored in localStorage; the server uses it to identify which slot belongs to which client.
- **Realtime**: Supabase Realtime channel per game to push opponent moves and state changes instantly to both clients.
- **Server functions** (TanStack `createServerFn`) handle: create game, join by code, submit placement, fire shot (validates turn, computes hit/miss/sunk, updates current_turn per the "shoot again on hit" rule, checks win condition). All game-state mutations happen server-side so a client cannot cheat by editing local state.
- Routes: `/` (home), `/game/$code` (lobby + placement + battle, single route that switches view based on game status).
- Frontend state via TanStack Query; board rendered as a CSS grid of buttons.

### Out of scope (can add later)

- Single-player vs AI
- Salvo mode / classic one-shot-per-turn rule
- Accounts, stats, chat, sound effects
