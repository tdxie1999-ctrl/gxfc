import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ADMIN_CONFIG_HINT = '服务端房间接口不可用，请检查 SUPABASE_SERVICE_ROLE_KEY，并确认已执行 supabase/schema.sql。';

interface ProfileRow {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  diamonds: number | null;
}

interface RoomRow {
  id: string;
  room_code: string;
  config: Record<string, unknown> | null;
}

function createRoomCode() {
  return Math.random().toString().slice(2, 8);
}

function getNumberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
      config?: Record<string, unknown>;
      baseScore?: number;
    };

    const inputConfig =
      requestBody.config && typeof requestBody.config === 'object' ? requestBody.config : {};
    const paodekuaiConfig =
      inputConfig.paodekuai && typeof inputConfig.paodekuai === 'object'
        ? (inputConfig.paodekuai as Record<string, unknown>)
        : {};

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
      return NextResponse.json({ message: '钻石不足，无法创建跑得快房间' }, { status: 400 });
    }

    const baseScore = Math.max(0.5, getNumberValue(requestBody.baseScore, 1));
    const roomName =
      typeof inputConfig.room_name === 'string' && inputConfig.room_name.trim()
        ? inputConfig.room_name.trim()
        : `${String(profile.nickname ?? '牌友')}的跑得快房`;
    const rakePercent = Math.max(0, getNumberValue(paodekuaiConfig.rakePercent, 5));

    const config = {
      ...inputConfig,
      room_name: roomName,
      requested_game_type: 'paodekuai',
      host_name: String(profile.nickname ?? '房主'),
      baseScore,
      paodekuai: {
        ...paodekuaiConfig,
        basePoint: Math.max(0.5, getNumberValue(paodekuaiConfig.basePoint, baseScore)),
        rakePercent,
      },
    };

    const { data: roomRow, error: roomError } = await adminClient
      .from('rooms')
      .insert({
        room_code: createRoomCode(),
        game_type: 'paodekuai',
        status: 'waiting',
        host_id: user.id,
        max_players: 3,
        diamond_cost: 2,
        rake_percent: rakePercent,
        config,
      })
      .select('id, room_code, config')
      .single();

    if (roomError || !roomRow) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const room = roomRow as RoomRow;

    const { error: seatError } = await adminClient.from('room_players').insert({
      room_id: room.id,
      user_id: user.id,
      seat_index: 0,
      is_ready: true,
      is_bot: false,
      bot_name: String(profile.nickname ?? '你'),
      bot_avatar: String(profile.avatar_url ?? '/assets/avatars/default.png'),
      score: 0,
    });

    if (seatError) {
      await adminClient.from('rooms').delete().eq('id', room.id);
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const diamondsAfter = diamonds - 2;
    const { error: diamondUpdateError } = await adminClient
      .from('profiles')
      .update({
        diamonds: diamondsAfter,
        last_online: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (diamondUpdateError) {
      await adminClient.from('rooms').delete().eq('id', room.id);
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const { error: diamondLogError } = await adminClient.from('diamond_logs').insert({
      user_id: user.id,
      amount: -2,
      diamonds_after: diamondsAfter,
      type: 'room_create',
      description: `创建跑得快房间 ${room.room_code}`,
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
      roomId: room.id,
      roomCode: room.room_code,
      diamondsAfter,
      config: room.config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务异常，请稍后再试';
    return NextResponse.json({ message }, { status: 500 });
  }
}
