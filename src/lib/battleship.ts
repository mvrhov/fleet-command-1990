// Mirrors server/src/game.js — used for placement UI and rendering.

export const FLEET = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "cruiser", name: "Cruiser", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
] as const;

export const BOARD_SIZE = 10;
export const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export type Orientation = "h" | "v";
export interface Ship {
  id: string;
  name: string;
  size: number;
  x: number;
  y: number;
  orientation: Orientation;
  hits?: number[];
}
export interface Shot {
  x: number;
  y: number;
  result: "hit" | "miss";
  sunk?: boolean;
  shipName?: string | null;
}
export interface FleetStatus {
  id: string;
  name: string;
  size: number;
  sunk: boolean;
}

export function shipCells(ship: Ship): { x: number; y: number }[] {
  const cells = [];
  for (let i = 0; i < ship.size; i++) {
    cells.push({
      x: ship.orientation === "h" ? ship.x + i : ship.x,
      y: ship.orientation === "v" ? ship.y + i : ship.y,
    });
  }
  return cells;
}

export function canPlace(
  board: Ship[],
  candidate: Ship,
  ignoreId?: string,
): boolean {
  const cells = shipCells(candidate);
  for (const c of cells) {
    if (c.x < 0 || c.x >= BOARD_SIZE || c.y < 0 || c.y >= BOARD_SIZE) return false;
  }
  const occupied = new Set<string>();
  for (const ship of board) {
    if (ship.id === ignoreId) continue;
    for (const c of shipCells(ship)) occupied.add(`${c.x},${c.y}`);
  }
  return cells.every((c) => !occupied.has(`${c.x},${c.y}`));
}

export function randomBoard(): Ship[] {
  const board: Ship[] = [];
  for (const def of FLEET) {
    let placed = false;
    let tries = 0;
    while (!placed && tries < 500) {
      tries++;
      const orientation: Orientation = Math.random() < 0.5 ? "h" : "v";
      const x = Math.floor(
        Math.random() * (orientation === "h" ? BOARD_SIZE - def.size + 1 : BOARD_SIZE),
      );
      const y = Math.floor(
        Math.random() * (orientation === "v" ? BOARD_SIZE - def.size + 1 : BOARD_SIZE),
      );
      const ship: Ship = { ...def, x, y, orientation, hits: [] };
      if (canPlace(board, ship)) {
        board.push(ship);
        placed = true;
      }
    }
    if (!placed) return randomBoard();
  }
  return board;
}
