import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGameSocket } from "@/lib/useGameSocket";
import { PlacementScreen } from "@/components/PlacementScreen";
import { BattleScreen } from "@/components/BattleScreen";
import { DemoScreen } from "@/components/DemoScreen";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { conn, state, error, code, create, join, place, fire, rematch, leave } = useGameSocket();
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  // Show transient HIT/MISS/SUNK banners
  const lastMine = state?.you.shots[state.you.shots.length - 1];
  const lastTheirs = state?.opponent.shots[state.opponent.shots.length - 1];
  useEffect(() => {
    if (!lastMine) return;
    if (lastMine.sunk && lastMine.shipName) setBanner(`You sunk their ${lastMine.shipName}!`);
    else if (lastMine.result === "hit") setBanner("HIT — fire again!");
    else setBanner("MISS");
    const t = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.you.shots.length]);
  useEffect(() => {
    if (!lastTheirs) return;
    if (lastTheirs.sunk && lastTheirs.shipName)
      setBanner(`Opponent sunk your ${lastTheirs.shipName}!`);
    const t = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.opponent.shots.length]);

  // Connection problem screen
  if (conn === "error" || conn === "closed") {
    return (
      <Wrap>
        <Card className="p-6 text-center max-w-md">
          <h2 className="text-lg font-semibold mb-2">Disconnected</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Trying to reconnect to the game server…
          </p>
          <p className="text-xs text-muted-foreground">
            Set <code>VITE_WS_URL</code> to your server's WebSocket URL.
          </p>
        </Card>
      </Wrap>
    );
  }

  if (conn === "connecting" || conn === "idle") {
    return (
      <Wrap>
        <p className="text-muted-foreground">Connecting…</p>
      </Wrap>
    );
  }

  // No game yet — Home screen
  if (!state) {
    return (
      <Wrap>
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-primary tracking-tight">Battleship</h1>
          <p className="mt-2 text-muted-foreground">Online two-player · 1990 fleet</p>
        </div>

        <Card className="p-6 max-w-md w-full">
          <Button className="w-full mb-4" size="lg" onClick={create}>
            Create game
          </Button>
          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (joinCode.trim().length === 4) join(joinCode.trim().toUpperCase());
            }}
            className="space-y-3"
          >
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="ABCD"
              maxLength={4}
              className="text-center text-2xl tracking-[0.5em] font-mono uppercase"
            />
            <Button type="submit" variant="outline" className="w-full" disabled={joinCode.length !== 4}>
              Join game
            </Button>
          </form>
          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="secondary" className="w-full" onClick={() => setDemo(true)}>
            Demo mode (AI vs AI)
          </Button>
          {error && <p className="text-destructive text-sm text-center mt-3">{error}</p>}
        </Card>
      </Wrap>
    );
  }

  // Waiting for opponent (only one player connected)
  if (state.status === "placing" && !state.opponent.connected) {
    return (
      <Wrap>
        <Card className="p-8 text-center max-w-md w-full">
          <p className="text-sm text-muted-foreground mb-2">Share this code with your opponent</p>
          <div className="text-5xl font-mono font-bold tracking-[0.4em] text-primary my-4">
            {code}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (code) {
                navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? "Copied!" : "Copy code"}
          </Button>
          <p className="mt-6 text-sm text-muted-foreground">Waiting for opponent…</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={leave}>
            Cancel
          </Button>
        </Card>
      </Wrap>
    );
  }

  if (state.status === "placing") {
    return (
      <PlacementScreen
        initialBoard={state.you.board}
        alreadyReady={state.you.ready}
        opponentReady={state.opponent.ready}
        onSubmit={place}
      />
    );
  }

  if (state.status === "playing") {
    return <BattleScreen state={state} onFire={fire} banner={banner} />;
  }

  // finished
  const won = state.winner === state.yourSlot;
  return (
    <Wrap>
      <Card className="p-8 text-center max-w-md w-full">
        <h1 className={`text-4xl font-bold mb-2 ${won ? "text-ocean" : "text-primary"}`}>
          {won ? "Victory!" : "Defeated"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {won ? "You sunk their entire fleet." : "Your fleet has been destroyed."}
        </p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={rematch}>
            Play again
          </Button>
          <Button variant="outline" className="flex-1" onClick={leave}>
            New game
          </Button>
        </div>
      </Card>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">{children}</div>
  );
}
