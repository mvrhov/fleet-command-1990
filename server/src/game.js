// Pure game logic: fleet definition, placement validation, shot resolution.

export const FLEET = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "cruiser", name: "Cruiser", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
];

export const BOARD_SIZE = 10;

// A board = array of placed ships:
// { id, name, size, x, y, orientation: 'h'|'v', hits: number[] (cell indexes 0..size-1) }

export function shipCells(ship) {
  const cells = [];
  for (let i = 0; i < ship.size; i++) {
    cells.push({
      x: ship.orientation === "h" ? ship.x + i : ship.x,
      y: ship.orientation === "v" ? ship.y + i : ship.y,
    });
  }
  return cells;
}

export function validateBoard(board) {
  if (!Array.isArray(board) || board.length !== FLEET.length) return false;
  const ids = new Set(FLEET.map((s) => s.id));
  const occupied = new Set();
  for (const ship of board) {
    const def = FLEET.find((s) => s.id === ship.id);
    if (!def || !ids.has(ship.id)) return false;
    ids.delete(ship.id);
    if (ship.size !== def.size) return false;
    if (ship.orientation !== "h" && ship.orientation !== "v") return false;
    const cells = shipCells(ship);
    for (const c of cells) {
      if (c.x < 0 || c.x >= BOARD_SIZE || c.y < 0 || c.y >= BOARD_SIZE) return false;
      const key = `${c.x},${c.y}`;
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return ids.size === 0;
}

export function applyShot(board, x, y) {
  for (const ship of board) {
    const cells = shipCells(ship);
    const idx = cells.findIndex((c) => c.x === x && c.y === y);
    if (idx !== -1) {
      ship.hits = ship.hits || [];
      if (!ship.hits.includes(idx)) ship.hits.push(idx);
      const sunk = ship.hits.length === ship.size;
      return { result: "hit", sunk, shipName: sunk ? ship.name : null, shipId: ship.id };
    }
  }
  return { result: "miss", sunk: false };
}

export function isFleetSunk(board) {
  return board.every((s) => (s.hits?.length || 0) === s.size);
}

export function randomBoard() {
  const board = [];
  const occupied = new Set();
  for (const def of FLEET) {
    let placed = false;
    let tries = 0;
    while (!placed && tries < 500) {
      tries++;
      const orientation = Math.random() < 0.5 ? "h" : "v";
      const x = Math.floor(Math.random() * (orientation === "h" ? BOARD_SIZE - def.size + 1 : BOARD_SIZE));
      const y = Math.floor(Math.random() * (orientation === "v" ? BOARD_SIZE - def.size + 1 : BOARD_SIZE));
      const ship = { ...def, x, y, orientation, hits: [] };
      const cells = shipCells(ship);
      if (cells.every((c) => !occupied.has(`${c.x},${c.y}`))) {
        cells.forEach((c) => occupied.add(`${c.x},${c.y}`));
        board.push(ship);
        placed = true;
      }
    }
    if (!placed) return randomBoard();
  }
  return board;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function generateCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
