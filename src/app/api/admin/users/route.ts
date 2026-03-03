import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticatedRequest, unauthorizedResponse } from '@/lib/admin-auth';
import { listAdminUsers } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const keyword = request.nextUrl.searchParams.get('keyword') ?? '';
  return NextResponse.json({ users: listAdminUsers(keyword) });
}
