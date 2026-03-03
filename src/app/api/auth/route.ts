import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    provider: 'supabase-client',
    guestMode: request.cookies.get('guest_mode')?.value === '1',
    message: '前端通过 Supabase Client 完成登录注册，这里仅返回当前访客模式状态。',
  });
}
