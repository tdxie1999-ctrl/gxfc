import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import type { SettlementPlayer } from '@/components/game/Settlement';
import { useGameStore, type GameRoom } from '@/lib/store/useGame';

export interface GameTableRuntimeProps {
  roomId: string;
  roomCode?: string;
  roomLabel?: string;
  roomConfig?: Record<string, unknown>;
}

export interface GameTableSettlementEntry {
  key: string;
  summary: string;
  players: SettlementPlayer[];
}

interface UseGameTableRuntimeOptions extends GameTableRuntimeProps {
  fallbackTitle: string;
  fallbackLabel?: string;
  initialStatusText?: string;
  settlement?: GameTableSettlementEntry | null;
}

interface UseGameTableRuntimeResult {
  initialized: boolean;
  room: GameRoom | undefined;
  roomCode: string;
  roomTitle: string;
  roomLabel: string;
  roomConfig: Record<string, unknown>;
  statusText: string;
  setStatusText: Dispatch<SetStateAction<string>>;
  settlementEntry: GameTableSettlementEntry | null;
  settlementOpen: boolean;
  closeSettlement: () => void;
  exitRoom: () => void;
}

function normalizeConfig(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function useGameTableRuntime({
  roomId,
  roomCode: roomCodeProp,
  roomLabel: roomLabelProp,
  roomConfig: roomConfigProp,
  fallbackTitle,
  fallbackLabel,
  initialStatusText = '等待牌局开始...',
  settlement,
}: UseGameTableRuntimeOptions): UseGameTableRuntimeResult {
  const router = useRouter();
  const initialize = useGameStore((state) => state.initialize);
  const rooms = useGameStore((state) => state.rooms);
  const initialized = useGameStore((state) => state.initialized);
  const setCurrentRoomId = useGameStore((state) => state.setCurrentRoomId);
  const [statusText, setStatusText] = useState(initialStatusText);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const lastSettlementKeyRef = useRef<string | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    setStatusText(initialStatusText);
    setSettlementOpen(false);
    lastSettlementKeyRef.current = null;
  }, [initialStatusText, roomId]);

  const room = useMemo(() => rooms.find((item) => item.id === roomId), [roomId, rooms]);

  const resolvedRoomCode = roomCodeProp ?? room?.roomCode ?? roomId;
  const resolvedRoomTitle = room?.title ?? fallbackTitle;
  const resolvedRoomLabel = roomLabelProp ?? room?.label ?? fallbackLabel ?? fallbackTitle;
  const resolvedRoomConfig = useMemo(
    () => ({
      ...normalizeConfig(room?.config),
      ...normalizeConfig(roomConfigProp),
    }),
    [room?.config, roomConfigProp],
  );

  useEffect(() => {
    if (!settlement?.key) {
      lastSettlementKeyRef.current = null;
      return;
    }

    if (lastSettlementKeyRef.current === settlement.key) {
      return;
    }

    lastSettlementKeyRef.current = settlement.key;
    setSettlementOpen(true);
  }, [settlement?.key]);

  const closeSettlement = useCallback(() => {
    setSettlementOpen(false);
  }, []);

  const exitRoom = useCallback(() => {
    setCurrentRoomId(null);
    router.push('/hall');
  }, [router, setCurrentRoomId]);

  return {
    initialized,
    room,
    roomCode: resolvedRoomCode,
    roomTitle: resolvedRoomTitle,
    roomLabel: resolvedRoomLabel,
    roomConfig: resolvedRoomConfig,
    statusText,
    setStatusText,
    settlementEntry: settlement ?? null,
    settlementOpen,
    closeSettlement,
    exitRoom,
  };
}
