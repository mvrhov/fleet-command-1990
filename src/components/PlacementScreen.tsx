import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Board } from "@/components/Board";
import { Card } from "@/components/ui/card";
import {
  BOARD_SIZE,
  FLEET,
  canPlace,
  randomBoard,
  shipCells,
  type Orientation,
  type Ship,
} from "@/lib/battleship";

interface Props {
  initialBoard?: Ship[] | null;
  alreadyReady: boolean;
  opponentReady: boolean;
  onSubmit: (board: Ship[]) => void;
}

export function PlacementScreen({ initialBoard, alreadyReady, opponentReady, onSubmit }: Props) {
  const [board, setBoard] = useState<Ship[]>(initialBoard || []);
  const [selectedId, setSelectedId] = useState<string>(FLEET[0].id);
  const [orientation, setOrientation] = useState<Orientation>("h");
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const remaining = useMemo(
    () => FLEET.filter((f) => !board.some((b) => b.id === f.id)),
    [board],
  );

  useEffect(() => {
    if (remaining.length === 0) return;
    if (!remaining.some((r) => r.id === selectedId)) setSelectedId(remaining[0].id);
  }, [remaining, selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") setOrientation((o) => (o === "h" ? "v" : "h"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedDef = FLEET.find((f) => f.id === selectedId);

  const preview = useMemo(() => {
    if (!hover || !selectedDef) return null;
    const candidate: Ship = {
      ...selectedDef,
      x: hover.x,
      y: hover.y,
      orientation,
      hits: [],
    };
    const cells = shipCells(candidate);
    const valid = canPlace(board, candidate, selectedId);
    return { cells, valid };
  }, [hover, selectedDef, orientation, board, selectedId]);

  function handleCellClick(x: number, y: number) {
    if (!selectedDef) return;
    const ship: Ship = { ...selectedDef, x, y, orientation, hits: [] };
    if (!canPlace(board, ship, selectedId)) return;
    const next = board.filter((b) => b.id !== selectedId).concat(ship);
    setBoard(next);
  }

  function removeShip(id: string) {
    setBoard((b) => b.filter((s) => s.id !== id));
    setSelectedId(id);
  }

  function handleRandom() {
    setBoard(randomBoard());
  }
  function handleReset() {
    setBoard([]);
    setSelectedId(FLEET[0].id);
  }

  const allPlaced = board.length === FLEET.length;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-primary">Place your fleet</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Click a ship, press <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">R</kbd> to rotate,
          then click a cell to place.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto] items-start">
        <div className="flex justify-center">
          <Board
            ships={board}
            preview={preview}
            onCellClick={alreadyReady ? undefined : handleCellClick}
            onCellHover={(x, y) => setHover({ x, y })}
            onCellLeave={() => setHover(null)}
            disabled={alreadyReady}
            variant="own"
          />
        </div>

        <Card className="p-4 w-full lg:w-72">
          <h2 className="font-semibold mb-3">Fleet</h2>
          <div className="space-y-2 mb-4">
            {FLEET.map((def) => {
              const placed = board.find((b) => b.id === def.id);
              const isSelected = selectedId === def.id;
              return (
                <button
                  key={def.id}
                  onClick={() => (placed ? removeShip(def.id) : setSelectedId(def.id))}
                  disabled={alreadyReady}
                  className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                    isSelected && !placed
                      ? "border-ocean bg-ocean/10"
                      : placed
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted"
                  } disabled:opacity-60`}
                >
                  <div>
                    <div className="font-medium text-sm">{def.name}</div>
                    <div className="text-xs text-muted-foreground">{def.size} squares</div>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: def.size }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-sm ${placed ? "bg-primary" : "bg-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setOrientation((o) => (o === "h" ? "v" : "h"))}
              disabled={alreadyReady}
            >
              Rotate ({orientation === "h" ? "→" : "↓"})
            </Button>
          </div>
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleRandom} disabled={alreadyReady}>
              Random
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={handleReset} disabled={alreadyReady}>
              Reset
            </Button>
          </div>

          <Button
            className="w-full"
            disabled={!allPlaced || alreadyReady}
            onClick={() => onSubmit(board)}
          >
            {alreadyReady ? "Waiting for opponent…" : "Ready"}
          </Button>
          {alreadyReady && (
            <p className="text-xs text-center mt-2 text-muted-foreground">
              {opponentReady ? "Opponent ready, starting…" : "Opponent still placing"}
            </p>
          )}
        </Card>
      </div>
      <p className="sr-only">{BOARD_SIZE}x{BOARD_SIZE} grid</p>
    </div>
  );
}
