import { useEffect, useRef, useState, useCallback } from "react";
import type { Ship, Shot, FleetStatus } from "./battleship";

export interface GameState {
  code: string;
  status: "waiting" | "placing" | "playing" | "finished";
  currentTurn: number | null;
  winner: number | null;
  yourSlot: 1 | 2;
  you: { board: Ship[] | null; shots: Shot[]; ready: boolean };
  opponent: {
    connected: boolean;
    shots: Shot[];
    ready: boolean;
    fleetStatus: FleetStatus[];
    board: Ship[] | null;
  };
  fleet: { id: string; name: string; size: number }[];
}

export type ConnState = "idle" | "connecting" | "open" | "closed" | "error";

const SESSION_KEY = "battleship_session";
const CODE_KEY = "battleship_code";

const DEFAULT_WS_URL = "wss://battleship.vnct.xyz/ws";

function getWsUrl(): string {
  const env = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  return env || DEFAULT_WS_URL;
}

export function useGameSocket() {
  const [conn, setConn] = useState<ConnState>("idle");
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(CODE_KEY) : null,
  );
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<unknown[]>([]);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    setConn("connecting");
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      setConn("open");
      setError(null);
      // Drain queued
      for (const m of queueRef.current) ws.send(JSON.stringify(m));
      queueRef.current = [];
      // Try reconnect
      const sid = localStorage.getItem(SESSION_KEY);
      if (sid) ws.send(JSON.stringify({ type: "reconnect", sessionId: sid }));
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "joined") {
          localStorage.setItem(SESSION_KEY, msg.sessionId);
          localStorage.setItem(CODE_KEY, msg.code);
          setCode(msg.code);
        } else if (msg.type === "state") {
          setState(msg.state);
          setError(null);
        } else if (msg.type === "error") {
          setError(msg.message);
        }
      } catch (e) {
        console.error("WS parse", e);
      }
    };
    ws.onclose = () => {
      setConn("closed");
      // auto reconnect after 1.5s
      setTimeout(() => {
        if (wsRef.current === ws) connect();
      }, 1500);
    };
    ws.onerror = () => {
      setConn("error");
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [connect]);

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
    else queueRef.current.push(msg);
  }, []);

  const create = useCallback(() => send({ type: "create" }), [send]);
  const join = useCallback((c: string) => send({ type: "join", code: c }), [send]);
  const place = useCallback((board: Ship[]) => send({ type: "place", board }), [send]);
  const fire = useCallback((x: number, y: number) => send({ type: "fire", x, y }), [send]);
  const rematch = useCallback(() => send({ type: "rematch" }), [send]);
  const leave = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CODE_KEY);
    setState(null);
    setCode(null);
    const ws = wsRef.current;
    if (ws) {
      ws.close();
    }
    setTimeout(() => connect(), 100);
  }, [connect]);

  return { conn, state, error, code, create, join, place, fire, rematch, leave };
}
