import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOARD_SIZE,
  FLEET,
  randomBoard,
  shipCells,
  type Ship,
  type Shot,
} from "./battleship";
import type { GameState } from "./useGameSocket";

interface PlayerState {
  board: Ship[];
  shots: Shot[];
  // AI memory: stack of cells to try after a hit
  hunt: { x: number; y: number }[];
  lastHits: { x: number; y: number }[];
}

function freshPlayer(): PlayerState {
  return {
    board: randomBoard().map((s) => ({ ...s, hits: [] })),
    shots: [],
    hunt: [],
    lastHits: [],
  };
}

function fleetStatus(board: Ship[]) {
  return board.map((s) => ({
    id: s.id,
    name: s.name,
    size: s.size,
    sunk: (s.hits?.length || 0) === s.size,
  }));
}

function isFleetSunk(board: Ship[]) {
  return board.every((s) => (s.hits?.length || 0) === s.size);
}

function applyShot(targetBoard: Ship[], x: number, y: number) {
  for (const ship of targetBoard) {
    const cells = shipCells(ship);
    const idx = cells.findIndex((c) => c.x === x && c.y === y);
    if (idx >= 0) {
      ship.hits = Array.from(new Set([...(ship.hits || []), idx]));
      const sunk = ship.hits.length === ship.size;
      return { result: "hit" as const, sunk, shipName: sunk ? ship.name : null };
    }
  }
  return { result: "miss" as const, sunk: false, shipName: null };
}

function pickAIMove(me: PlayerState): { x: number; y: number } {
  const fired = new Set(me.shots.map((s) => `${s.x},${s.y}`));
  // Drain hunt queue
  while (me.hunt.length) {
    const c = me.hunt.shift()!;
    if (
      c.x >= 0 &&
      c.x < BOARD_SIZE &&
      c.y >= 0 &&
      c.y < BOARD_SIZE &&
      !fired.has(`${c.x},${c.y}`)
    ) {
      return c;
    }
  }
  // Random hunt — checkerboard for efficiency
  const candidates: { x: number; y: number }[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if ((x + y) % 2 === 0 && !fired.has(`${x},${y}`)) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) {
    for (let y = 0; y < BOARD_SIZE; y++)
      for (let x = 0; x < BOARD_SIZE; x++)
        if (!fired.has(`${x},${y}`)) candidates.push({ x, y });
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function updateHuntAfterHit(me: PlayerState, x: number, y: number, sunk: boolean) {
  if (sunk) {
    me.lastHits = [];
    me.hunt = [];
    return;
  }
  me.lastHits.push({ x, y });
  // Add 4 neighbours
  const neigh = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  me.hunt.push(...neigh);
}

export function useDemoGame() {
  const [p1, setP1] = useState<PlayerState>(() => freshPlayer());
  const [p2, setP2] = useState<PlayerState>(() => freshPlayer());
  const [turn, setTurn] = useState<1 | 2>(() => (Math.random() < 0.5 ? 1 : 2));
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(450); // ms per shot
  const [banner, setBanner] = useState<string | null>(null);
  const tickRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setP1(freshPlayer());
    setP2(freshPlayer());
    setTurn(Math.random() < 0.5 ? 1 : 2);
    setWinner(null);
    setBanner(null);
    setPaused(false);
  }, []);

  useEffect(() => {
    if (winner || paused) return;
    tickRef.current = window.setTimeout(() => {
      const shooter = turn === 1 ? p1 : p2;
      const targetState = turn === 1 ? p2 : p1;
      const setShooter = turn === 1 ? setP1 : setP2;
      const setTarget = turn === 1 ? setP2 : setP1;

      const move = pickAIMove(shooter);
      // Clone to mutate
      const newTargetBoard = targetState.board.map((s) => ({ ...s, hits: [...(s.hits || [])] }));
      const result = applyShot(newTargetBoard, move.x, move.y);
      const newShots: Shot[] = [
        ...shooter.shots,
        { x: move.x, y: move.y, result: result.result, sunk: result.sunk, shipName: result.shipName },
      ];
      const newShooter: PlayerState = {
        ...shooter,
        shots: newShots,
        hunt: [...shooter.hunt],
        lastHits: [...shooter.lastHits],
      };
      if (result.result === "hit") {
        updateHuntAfterHit(newShooter, move.x, move.y, result.sunk);
        if (result.sunk && result.shipName) {
          setBanner(`Player ${turn} sunk the ${result.shipName}!`);
          setTimeout(() => setBanner(null), 1500);
        }
      }
      setShooter(newShooter);
      setTarget({ ...targetState, board: newTargetBoard });

      if (isFleetSunk(newTargetBoard)) {
        setWinner(turn);
        return;
      }
      // Hit → keep turn; miss → swap
      if (result.result === "miss") setTurn(turn === 1 ? 2 : 1);
    }, speed);
    return () => {
      if (tickRef.current) clearTimeout(tickRef.current);
    };
  }, [turn, p1, p2, winner, paused, speed]);

  // Build a GameState-shaped view from player 1's perspective for reuse with BattleScreen
  const stateAsP1: GameState = {
    code: "DEMO",
    status: winner ? "finished" : "playing",
    currentTurn: turn,
    winner,
    yourSlot: 1,
    you: { board: p1.board, shots: p1.shots, ready: true },
    opponent: {
      connected: true,
      shots: p2.shots,
      ready: true,
      fleetStatus: fleetStatus(p1.board), // shown as "their fleet" from p2's POV — we'll use p2 below
      board: p2.board,
    },
    fleet: FLEET as unknown as { id: string; name: string; size: number }[],
  };

  return {
    p1,
    p2,
    turn,
    winner,
    paused,
    setPaused,
    speed,
    setSpeed,
    banner,
    reset,
    stateAsP1,
  };
}
