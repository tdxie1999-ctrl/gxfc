import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/useAuth';

export type GameType = 'paodekuai' | 'datongzi' | 'fangpaofa';

export interface GameRoom {
  id: string;
  roomCode: string;
  title: string;
  gameType: GameType;
  label: string;
  baseScore: number;
  config?: Record<string, unknown>;
  hostName: string;
  hostAvatar: string;
  hostOnline: boolean;
  currentPlayers: number;
  maxPlayers: number;
  isFake: boolean;
  createdAt: string;
  status: 'waiting' | 'playing' | 'finished';
}

interface CreateRoomPayload {
  gameType: GameType;
  baseScore: number;
  config?: Record<string, unknown>;
  hostName: string;
  hostAvatar: string;
  availableDiamonds: number;
}

interface JoinRoomResult {
  ok: boolean;
  roomId?: string;
  message: string;
}

interface GameState {
  rooms: GameRoom[];
  initialized: boolean;
  currentRoomId: string | null;
  lastPlayedLabel: string;
  initialize: () => Promise<void>;
  refreshRooms: () => Promise<void>;
  createRoom: (payload: CreateRoomPayload) => Promise<JoinRoomResult>;
  joinRoomByCode: (roomCode: string) => Promise<JoinRoomResult>;
  quickJoin: (filters?: GameType[]) => Promise<JoinRoomResult>;
  claimDailySignin: (userId: string) => { ok: boolean; message: string };
  getRoomById: (roomId: string) => GameRoom | undefined;
  setCurrentRoomId: (roomId: string | null) => void;
}

interface RoomRow {
  id: string;
  room_code: string;
  game_type: GameType;
  status: 'waiting' | 'playing' | 'finished' | 'dissolved';
  config: Record<string, unknown> | null;
  host_id: string | null;
  diamond_cost: number;
  max_players: number;
  created_at: string;
  updated_at: string | null;
}

interface RoomPlayerRow {
  id: string;
  room_id: string;
  user_id: string | null;
  seat_index: number;
  is_ready: boolean;
  is_bot: boolean;
  bot_name: string | null;
  bot_avatar: string | null;
  score: number | null;
}

interface PlayerIdentity {
  userId: string;
  displayName: string;
  avatarUrl: string;
}

const SIGNIN_STORAGE_KEY = 'gxfc_signin_v1';
const LAST_PLAYED_KEY = 'gxfc_last_played_v1';
const DEFAULT_AVATAR = '/assets/avatars/default.png';

const gameMeta: Record<GameType, { title: string; maxPlayers: number }> = {
  paodekuai: {
    title: '跑得快',
    maxPlayers: 3,
  },
  datongzi: {
    title: '打筒子',
    maxPlayers: 2,
  },
  fangpaofa: {
    title: '娄底放炮罚',
    maxPlayers: 3,
  },
};

function persistLastPlayed(label: string) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(LAST_PLAYED_KEY, label);
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function isGameType(value: string): value is GameType {
  return value === 'paodekuai' || value === 'datongzi' || value === 'fangpaofa';
}

function createRoomCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeRoomRow(row: Record<string, unknown>): RoomRow | null {
  const gameType = String(row.game_type ?? '');

  if (!isGameType(gameType)) {
    return null;
  }

  const statusValue = String(row.status ?? 'waiting');
  const status: RoomRow['status'] =
    statusValue === 'playing' || statusValue === 'finished' || statusValue === 'dissolved'
      ? statusValue
      : 'waiting';

  return {
    id: String(row.id ?? ''),
    room_code: String(row.room_code ?? ''),
    game_type: gameType,
    status,
    config: (row.config as Record<string, unknown> | null) ?? null,
    host_id: (row.host_id as string | null) ?? null,
    diamond_cost: Number(row.diamond_cost ?? 2),
    max_players: Number(row.max_players ?? gameMeta[gameType].maxPlayers),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

function normalizePlayerRow(row: Record<string, unknown>): RoomPlayerRow {
  return {
    id: String(row.id ?? ''),
    room_id: String(row.room_id ?? ''),
    user_id: (row.user_id as string | null) ?? null,
    seat_index: Number(row.seat_index ?? 0),
    is_ready: Boolean(row.is_ready),
    is_bot: Boolean(row.is_bot),
    bot_name: (row.bot_name as string | null) ?? null,
    bot_avatar: (row.bot_avatar as string | null) ?? null,
    score: row.score == null ? null : Number(row.score),
  };
}

function groupPlayersByRoom(players: RoomPlayerRow[]) {
  const grouped = new Map<string, RoomPlayerRow[]>();

  for (const player of players) {
    const current = grouped.get(player.room_id) ?? [];
    current.push(player);
    grouped.set(player.room_id, current);
  }

  for (const current of grouped.values()) {
    current.sort((left, right) => left.seat_index - right.seat_index);
  }

  return grouped;
}

function getConfigNumber(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getNestedConfigNumber(
  source: Record<string, unknown> | null | undefined,
  key: string,
  nestedKey: string
) {
  const nested = source?.[key];

  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
    return null;
  }

  const value = (nested as Record<string, unknown>)[nestedKey];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getRoomBaseScore(room: RoomRow) {
  return (
    getConfigNumber(room.config, 'baseScore') ??
    getNestedConfigNumber(room.config, room.game_type, 'basePoint') ??
    100
  );
}

function getRoomLabel(room: RoomRow) {
  const configLabel = room.config?.sceneLabel;
  if (typeof configLabel === 'string' && configLabel.trim()) {
    return configLabel.trim();
  }

  const customLabel = room.config?.label;
  if (typeof customLabel === 'string' && customLabel.trim()) {
    return customLabel.trim();
  }

  return `${getRoomBaseScore(room)}分 ${gameMeta[room.game_type].title}`;
}

function mapToGameRoom(room: RoomRow, players: RoomPlayerRow[]): GameRoom {
  const hostPlayer =
    players.find((player) => room.host_id && player.user_id === room.host_id) ??
    players.find((player) => player.seat_index === 0) ??
    players[0];
  const fallbackHostName =
    (typeof room.config?.hostName === 'string' && room.config.hostName.trim()) ||
    (typeof room.config?.host_name === 'string' && room.config.host_name.trim()) ||
    '房主待定';

  return {
    id: room.id,
    roomCode: room.room_code,
    title: gameMeta[room.game_type].title,
    gameType: room.game_type,
    label: getRoomLabel(room),
    baseScore: getRoomBaseScore(room),
    config: room.config ?? {},
    hostName: hostPlayer?.bot_name?.trim() || fallbackHostName,
    hostAvatar: hostPlayer?.bot_avatar || DEFAULT_AVATAR,
    hostOnline: room.status !== 'finished',
    currentPlayers: players.length,
    maxPlayers: room.max_players,
    isFake: players.length > 0 && players.every((player) => player.is_bot),
    createdAt: room.created_at,
    status: room.status === 'playing' ? 'playing' : room.status === 'finished' ? 'finished' : 'waiting',
  };
}

function normalizeRoomError(error: unknown, fallback: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback;

  const lower = message.toLowerCase();

  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Supabase 缺少 room_players 写入策略，请先执行最新 supabase/schema.sql。';
  }

  if (lower.includes('duplicate key') || lower.includes('duplicate') || lower.includes('unique')) {
    return '房间号冲突，请重试。';
  }

  return message || fallback;
}

function getCurrentIdentity(): PlayerIdentity | null {
  const { user, profile, isGuest } = useAuthStore.getState();

  if (!user || isGuest) {
    return null;
  }

  const displayName =
    profile?.nickname?.trim() ||
    profile?.username?.trim() ||
    user.email?.split('@')[0] ||
    '牌友';

  return {
    userId: user.id,
    displayName,
    avatarUrl: profile?.avatar_url ?? DEFAULT_AVATAR,
  };
}

async function fetchRoomsFromSupabase() {
  const { data: roomRows, error: roomError } = await supabase
    .from('rooms')
    .select('id, room_code, game_type, status, config, host_id, diamond_cost, max_players, created_at, updated_at')
    .neq('status', 'dissolved')
    .order('created_at', { ascending: false });

  if (roomError) {
    throw roomError;
  }

  const rooms = (roomRows ?? [])
    .map((row) => normalizeRoomRow(row as Record<string, unknown>))
    .filter((room): room is RoomRow => Boolean(room));

  if (rooms.length === 0) {
    return [] as GameRoom[];
  }

  const roomIds = rooms.map((room) => room.id);
  const { data: playerRows, error: playerError } = await supabase
    .from('room_players')
    .select('id, room_id, user_id, seat_index, is_ready, is_bot, bot_name, bot_avatar, score')
    .in('room_id', roomIds)
    .order('seat_index', { ascending: true });

  if (playerError) {
    throw playerError;
  }

  const grouped = groupPlayersByRoom(
    (playerRows ?? []).map((row) => normalizePlayerRow(row as Record<string, unknown>))
  );

  return rooms.map((room) => mapToGameRoom(room, grouped.get(room.id) ?? []));
}

async function fetchRoomWithPlayersByCode(roomCode: string) {
  const { data: roomRow, error: roomError } = await supabase
    .from('rooms')
    .select('id, room_code, game_type, status, config, host_id, diamond_cost, max_players, created_at, updated_at')
    .eq('room_code', roomCode)
    .neq('status', 'dissolved')
    .maybeSingle();

  if (roomError) {
    throw roomError;
  }

  if (!roomRow) {
    return {
      room: null,
      players: [] as RoomPlayerRow[],
    };
  }

  const room = normalizeRoomRow(roomRow as Record<string, unknown>);

  if (!room) {
    return {
      room: null,
      players: [] as RoomPlayerRow[],
    };
  }

  const { data: playerRows, error: playerError } = await supabase
    .from('room_players')
    .select('id, room_id, user_id, seat_index, is_ready, is_bot, bot_name, bot_avatar, score')
    .eq('room_id', room.id)
    .order('seat_index', { ascending: true });

  if (playerError) {
    throw playerError;
  }

  return {
    room,
    players: (playerRows ?? []).map((row) => normalizePlayerRow(row as Record<string, unknown>)),
  };
}

async function tryCreateRoomRecord(input: {
  gameType: GameType;
  baseScore: number;
  config?: Record<string, unknown>;
  hostId: string;
  hostName: string;
}) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const roomCode = createRoomCode();
    const insertPayload = {
      room_code: roomCode,
      game_type: input.gameType,
      status: 'waiting',
      config: {
        ...(input.config ?? {}),
        baseScore: input.baseScore,
        hostName: input.hostName,
      },
      host_id: input.hostId,
      diamond_cost: 2,
      max_players: gameMeta[input.gameType].maxPlayers,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('rooms')
      .insert(insertPayload)
      .select('id, room_code, game_type, status, config, host_id, diamond_cost, max_players, created_at, updated_at')
      .single();

    if (error) {
      const message = error.message.toLowerCase();

      if ((message.includes('duplicate') || message.includes('unique')) && attempt < 5) {
        continue;
      }

      throw error;
    }

    const room = normalizeRoomRow(data as Record<string, unknown>);

    if (!room) {
      throw new Error('房间数据异常');
    }

    return room;
  }

  throw new Error('房间号生成失败，请重试');
}

async function insertCurrentUserIntoRoom(room: RoomRow, identity: PlayerIdentity) {
  const occupiedSeats = new Set<number>();

  const { data: currentPlayers, error: playerError } = await supabase
    .from('room_players')
    .select('id, room_id, user_id, seat_index, is_ready, is_bot, bot_name, bot_avatar, score')
    .eq('room_id', room.id)
    .order('seat_index', { ascending: true });

  if (playerError) {
    throw playerError;
  }

  const players = (currentPlayers ?? []).map((row) => normalizePlayerRow(row as Record<string, unknown>));
  const existing = players.find((player) => player.user_id === identity.userId);

  if (existing) {
    return;
  }

  for (const player of players) {
    occupiedSeats.add(player.seat_index);
  }

  let nextSeat = -1;

  for (let seatIndex = 0; seatIndex < room.max_players; seatIndex += 1) {
    if (!occupiedSeats.has(seatIndex)) {
      nextSeat = seatIndex;
      break;
    }
  }

  if (nextSeat === -1) {
    throw new Error('房间已满');
  }

  const { error: insertError } = await supabase.from('room_players').insert({
    room_id: room.id,
    user_id: identity.userId,
    seat_index: nextSeat,
    is_ready: false,
    is_bot: false,
    bot_name: identity.displayName,
    bot_avatar: identity.avatarUrl,
    score: 0,
  });

  if (insertError) {
    throw insertError;
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  rooms: [],
  initialized: false,
  currentRoomId: null,
  lastPlayedLabel: '暂无对局记录',

  initialize: async () => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const rooms = await fetchRoomsFromSupabase();
      const lastPlayedLabel = localStorage.getItem(LAST_PLAYED_KEY) ?? '暂无对局记录';

      set({
        rooms,
        lastPlayedLabel,
        initialized: true,
      });
    } catch {
      const lastPlayedLabel = localStorage.getItem(LAST_PLAYED_KEY) ?? '暂无对局记录';

      set({
        rooms: [],
        lastPlayedLabel,
        initialized: true,
      });
    }
  },

  refreshRooms: async () => {
    try {
      const rooms = await fetchRoomsFromSupabase();
      set({
        rooms,
        initialized: true,
      });
    } catch {
      set({
        rooms: [],
        initialized: true,
      });
    }
  },

  createRoom: async ({ gameType, baseScore, config, hostName, hostAvatar, availableDiamonds }) => {
    if (availableDiamonds < 2) {
      return {
        ok: false,
        message: '钻石不足，无法创建房间',
      };
    }

    const identity = getCurrentIdentity();

    if (!identity) {
      return {
        ok: false,
        message: '请先登录',
      };
    }

    try {
      const room = await tryCreateRoomRecord({
        gameType,
        baseScore,
        config,
        hostId: identity.userId,
        hostName,
      });

      try {
        await insertCurrentUserIntoRoom(room, {
          userId: identity.userId,
          displayName: hostName || identity.displayName,
          avatarUrl: hostAvatar || identity.avatarUrl,
        });
      } catch (seatError) {
        await supabase
          .from('rooms')
          .update({
            status: 'dissolved',
            updated_at: new Date().toISOString(),
          })
          .eq('id', room.id)
          .eq('host_id', identity.userId);

        throw seatError;
      }

      const label = `${baseScore}分 ${gameMeta[gameType].title}`;
      persistLastPlayed(label);
      await get().refreshRooms();

      set({
        currentRoomId: room.id,
        lastPlayedLabel: label,
      });

      return {
        ok: true,
        roomId: room.id,
        message: '房间创建成功',
      };
    } catch (error) {
      return {
        ok: false,
        message: normalizeRoomError(error, '创建房间失败'),
      };
    }
  },

  joinRoomByCode: async (roomCode) => {
    const cleanCode = roomCode.trim();

    if (!cleanCode) {
      return {
        ok: false,
        message: '请输入房间号',
      };
    }

    const identity = getCurrentIdentity();

    if (!identity) {
      return {
        ok: false,
        message: '请先登录',
      };
    }

    try {
      const { room } = await fetchRoomWithPlayersByCode(cleanCode);

      if (!room || room.status !== 'waiting') {
        return {
          ok: false,
          message: '房间不存在',
        };
      }

      await insertCurrentUserIntoRoom(room, identity);

      const label = getRoomLabel(room);
      persistLastPlayed(label);
      await get().refreshRooms();

      set({
        currentRoomId: room.id,
        lastPlayedLabel: label,
      });

      return {
        ok: true,
        roomId: room.id,
        message: '加入成功',
      };
    } catch (error) {
      return {
        ok: false,
        message: normalizeRoomError(error, '加入房间失败'),
      };
    }
  },

  quickJoin: async (filters = []) => {
    const identity = getCurrentIdentity();

    if (!identity) {
      return {
        ok: false,
        message: '请先登录',
      };
    }

    try {
      const rooms = await fetchRoomsFromSupabase();
      const candidates = rooms.filter((room) => {
        if (room.status !== 'waiting') {
          return false;
        }

        if (filters.length > 0 && !filters.includes(room.gameType)) {
          return false;
        }

        return room.currentPlayers < room.maxPlayers;
      });

      if (candidates.length === 0) {
        return {
          ok: false,
          message: '当前没有可加入的房间',
        };
      }

      const target = randomFrom(candidates);
      return get().joinRoomByCode(target.roomCode);
    } catch (error) {
      return {
        ok: false,
        message: normalizeRoomError(error, '快速加入失败'),
      };
    }
  },

  claimDailySignin: (userId) => {
    if (typeof window === 'undefined') {
      return {
        ok: false,
        message: '请在客户端使用签到功能',
      };
    }

    const payload = localStorage.getItem(SIGNIN_STORAGE_KEY);
    const signinMap = payload ? (JSON.parse(payload) as Record<string, string>) : {};
    const today = todayKey();

    if (signinMap[userId] === today) {
      return {
        ok: false,
        message: '今日已签到',
      };
    }

    signinMap[userId] = today;
    localStorage.setItem(SIGNIN_STORAGE_KEY, JSON.stringify(signinMap));

    return {
      ok: true,
      message: '签到成功，获得1钻石',
    };
  },

  getRoomById: (roomId) => get().rooms.find((room) => room.id === roomId),

  setCurrentRoomId: (roomId) => {
    set({ currentRoomId: roomId });
  },
}));
