import { NextRequest, NextResponse } from 'next/server';
import { applyBalanceDelta } from '@/lib/economy/balance';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AdminSupabaseClient } from '@/lib/supabase/admin';
import type {
  FangpaofaPersistPayload,
  FangpaofaPersistPlayerSnapshot,
} from '@/lib/games/fangpaofa/persistence';

import { isAdminAuthenticatedRequest, unauthorizedResponse } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const ADMIN_CONFIG_HINT = '后台读取接口不可用，请检查 SUPABASE_SERVICE_ROLE_KEY，并确认已执行 supabase/schema.sql。';

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const roomId = request.nextUrl.searchParams.get('roomId');

  if (roomId) {
    try {
      const supabase = createAdminClient();
      const room = await supabase
        .from('rooms')
        .select(
          'id, room_code, game_type, status, config, host_id, diamond_cost, rake_percent, max_players, created_at, updated_at'
        )
        .eq('id', roomId)
        .maybeSingle();

      if (room.error) {
        return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
      }

      if (!room.data) {
        return NextResponse.json({ message: '房间不存在或已关闭' }, { status: 404 });
      }

      const players = await supabase
        .from('room_players')
        .select('id, room_id, user_id, seat_index, is_ready, is_bot, bot_name, bot_avatar, score')
        .eq('room_id', roomId)
        .order('seat_index', { ascending: true });

      if (players.error) {
        return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
      }

      const rounds = await supabase
        .from('game_rounds')
        .select('id, room_id, round_number, state, result, winner_id, is_rigged, rigged_config, rake_amount, started_at, finished_at')
        .eq('room_id', roomId)
        .order('round_number', { ascending: false })
        .limit(20);

      if (rounds.error) {
        return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
      }

      const playerIds = Array.from(
        new Set(
          ((players.data ?? []) as Array<{ user_id?: string | null }>)
            .map((player) => player.user_id)
            .filter((playerId): playerId is string => Boolean(playerId))
        )
      );

      let balanceLogs: Record<string, unknown>[] = [];

      if (playerIds.length > 0) {
        const logs = await supabase
          .from('balance_logs')
          .select('id, user_id, amount, balance_after, type, description, reference_id, created_at')
          .in('user_id', playerIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (logs.error) {
          return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
        }

        balanceLogs = (logs.data ?? []) as Record<string, unknown>[];
      }

      return NextResponse.json({
        room: room.data,
        players: players.data ?? [],
        rounds: rounds.data ?? [],
        balanceLogs,
      });
    } catch (error) {
      return NextResponse.json(
        {
          message: error instanceof Error ? error.message : '读取房间数据失败',
        },
        { status: 500 }
      );
    }
  }

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ rooms: [] });
  }

  const { ensureAdminSeedData, listRooms } = await import('@/lib/admin-db');
  ensureAdminSeedData();
  return NextResponse.json({ rooms: listRooms() });
}

