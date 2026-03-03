import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticatedRequest, unauthorizedResponse } from '@/lib/admin-auth';
import { listEconomyLogs } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 120);
  return NextResponse.json({ logs: listEconomyLogs(limit) });
}
