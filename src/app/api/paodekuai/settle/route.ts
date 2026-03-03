import { NextRequest, NextResponse } from 'next/server';
import { applyBalanceDelta } from '@/lib/economy/balance';
import type { PaodekuaiSettlementPayload } from '@/lib/games/paodekuai/persistence';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ADMIN_CONFIG_HINT = '服务端结算接口不可用，请检查 SUPABASE_SERVICE_ROLE_KEY，并确认已执行 supabase/schema.sql。';

interface RoomRow {
  id: string;
  room_code: string;
  game_type: string;
}

interface RoomPlayerRow {
  id: string;
  room_id: string;
  user_id: string | null;
  seat_index: number;
  is_bot: boolean;
  score: number | null;
  bot_name: string | null;
}

interface BalanceProfileRow {
  id: string;
  balance: number | null;
}

interface RoundRow {
  id: string;
}

export async function POST(request: NextRequest) {
  try {
    const serverClient = createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: '请先登录后再结算' }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as PaodekuaiSettlementPayload | null;
    if (!payload?.roomId || !Array.isArray(payload.players) || !payload.settlement) {
      return NextResponse.json({ message: '结算参数不完整' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: roomRow, error: roomError } = await adminClient
      .from('rooms')
      .select('id, room_code, game_type')
      .eq('id', payload.roomId)
      .maybeSingle();

    if (roomError) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    if (!roomRow) {
      return NextResponse.json({ message: '房间不存在或已关闭' }, { status: 404 });
    }

    const room = roomRow as RoomRow;

    const { data: playerRows, error: playerError } = await adminClient
      .from('room_players')
      .select('id, room_id, user_id, seat_index, is_bot, score, bot_name')
      .eq('room_id', payload.roomId)
      .order('seat_index', { ascending: true });

    if (playerError || !playerRows || playerRows.length === 0) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const roomPlayers = playerRows as unknown as RoomPlayerRow[];

    const currentPlayer = roomPlayers.find((player) => player.user_id === user.id);
    if (!currentPlayer) {
      return NextResponse.json({ message: '你不在当前房间中，无法结算' }, { status: 403 });
    }

    const participantCount = Math.min(roomPlayers.length, payload.players.length);
    if (participantCount === 0) {
      return NextResponse.json({ message: '缺少结算玩家信息' }, { status: 400 });
    }

    const { count: roundCount, error: roundCountError } = await adminClient
      .from('game_rounds')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', payload.roomId);

    if (roundCountError) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const now = new Date().toISOString();
    const winnerRow = roomPlayers[payload.winnerIndex] ?? null;
    const { data: roundRow, error: roundInsertError } = await adminClient
      .from('game_rounds')
      .insert({
        room_id: payload.roomId,
        round_number: (roundCount ?? 0) + 1,
        state: {
          config: payload.config,
          last_action: payload.lastAction,
          players: payload.players.slice(0, participantCount).map((player) => ({
            user_id: player.userId,
            nickname: player.nickname,
            is_bot: player.isBot,
            score: player.score,
          })),
        },
        result: {
          settlement: payload.settlement,
          summary: payload.settlement.summary,
          players: payload.players.slice(0, participantCount),
        },
        winner_id: winnerRow?.user_id ?? null,
        rake_amount: payload.settlement.rakeAmount,
        finished_at: now,
      })
      .select('id')
      .single();

    if (roundInsertError || !roundRow) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const round = roundRow as RoundRow;

    const profileIds = roomPlayers
      .map((player) => player.user_id)
      .filter((playerId): playerId is string => Boolean(playerId));
    const uniqueProfileIds = Array.from(new Set(profileIds));
    const profileBalances = new Map<string, number>();

    if (uniqueProfileIds.length > 0) {
      const { data: profileRows, error: profilesError } = await adminClient
        .from('profiles')
        .select('id, balance')
        .in('id', uniqueProfileIds);

      if (profilesError) {
        return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
      }

      for (const profile of (profileRows ?? []) as BalanceProfileRow[]) {
        profileBalances.set(String(profile.id), Number(profile.balance ?? 0));
      }
    }

    let currentUserBalance: number | null = null;

    for (let index = 0; index < participantCount; index += 1) {
      const roomPlayer = roomPlayers[index];
      const resultPlayer = payload.players[index];
      const nextScore = Number(resultPlayer.score ?? roomPlayer.score ?? 0);
      const roomPlayerId = String(roomPlayer.id);

      const { error: scoreError } = await adminClient
        .from('room_players')
        .update({ score: nextScore })
        .eq('id', roomPlayerId);

      if (scoreError) {
        return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
      }

      if (!roomPlayer.user_id) {
        continue;
      }

      const roomPlayerUserId = String(roomPlayer.user_id);

      const delta = Number(resultPlayer.delta ?? 0);
      if (delta === 0) {
        continue;
      }

      const currentBalance = profileBalances.get(roomPlayerUserId);
      if (currentBalance == null) {
        continue;
      }

      const nextBalance = applyBalanceDelta(currentBalance, delta);
      profileBalances.set(roomPlayerUserId, nextBalance);

      const { error: balanceError } = await adminClient
        .from('profiles')
        .update({
          balance: nextBalance,
          last_online: now,
        })
        .eq('id', roomPlayerUserId);

      if (balanceError) {
        return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
      }

      const description = `跑得快结算（房号 ${room.room_code}，已含 ${payload.settlement.rakeAmount} 分抽水）`;
      const { error: balanceLogError } = await adminClient.from('balance_logs').insert({
        user_id: roomPlayerUserId,
        amount: delta,
        balance_after: nextBalance,
        type: delta > 0 ? 'game_win' : 'game_lose',
        description,
        reference_id: round.id,
      });

      if (balanceLogError) {
        return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
      }

      if (roomPlayerUserId === user.id) {
        currentUserBalance = nextBalance;
      }
    }

    await adminClient
      .from('rooms')
      .update({
        status: 'playing',
        updated_at: now,
      })
      .eq('id', payload.roomId);

    return NextResponse.json({
      ok: true,
      roundId: round.id,
      balance: currentUserBalance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务异常，请稍后再试';
    return NextResponse.json({ message }, { status: 500 });
  }
}