function isUuid(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toGameRoundState(payload: FangpaofaPersistPayload) {
  return {
    source: 'fangpaofa_client_engine',
    room: payload.room,
    roundNumber: payload.roundNumber,
    config: payload.config,
    actionLog: payload.actionLog,
    discardValues: payload.discardValues,
    deckRemainder: payload.deckRemainder,
    players: payload.players,
  };
}

function toGameRoundResult(payload: FangpaofaPersistPayload) {
  return {
    winnerIndex: payload.winnerIndex,
    settlement: payload.settlement,
    finishedAt: payload.finishedAt,
  };
}

async function ensureRoom(
  supabase: AdminSupabaseClient,
  payload: FangpaofaPersistPayload
) {
  const existing = await supabase
    .from('rooms')
    .select('id')
    .eq('room_code', payload.room.roomCode)
    .maybeSingle();

  if (existing.error && existing.error.code !== 'PGRST116') {
    throw new Error(existing.error.message);
  }

  const existingRoomId = (existing.data as { id?: string } | null)?.id ?? null;

  if (existingRoomId) {
    await supabase
      .from('rooms')
      .update({
        status: 'finished',
        config: {
          local_room_id: payload.room.localRoomId,
          label: payload.room.label,
          base_score: payload.room.baseScore,
        },
        rake_percent: payload.config.rakePercent,
        max_players: payload.room.maxPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRoomId);

    return existingRoomId;
  }

  const inserted = await supabase
    .from('rooms')
    .insert({
      room_code: payload.room.roomCode,
      game_type: 'fangpaofa',
      status: 'finished',
      config: {
        local_room_id: payload.room.localRoomId,
        label: payload.room.label,
        base_score: payload.room.baseScore,
      },
      host_id: isUuid(payload.humanProfileId) ? payload.humanProfileId : null,
      diamond_cost: 2,
      rake_percent: payload.config.rakePercent,
      max_players: payload.room.maxPlayers,
    })
    .select('id')
    .single();

  const insertedRoomId = (inserted.data as { id?: string } | null)?.id ?? null;

  if (inserted.error || !insertedRoomId) {
    throw new Error(inserted.error?.message || '创建房间记录失败');
  }

  return insertedRoomId;
}

async function syncRoomPlayers(
  supabase: AdminSupabaseClient,
  roomId: string,
  players: FangpaofaPersistPlayerSnapshot[],
  humanProfileId: string | null
) {
  const rows = players.map((player, index) => ({
    room_id: roomId,
    user_id: !player.isBot && isUuid(humanProfileId) ? humanProfileId : null,
    seat_index: index,
    is_ready: true,
    is_bot: player.isBot,
    bot_name: player.isBot ? player.nickname : null,
    bot_avatar: null,
    score: player.score,
  }));

  const result = await supabase.from('room_players').upsert(rows, {
    onConflict: 'room_id,seat_index',
    ignoreDuplicates: false,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function persistBalanceTrace(
  supabase: AdminSupabaseClient,
  payload: FangpaofaPersistPayload,
  gameRoundId: string
) {
  const humanProfileId = payload.humanProfileId;

  if (!isUuid(humanProfileId)) {
    return { updatedBalance: null, skipped: true as const };
  }

  const humanPlayer = payload.players.find((player) => !player.isBot);

  if (!humanPlayer) {
    return { updatedBalance: null, skipped: true as const };
  }

  const humanSettlement = payload.settlement.players.find(
    (player) => player.userId === humanPlayer.userId
  );

  if (!humanSettlement || humanSettlement.netDelta === 0) {
    return { updatedBalance: null, skipped: true as const };
  }

  const profileResult = await supabase
    .from('profiles')
    .select('balance')
    .eq('id', humanProfileId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) {
    throw new Error(profileResult.error?.message || '读取用户余额失败');
  }

  const currentBalance = Number(profileResult.data.balance ?? 0);
  const logs: Array<{
    user_id: string;
    amount: number;
    balance_after: number;
    type: 'game_win' | 'game_lose' | 'game_rake';
    description: string;
    reference_id: string;
  }> = [];

  let nextBalance = currentBalance;

  if (humanSettlement.netDelta > 0) {
    const rawWin = Number(humanSettlement.rawDelta ?? humanSettlement.netDelta);
    nextBalance = applyBalanceDelta(nextBalance, rawWin);
    logs.push({
      user_id: humanProfileId,
      amount: rawWin,
      balance_after: nextBalance,
      type: 'game_win',
      description: `放炮罚房间${payload.room.roomCode}第${payload.roundNumber}局赢`,
      reference_id: gameRoundId,
    });

    if (humanSettlement.rake > 0) {
      nextBalance = applyBalanceDelta(nextBalance, -humanSettlement.rake);
      logs.push({
        user_id: humanProfileId,
        amount: -humanSettlement.rake,
        balance_after: nextBalance,
        type: 'game_rake',
        description: `放炮罚房间${payload.room.roomCode}第${payload.roundNumber}局抽水`,
        reference_id: gameRoundId,
      });
    }
  } else {
    nextBalance = applyBalanceDelta(nextBalance, humanSettlement.netDelta);
    logs.push({
      user_id: humanProfileId,
      amount: humanSettlement.netDelta,
      balance_after: nextBalance,
      type: 'game_lose',
      description: `放炮罚房间${payload.room.roomCode}第${payload.roundNumber}局输`,
      reference_id: gameRoundId,
    });
  }

  const updatedProfile = await supabase
    .from('profiles')
    .update({
      balance: nextBalance,
      last_online: new Date().toISOString(),
    })
    .eq('id', humanProfileId);

  if (updatedProfile.error) {
    throw new Error(updatedProfile.error.message);
  }

  if (logs.length > 0) {
    const insertedLogs = await supabase.from('balance_logs').insert(logs);

    if (insertedLogs.error) {
      throw new Error(insertedLogs.error.message);
    }
  }

  return { updatedBalance: nextBalance, skipped: false as const };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as FangpaofaPersistPayload | null;

  if (!body || body.action !== 'fangpaofa_settle') {
    return NextResponse.json({ ok: false, reason: '不支持的action' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const roomId = await ensureRoom(supabase, body);
    await syncRoomPlayers(supabase, roomId, body.players, body.humanProfileId);

    const gameRound = await supabase
      .from('game_rounds')
      .insert({
        room_id: roomId,
        round_number: body.roundNumber,
        state: toGameRoundState(body),
        result: toGameRoundResult(body),
        winner_id:
          body.winnerIndex !== null &&
          body.players[body.winnerIndex] &&
          !body.players[body.winnerIndex].isBot &&
          isUuid(body.humanProfileId)
            ? body.humanProfileId
            : null,
        is_rigged: false,
        rigged_config: null,
        rake_amount: body.settlement.totalRake,
        finished_at: body.finishedAt,
      })
      .select('id')
      .single();

    if (gameRound.error || !gameRound.data?.id) {
      throw new Error(gameRound.error?.message || '写入 game_rounds 失败');
    }

    const balanceTrace = await persistBalanceTrace(supabase, body, gameRound.data.id as string);

    return NextResponse.json({
      ok: true,
      gameRoundId: gameRound.data.id,
      updatedBalance: balanceTrace.updatedBalance,
      skipped: balanceTrace.skipped,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : '放炮罚结算写入失败',
      },
      { status: 500 }
    );
  }
}
