import { useState } from "react";
import { Board } from "@/components/Board";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { GameState } from "@/lib/useGameSocket";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  onFire: (x: number, y: number) => void;
  banner: string | null;
}

export function BattleScreen({ state, onFire, banner }: Props) {
  const [tab, setTab] = useState<"own" | "target">("target");
  const yourTurn = state.currentTurn === state.yourSlot;
  const lastShotByMe = state.you.shots[state.you.shots.length - 1];

  const statusText = (() => {
    if (banner) return banner;
    if (yourTurn) return "Your turn — fire!";
    return "Opponent's turn…";
  })();

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div
        className={cn(
          "mb-4 rounded-lg p-3 text-center font-semibold shadow-sm",
          yourTurn ? "bg-ocean text-ocean-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {statusText}
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-2 mb-4">
        <Button
          variant={tab === "target" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setTab("target")}
        >
          Target grid
        </Button>
        <Button
          variant={tab === "own" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setTab("own")}
        >
          My fleet
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <Card className={cn("p-4", tab !== "own" && "hidden md:block")}>
          <h2 className="font-semibold mb-3 text-center">Your fleet</h2>
          <div className="flex justify-center">
            <Board
              ships={state.you.board}
              shotsAtMe={state.opponent.shots}
              variant="own"
              showShips
            />
          </div>
          <FleetList
            title="Their fleet"
            ships={state.opponent.fleetStatus}
            className="mt-4"
          />
        </Card>

        <Card className={cn("p-4", tab !== "target" && "hidden md:block")}>
          <h2 className="font-semibold mb-3 text-center">Target grid</h2>
          <div className="flex justify-center">
            <Board
              shotsByMe={state.you.shots}
              variant="target"
              showShips={false}
              onCellClick={(x, y) => {
                if (!yourTurn) return;
                if (state.you.shots.some((s) => s.x === x && s.y === y)) return;
                onFire(x, y);
              }}
              disabled={!yourTurn}
            />
          </div>
          {lastShotByMe && (
            <p className="text-center mt-3 text-sm text-muted-foreground">
              Last shot:{" "}
              <span className={lastShotByMe.result === "hit" ? "text-hit font-semibold" : ""}>
                {lastShotByMe.result === "hit" ? "HIT" : "miss"}
              </span>
              {lastShotByMe.sunk && lastShotByMe.shipName && (
                <> — sunk their {lastShotByMe.shipName}!</>
              )}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function FleetList({
  title,
  ships,
  className,
}: {
  title: string;
  ships: { id: string; name: string; size: number; sunk: boolean }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-sm font-semibold mb-2 text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {ships.map((s) => (
          <div
            key={s.id}
            className={cn(
              "flex items-center justify-between rounded px-2 py-1 text-xs",
              s.sunk ? "bg-sunk text-white line-through" : "bg-muted",
            )}
          >
            <span>{s.name}</span>
            <span className="opacity-70">{s.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
