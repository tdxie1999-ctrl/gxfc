import type { RealtimeChannel, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { Profile } from '@/lib/store/useAuth';

export type GameType = 'paodekuai' | 'datongzi' | 'fangpaofa';

export interface PlayerIdentity {
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
}

export interface RoomRecord {
  id: string;
  room_code: string;
  game_type: GameType;
  status: 'waiting' | 'playing' | 'finished' | 'dissolved';
  max_players: number;
  host_id: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

export interface RoomPlayerRecord {
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

export interface RoomSummary extends RoomRecord {
  room_name: string;
  game_label: string;
  host_name: string;
  host_avatar: string | null;
  player_count: number;
  base_score: number;
}

const DEFAULT_AVATAR = '/assets/avatars/default.png';
const GUEST_KEY_STORAGE = 'gxfc_room_guest_key';
const GUEST_NAME_STORAGE = 'gxfc_room_guest_name';

const GAME_LABELS: Record<GameType, string> = {
  paodekuai: '跑得快',
  datongzi: '打筒子',
  fangpaofa: '放炮罚',
};

function isGameType(value: string): value is GameType {
  return value === 'paodekuai' || value === 'datongzi' || value === 'fangpaofa';
}

function normalizeGameType(value: unknown): GameType {
  const raw = String(value ?? 'paodekuai');
  return isGameType(raw) ? raw : 'paodekuai';
}

function normalizeRoomStatus(value: unknown): RoomRecord['status'] {
  const raw = String(value ?? 'waiting');
  if (raw === 'playing' || raw === 'finished' || raw === 'dissolved') {
    return raw;
  }
  return 'waiting';
}

function safeRandomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getGuestStorageValue(key: string, fallbackFactory: () => string) {
  if (typeof window === 'undefined') {
    return fallbackFactory();
  }

  const current = window.localStorage.getItem(key);
  if (current) {
    return current;
  }

  const nextValue = fallbackFactory();
  window.localStorage.setItem(key, nextValue);
  return nextValue;
}

function buildGuestName() {
  const guestKey = getGuestStorageValue(GUEST_KEY_STORAGE, safeRandomId);
  return getGuestStorageValue(GUEST_NAME_STORAGE, () => `游客${guestKey.slice(-4).toUpperCase()}`);
}

function getNumberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createRoomCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function toReadableError(error: unknown, fallback: string) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
      : typeof error === 'string'
        ? error
        : fallback;

  if (/row-level security policy/i.test(message) && message.includes('room_players')) {
    return new Error('room_players 表当前缺少写入策略。请先在 Supabase SQL Editor 重新执行 schema.sql 中新增的房间策略。');
  }

  return new Error(message || fallback);
}

function getRoomName(config: Record<string, unknown> | null, gameType: GameType) {
  const roomName = typeof config?.room_name === 'string' ? config.room_name.trim() : '';
  return roomName || `${getGameLabel(gameType)}房`;
}

function getBaseScore(config: Record<string, unknown> | null) {
  if (!config) {
    return 1;
  }

  if (typeof config.baseScore !== 'undefined') {
    return getNumberValue(config.baseScore, 1);
  }

  if (typeof config.base_score !== 'undefined') {
    return getNumberValue(config.base_score, 1);
  }

  return 1;
}

export function getGameLabel(gameType: GameType) {
  return GAME_LABELS[gameType] ?? gameType;
}

export function getClientPlayerIdentity({
  user,
  profile,
  isGuest,
}: {
  user: User | null;
  profile: Profile | null;
  isGuest: boolean;
}): PlayerIdentity {
  if (user) {
    const displayName =
      profile?.nickname?.trim() ||
      profile?.username?.trim() ||
      user.email?.split('@')[0] ||
      '牌友';

    return {
      userId: user.id,
      displayName,
      avatarUrl: profile?.avatar_url ?? DEFAULT_AVATAR,
      isGuest: false,
    };
  }

  const guestName = isGuest
    ? typeof window === 'undefined'
      ? '游客玩家'
      : buildGuestName()
    : '游客体验';

  return {
    userId: null,
    displayName: guestName,
    avatarUrl: DEFAULT_AVATAR,
    isGuest: true,
  };
}

export function makeDefaultRoomName(identity: PlayerIdentity, gameType: GameType) {
  return `${identity.displayName}的${getGameLabel(gameType)}房`;
}

export function matchesIdentity(player: RoomPlayerRecord, identity: PlayerIdentity) {
  if (!identity.userId) {
    return false;
  }

  return player.user_id === identity.userId;
}

function normalizeRoom(row: Record<string, unknown>): RoomRecord {
  return {
    id: String(row.id),
    room_code: String(row.room_code ?? ''),
    game_type: normalizeGameType(row.game_type),
    status: normalizeRoomStatus(row.status),
    max_players: Number(row.max_players ?? 0),
    host_id: (row.host_id as string | null) ?? null,
    config: (row.config as Record<string, unknown> | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

function normalizePlayer(row: Record<string, unknown>): RoomPlayerRecord {
  return {
    id: String(row.id),
    room_id: String(row.room_id),
    user_id: (row.user_id as string | null) ?? null,
    seat_index: Number(row.seat_index ?? 0),
    is_ready: Boolean(row.is_ready),
    is_bot: Boolean(row.is_bot),
    bot_name: (row.bot_name as string | null) ?? null,
    bot_avatar: (row.bot_avatar as string | null) ?? null,
    score: row.score == null ? null : Number(row.score),
  };
}

function groupPlayersByRoom(players: RoomPlayerRecord[]) {
  const grouped = new Map<string, RoomPlayerRecord[]>();

  for (const player of players) {
    const current = grouped.get(player.room_id) ?? [];
    current.push(player);
    grouped.set(player.room_id, current);
  }

  for (const current of grouped.values()) {
    current.sort((a, b) => a.seat_index - b.seat_index);
  }

  return grouped;
}

function deriveRoomSummary(room: RoomRecord, players: RoomPlayerRecord[]): RoomSummary {
  const hostPlayer =
    players.find((player) => room.host_id && player.user_id === room.host_id) ??
    players.find((player) => player.seat_index === 0) ??
    players[0];

  return {
    ...room,
    room_name: getRoomName(room.config, room.game_type),
    game_label: getGameLabel(room.game_type),
    host_name:
      hostPlayer?.bot_name ||
      (typeof room.config?.host_name === 'string' ? String(room.config.host_name) : '房主待定'),
    host_avatar: hostPlayer?.bot_avatar ?? DEFAULT_AVATAR,
    player_count: players.length,
    base_score: getBaseScore(room.config),
  };
}

export async function fetchWaitingRooms() {
  const { data: roomRows, error: roomError } = await supabase
    .from('rooms')
    .select('id, room_code, game_type, status, max_players, host_id, config, created_at, updated_at')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false });

  if (roomError) {
    throw toReadableError(roomError, '获取房间列表失败');
  }

  const rooms = (roomRows ?? []).map((row) => normalizeRoom(row as Record<string, unknown>));
  if (rooms.length === 0) {
    return [] as RoomSummary[];
  }

  const roomIds = rooms.map((room) => room.id);
  const { data: playerRows, error: playerError } = await supabase
    .from('room_players')
    .select('id, room_id, user_id, seat_index, is_ready, is_bot, bot_name, bot_avatar, score')
    .in('room_id', roomIds)
    .order('seat_index', { ascending: true });

  if (playerError) {
    throw toReadableError(playerError, '获取房间玩家失败');
  }

  const players = (playerRows ?? []).map((row) => normalizePlayer(row as Record<string, unknown>));
  const grouped = groupPlayersByRoom(players);

  return rooms
    .map((room) => deriveRoomSummary(room, grouped.get(room.id) ?? []))
    .filter((room) => room.player_count > 0);
}

export async function fetchRoomSnapshot(roomId: string) {
  const { data: roomRow, error: roomError } = await supabase
    .from('rooms')
    .select('id, room_code, game_type, status, max_players, host_id, config, created_at, updated_at')
    .eq('id', roomId)
    .maybeSingle();

  if (roomError) {
    throw toReadableError(roomError, '获取房间失败');
  }

  if (!roomRow) {
    return {
      room: null,
      players: [] as RoomPlayerRecord[],
    };
  }

  const { data: playerRows, error: playerError } = await supabase
    .from('room_players')
    .select('id, room_id, user_id, seat_index, is_ready, is_bot, bot_name, bot_avatar, score')
    .eq('room_id', roomId)
    .order('seat_index', { ascending: true });

  if (playerError) {
    throw toReadableError(playerError, '获取房间玩家失败');
  }

  return {
    room: normalizeRoom(roomRow as Record<string, unknown>),
    players: (playerRows ?? []).map((row) => normalizePlayer(row as Record<string, unknown>)),
  };
}

export async function fetchWaitingRoomByCode(roomCode: string) {
  const { data: roomRow, error: roomError } = await supabase
    .from('rooms')
    .select('id, room_code, game_type, status, max_players, host_id, config, created_at, updated_at')
    .eq('room_code', roomCode)
    .eq('status', 'waiting')
    .maybeSingle();

  if (roomError) {
    throw toReadableError(roomError, '获取房间失败');
  }

  if (!roomRow) {
    return null;
  }

  return normalizeRoom(roomRow as Record<string, unknown>);
}

export async function createRoomWithHost(input: {
  identity: PlayerIdentity;
  gameType: GameType;
  roomName?: string;
  maxPlayers: number;
  config?: Record<string, unknown>;
}) {
  if (!input.identity.userId) {
    throw new Error('请先登录');
  }

  const roomName = input.roomName?.trim() || makeDefaultRoomName(input.identity, input.gameType);
  const config = {
    ...(input.config ?? {}),
    room_name: roomName,
    host_name: input.identity.displayName,
  };

  const { data: roomRow, error: roomError } = await supabase
    .from('rooms')
    .insert({
      room_code: createRoomCode(),
      game_type: input.gameType,
      status: 'waiting',
      max_players: input.maxPlayers,
      host_id: input.identity.userId,
      config,
      updated_at: new Date().toISOString(),
    })
    .select('id, room_code, game_type, status, max_players, host_id, config, created_at, updated_at')
    .single();

  if (roomError || !roomRow) {
    throw toReadableError(roomError, '创建房间失败');
  }

  const room = normalizeRoom(roomRow as Record<string, unknown>);
  const { error: hostSeatError } = await supabase.from('room_players').insert({
    room_id: room.id,
    user_id: input.identity.userId,
    seat_index: 0,
    is_ready: false,
    is_bot: false,
    bot_name: input.identity.displayName,
    bot_avatar: input.identity.avatarUrl ?? DEFAULT_AVATAR,
  });

  if (hostSeatError) {
    throw toReadableError(hostSeatError, '创建房间失败');
  }

  return room;
}

export async function joinRoomById(roomId: string, identity: PlayerIdentity) {
  if (!identity.userId) {
    throw new Error('请先登录');
  }

  const snapshot = await fetchRoomSnapshot(roomId);
  if (!snapshot.room) {
    throw new Error('房间不存在或已关闭');
  }

  if (snapshot.room.status !== 'waiting') {
    throw new Error('房间已不在等待中');
  }

  const currentPlayer = snapshot.players.find((player) => matchesIdentity(player, identity));
  if (currentPlayer) {
    return {
      room: snapshot.room,
      player: currentPlayer,
    };
  }

  const occupiedSeats = new Set(snapshot.players.map((player) => player.seat_index));
  let nextSeat = -1;

  for (let seatIndex = 0; seatIndex < snapshot.room.max_players; seatIndex += 1) {
    if (!occupiedSeats.has(seatIndex)) {
      nextSeat = seatIndex;
      break;
    }
  }

  if (nextSeat === -1) {
    throw new Error('房间已满');
  }

  const { data: playerRow, error: joinError } = await supabase
    .from('room_players')
    .insert({
      room_id: roomId,
      user_id: identity.userId,
      seat_index: nextSeat,
      is_ready: false,
      is_bot: false,
      bot_name: identity.displayName,
      bot_avatar: identity.avatarUrl ?? DEFAULT_AVATAR,
    })
    .select('id, room_id, user_id, seat_index, is_ready, is_bot, bot_name, bot_avatar, score')
    .single();

  if (joinError || !playerRow) {
    throw toReadableError(joinError, '加入房间失败');
  }

  return {
    room: snapshot.room,
    player: normalizePlayer(playerRow as Record<string, unknown>),
  };
}

export async function joinRoomByCode(roomCode: string, identity: PlayerIdentity) {
  const room = await fetchWaitingRoomByCode(roomCode.trim());

  if (!room) {
    throw new Error('房间不存在');
  }

  return joinRoomById(room.id, identity);
}

export async function quickJoinRoom(identity: PlayerIdentity, filters?: GameType[]) {
  const waitingRooms = await fetchWaitingRooms();
  const candidates = waitingRooms.filter((room) => {
    if (room.player_count >= room.max_players) {
      return false;
    }

    if (!filters || filters.length === 0) {
      return true;
    }

    return filters.includes(room.game_type);
  });

  if (candidates.length === 0) {
    throw new Error('当前没有可加入的空房间');
  }

  const target = candidates[Math.floor(Math.random() * candidates.length)];
  return joinRoomById(target.id, identity);
}

export async function updateReadyState(playerId: string, nextReady: boolean) {
  const { error } = await supabase
    .from('room_players')
    .update({ is_ready: nextReady })
    .eq('id', playerId);

  if (error) {
    throw toReadableError(error, '更新准备状态失败');
  }
}

export async function startRoom(roomId: string) {
  const { error } = await supabase
    .from('rooms')
    .update({
      status: 'playing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId);

  if (error) {
    throw toReadableError(error, '开始游戏失败');
  }
}

export async function leaveRoom(roomId: string, identity: PlayerIdentity) {
  if (!identity.userId) {
    return;
  }

  const snapshot = await fetchRoomSnapshot(roomId);
  if (!snapshot.room) {
    return;
  }

  const currentPlayer = snapshot.players.find((player) => matchesIdentity(player, identity));
  if (!currentPlayer) {
    return;
  }

  const remainingPlayers = snapshot.players
    .filter((player) => player.id !== currentPlayer.id)
    .sort((a, b) => a.seat_index - b.seat_index);

  const hostPlayer =
    snapshot.players.find((player) => snapshot.room?.host_id && player.user_id === snapshot.room.host_id) ??
    snapshot.players.find((player) => player.seat_index === 0) ??
    snapshot.players[0];
  const isCurrentHost = hostPlayer?.id === currentPlayer.id;

  const { error: deleteError } = await supabase.from('room_players').delete().eq('id', currentPlayer.id);
  if (deleteError) {
    throw toReadableError(deleteError, '离开房间失败');
  }

  if (remainingPlayers.length === 0) {
    const { error: dissolveError } = await supabase
      .from('rooms')
      .update({
        status: 'dissolved',
        host_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId);

    if (dissolveError) {
      throw toReadableError(dissolveError, '关闭房间失败');
    }

    return;
  }

  if (isCurrentHost) {
    const nextHost = remainingPlayers[0];
    const nextConfig = {
      ...(snapshot.room.config ?? {}),
      host_name: nextHost.bot_name ?? '房主',
    };

    const { error: hostUpdateError } = await supabase
      .from('rooms')
      .update({
        host_id: nextHost.user_id,
        config: nextConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId);

    if (hostUpdateError) {
      throw toReadableError(hostUpdateError, '转移房主失败');
    }
  }
}

export function subscribeToLobby(onRefresh: () => void) {
  const channel = supabase
    .channel('lobby:rooms')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => onRefresh())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, () => onRefresh())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToRoom(roomId: string, onRefresh: () => void) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      () => onRefresh()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      () => onRefresh()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function removeRealtimeChannel(channel: RealtimeChannel) {
  void supabase.removeChannel(channel);
}
