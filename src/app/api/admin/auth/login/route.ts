import { NextResponse } from 'next/server';
import { applyAdminSession, verifyAdminPassword } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password?.trim() ?? '';

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: '管理密码错误' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  applyAdminSession(response);
  return response;
}
