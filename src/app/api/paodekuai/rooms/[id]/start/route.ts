import { NextResponse } from 'next/server';
import { botAvatars } from '@/lib/bot/avatars';
import { botNames } from '@/lib/bot/names';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ADMIN_CONFIG_HINT = '服务端开局接口不可用，请检查 SUPABASE_SERVICE_ROLE_KEY，并确认已执行 supabase/schema.sql。';

interface RouteContext {
  params: {
    id: string;
  };
}

interface RoomRow {
  id: string;
  room_code: string;
  game_type: string;
  status: string;
  host_id: string | null;
  max_players: number | null;
}

interface RoomPlayerRow {
  id: string;
  room_id: string;
  seat_index: number | null;
  is_bot: boolean;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const roomId = context.params.id;
    const serverClient = createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: '请先登录后再开始对局' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: roomRow, error: roomError } = await adminClient
      .from('rooms')
      .select('id, room_code, game_type, status, host_id, max_players')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    if (!roomRow) {
      return NextResponse.json({ message: '房间不存在或已关闭' }, { status: 404 });
    }

    const room = roomRow as RoomRow;

    if (room.game_type !== 'paodekuai') {
      return NextResponse.json({ message: '当前房间不是跑得快房间' }, { status: 400 });
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ message: '只有房主可以开始对局' }, { status: 403 });
    }

    const { data: playerRows, error: playerError } = await adminClient
      .from('room_players')
      .select('id, room_id, seat_index, is_bot')
      .eq('room_id', roomId)
      .order('seat_index', { ascending: true });

    if (playerError) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const players = (playerRows ?? []) as RoomPlayerRow[];
    const maxPlayers = Math.max(2, Number(room.max_players ?? 3));
    const occupiedSeats = new Set(players.map((player) => Number(player.seat_index ?? -1)));
    const botRows: Array<Record<string, unknown>> = [];

    for (let seatIndex = 0; seatIndex < maxPlayers; seatIndex += 1) {
      if (occupiedSeats.has(seatIndex)) {
        continue;
      }

      const botIndex = (seatIndex + room.room_code.length) % botNames.length;
      botRows.push({
        room_id: roomId,
        user_id: null,
        seat_index: seatIndex,
        is_ready: true,
        is_bot: true,
        bot_name: botNames[botIndex] ?? `机器人${seatIndex + 1}`,
        bot_avatar: botAvatars[botIndex % botAvatars.length] ?? '/assets/avatars/default.png',
        score: 0,
      });
    }

    if (botRows.length > 0) {
      const { error: botInsertError } = await adminClient.from('room_players').insert(botRows);

      if (botInsertError) {
        return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
      }
    }

    const { error: readyError } = await adminClient
      .from('room_players')
      .update({ is_ready: true })
      .eq('room_id', roomId);

    if (readyError) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    const { error: roomUpdateError } = await adminClient
      .from('rooms')
      .update({
        status: 'playing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId);

    if (roomUpdateError) {
      return NextResponse.json({ message: ADMIN_CONFIG_HINT }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务异常，请稍后再试';
    return NextResponse.json({ message }, { status: 500 });
  }
}
