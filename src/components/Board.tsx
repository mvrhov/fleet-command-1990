import { BOARD_SIZE, COLS, shipCells, type Ship, type Shot } from "@/lib/battleship";
import { cn } from "@/lib/utils";

interface BoardProps {
  ships?: Ship[] | null; // own ships visible
  shotsAtMe?: Shot[]; // shots opponent fired at this board
  shotsByMe?: Shot[]; // shots I fired (used on target grid)
  preview?: { cells: { x: number; y: number }[]; valid: boolean } | null;
  onCellClick?: (x: number, y: number) => void;
  onCellHover?: (x: number, y: number) => void;
  onCellLeave?: () => void;
  disabled?: boolean;
  showShips?: boolean;
  variant?: "own" | "target";
}

export function Board({
  ships,
  shotsAtMe = [],
  shotsByMe = [],
  preview,
  onCellClick,
  onCellHover,
  onCellLeave,
  disabled,
  showShips = true,
  variant = "own",
}: BoardProps) {
  // Build cell maps
  const shipMap = new Map<string, { ship: Ship; cellIdx: number }>();
  if (ships && showShips) {
    for (const ship of ships) {
      shipCells(ship).forEach((c, i) => {
        shipMap.set(`${c.x},${c.y}`, { ship, cellIdx: i });
      });
    }
  }
  const shotMap = new Map<string, Shot>();
  const sourceShots = variant === "own" ? shotsAtMe : shotsByMe;
  for (const s of sourceShots) shotMap.set(`${s.x},${s.y}`, s);
  const previewSet = new Set(preview?.cells.map((c) => `${c.x},${c.y}`) || []);

  // For "own" board: also show our ship hits from server-tracked board.hits
  const ownHits = new Set<string>();
  if (variant === "own" && ships) {
    for (const ship of ships) {
      const cells = shipCells(ship);
      (ship.hits || []).forEach((idx) => {
        const c = cells[idx];
        if (c) ownHits.add(`${c.x},${c.y}`);
      });
    }
  }

  return (
    <div className="inline-block select-none w-full max-w-[640px]">
      <div
        className="grid gap-px bg-grid-line p-px rounded-lg overflow-hidden shadow-lg"
        style={{
          gridTemplateColumns: `clamp(1.25rem,4vw,2rem) repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        }}
      >
        <div className="bg-card" />
        {COLS.map((c) => (
          <div
            key={c}
            className="bg-card text-[10px] sm:text-xs font-semibold text-muted-foreground flex items-center justify-center aspect-square"
          >
            {c}
          </div>
        ))}
        {Array.from({ length: BOARD_SIZE }).map((_, y) => (
          <Row
            key={y}
            y={y}
            shipMap={shipMap}
            shotMap={shotMap}
            previewSet={previewSet}
            previewValid={preview?.valid ?? true}
            ownHits={ownHits}
            onCellClick={onCellClick}
            onCellHover={onCellHover}
            onCellLeave={onCellLeave}
            disabled={disabled}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  y,
  shipMap,
  shotMap,
  previewSet,
  previewValid,
  ownHits,
  onCellClick,
  onCellHover,
  onCellLeave,
  disabled,
  variant,
}: {
  y: number;
  shipMap: Map<string, { ship: Ship; cellIdx: number }>;
  shotMap: Map<string, Shot>;
  previewSet: Set<string>;
  previewValid: boolean;
  ownHits: Set<string>;
  onCellClick?: (x: number, y: number) => void;
  onCellHover?: (x: number, y: number) => void;
  onCellLeave?: () => void;
  disabled?: boolean;
  variant: "own" | "target";
}) {
  return (
    <>
      <div className="bg-card text-[10px] sm:text-xs font-semibold text-muted-foreground flex items-center justify-center aspect-square px-1">
        {y + 1}
      </div>
      {Array.from({ length: BOARD_SIZE }).map((_, x) => {
        const key = `${x},${y}`;
        const shipInfo = shipMap.get(key);
        const shot = shotMap.get(key);
        const inPreview = previewSet.has(key);
        const isHit = ownHits.has(key) || shot?.result === "hit";
        const isMiss = shot?.result === "miss";
        const sunk = shipInfo && (shipInfo.ship.hits?.length || 0) === shipInfo.ship.size;

        return (
          <button
            key={x}
            type="button"
            disabled={disabled || !onCellClick}
            onClick={() => onCellClick?.(x, y)}
            onMouseEnter={() => onCellHover?.(x, y)}
            onMouseLeave={() => onCellLeave?.()}
            className={cn(
              "relative aspect-square flex items-center justify-center transition-colors",
              "bg-[color-mix(in_oklab,var(--ocean)_22%,white)]",
              variant === "target" &&
                !disabled &&
                onCellClick &&
                "hover:bg-[color-mix(in_oklab,var(--ocean)_40%,white)] cursor-crosshair",
              shipInfo && "bg-primary",
              shipInfo && sunk && "bg-sunk",
              inPreview && previewValid && "bg-ocean/60",
              inPreview && !previewValid && "bg-destructive/60",
            )}
          >
            {isHit && (
              <span className="shot-hit block w-[55%] h-[55%] rounded-full bg-hit shadow" />
            )}
            {isMiss && (
              <span className="shot-miss block w-[28%] h-[28%] rounded-full bg-white border border-grid-line" />
            )}
          </button>
        );
      })}
    </>
  );
}
