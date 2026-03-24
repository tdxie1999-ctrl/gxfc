import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ADMIN_CONFIG_HINT = '服务端房间接口不可用，请检查 SUPABASE_SERVICE_ROLE_KEY，并确认已执行 supabase/schema.sql。';

type SupportedGameType = 'paodekuai' | 'datongzi' | 'fangpaofa';

const gameMeta: Record<SupportedGameType, { maxPlayers: number; title: string }> = {
  paodekuai: { maxPlayers: 3, title: '跑得快' },
  datongzi: { maxPlayers: 2, title: '打筒子' },
  fangpaofa: { maxPlayers: 3, title: '娄底放炮罚' },
};

interface ProfileRow {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  diamonds: number | null;
}

function isSupportedGameType(value: unknown): value is SupportedGameType {
  return value === 'paodekuai' || value === 'datongzi' || value === 'fangpaofa';
}

function createRoomCode() {
  return Math.random().toString().slice(2, 8);
}

function getNumberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function insertRoomWithRetry(payload: {
  gameType: SupportedGameType;
  baseScore: number;
  hostId: string;
  hostName: string;
  config: Record<string, unknown>;
  maxPlayers: number;
  rakePercent: number;
}) {
  const adminClient = createAdminClient();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const roomCode = createRoomCode();
    const { data, error } = await adminClient
      .from('rooms')
      .insert({
        room_code: roomCode,
        game_type: payload.gameType,
        status: 'waiting',
        host_id: payload.hostId,
        max_players: payload.maxPlayers,
        diamond_cost: 2,
        rake_percent: payload.rakePercent,
        config: {
          ...payload.config,
          baseScore: payload.baseScore,
          hostName: payload.hostName,
        },
      })
      .select('id, room_code')
      .single();

    if (!error && data) {
      return data as { id: string; room_code: string };
    }

    const message = error?.message?.toLowerCase() ?? '';
    if ((message.includes('duplicate') || message.includes('unique')) && attempt < 5) {
      continue;
    }

    throw error ?? new Error('创建房间失败');
  }

  throw new Error('房间号生成失败，请稍后重试');
}

export async function POST(request: NextRequest) {
  try {
    const serverClient = createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: '请先登录后再创建房间' }, { status: 401 });
    }

    const requestBody = (await request.json().catch(() => ({}))) as {
      gameType?: SupportedGameType;
      config?: Record<string, unknown>;
      baseScore?: number;
    };

    if (!isSupportedGameType(requestBody.gameType)) {
      return NextResponse.json({ message: '暂不支持该玩法建房' }, { status: 400 });
    }

    const gameType = requestBody.gameType;
    const inputConfig =
      requestBody.config && typeof requestBody.config === 'object' ? requestBody.config : {};
    const baseScore = Math.max(0.5, getNumberValue(requestBody.baseScore, 1));
    const rakePercent = Math.max(
      0,
      getNumberValue(
        gameType === 'paodekuai' && inputConfig.paodekuai && typeof inputConfig.paodekuai === 'object'
          ? (inputConfig.paodekuai as Record<string, unknown>).rakePercent
          : inputConfig.rake_percent,
        5,
      ),
    );

    const adminClient = createAdminClient();
    const { data: profileRow, error: profileError } = await adminClient
      .from('profiles')
      .select('id, nickname, avatar_url, diamonds')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    if (!profileRow) {
      return NextResponse.json({ message: '未找到用户资料，请重新登录后重试' }, { status: 404 });
    }

    const profile = profileRow as ProfileRow;
    const diamonds = Number(profile.diamonds ?? 0);
    if (diamonds < 2) {
      return NextResponse.json({ message: '钻石不足，无法创建房间' }, { status: 400 });
    }

    const hostName = String(profile.nickname ?? '牌友');
    const room = await insertRoomWithRetry({
      gameType,
      baseScore,
      hostId: user.id,
      hostName,
      maxPlayers: gameMeta[gameType].maxPlayers,
      rakePercent,
      config: {
        ...inputConfig,
        requested_game_type: gameType,
        host_name: hostName,
      },
    });

    const { error: seatError } = await adminClient.from('room_players').insert({
      room_id: room.id,
      user_id: user.id,
      seat_index: 0,
      is_ready: false,
      is_bot: false,
      bot_name: hostName,
      bot_avatar: String(profile.avatar_url ?? '/assets/avatars/default.png'),
      score: 0,
    });

    if (seatError) {
      await adminClient.from('rooms').delete().eq('id', room.id);
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const diamondsAfter = diamonds - 2;
    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({
        diamonds: diamondsAfter,
        last_online: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileUpdateError) {
      await adminClient.from('rooms').delete().eq('id', room.id);
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const { error: diamondLogError } = await adminClient.from('diamond_logs').insert({
      user_id: user.id,
      amount: -2,
      diamonds_after: diamondsAfter,
      type: 'room_create',
      description: `创建${gameMeta[gameType].title}房间 ${room.room_code}`,
    });

    if (diamondLogError) {
      await adminClient
        .from('profiles')
        .update({
          diamonds,
          last_online: new Date().toISOString(),
        })
        .eq('id', user.id);
      await adminClient.from('rooms').delete().eq('id', room.id);
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      roomId: room.id,
      roomCode: room.room_code,
      diamondsAfter,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务异常，请稍后再试';
    return NextResponse.json({ message }, { status: 500 });
  }
}
