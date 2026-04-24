import { Board } from "@/components/Board";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useDemoGame } from "@/lib/useDemoGame";
import { cn } from "@/lib/utils";

interface Props {
  onExit: () => void;
}

export function DemoScreen({ onExit }: Props) {
  const { p1, p2, turn, winner, paused, setPaused, speed, setSpeed, banner, reset } =
    useDemoGame();

  const fleetStatusFor = (board: typeof p1.board) =>
    board.map((s) => ({
      id: s.id,
      name: s.name,
      size: s.size,
      sunk: (s.hits?.length || 0) === s.size,
    }));

  const headerText = winner
    ? `Player ${winner} wins!`
    : banner || `Player ${turn}'s turn…`;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-primary">Demo mode</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPaused(!paused)}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            Restart
          </Button>
          <Button variant="ghost" size="sm" onClick={onExit}>
            Exit
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "mb-4 rounded-lg p-3 text-center font-semibold shadow-sm",
          winner
            ? "bg-ocean text-ocean-foreground"
            : turn === 1
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
        )}
      >
        {headerText}
      </div>

      <div className="flex items-center gap-3 mb-4 text-sm">
        <span className="text-muted-foreground whitespace-nowrap">Speed</span>
        <Slider
          value={[1000 - speed]}
          min={0}
          max={950}
          step={50}
          onValueChange={(v) => setSpeed(1000 - v[0])}
          className="max-w-xs"
        />
        <span className="text-muted-foreground tabular-nums">{speed}ms</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <Card className="p-4">
          <h2 className="font-semibold mb-3 text-center">
            Player 1 {turn === 1 && !winner && "🎯"}
          </h2>
          <div className="flex justify-center">
            <Board
              ships={p1.board}
              shotsAtMe={p2.shots}
              variant="own"
              showShips
            />
          </div>
          <FleetList ships={fleetStatusFor(p1.board)} className="mt-4" />
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3 text-center">
            Player 2 {turn === 2 && !winner && "🎯"}
          </h2>
          <div className="flex justify-center">
            <Board
              ships={p2.board}
              shotsAtMe={p1.shots}
              variant="own"
              showShips
            />
          </div>
          <FleetList ships={fleetStatusFor(p2.board)} className="mt-4" />
        </Card>
      </div>
    </div>
  );
}

function FleetList({
  ships,
  className,
}: {
  ships: { id: string; name: string; size: number; sunk: boolean }[];
  className?: string;
}) {
  return (
    <div className={className}>
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
