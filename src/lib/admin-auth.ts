import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const ADMIN_ENTRY_KEY = 'gxfc2026';
export const ADMIN_ENTRY_PATH = `/admin/${ADMIN_ENTRY_KEY}`;
export const ADMIN_PASSWORD = 'gxfc888888';
export const ADMIN_COOKIE_NAME = 'gxfc_admin_session';

const ADMIN_COOKIE_VALUE = 'gxfc_admin_ok_2026';
const ADMIN_MAX_AGE = 60 * 60 * 12;

export function verifyAdminPassword(password: string) {
  return password === ADMIN_PASSWORD;
}

export function isAdminAuthenticatedRequest(request: NextRequest) {
  return request.cookies.get(ADMIN_COOKIE_NAME)?.value === ADMIN_COOKIE_VALUE;
}

export function isAdminAuthenticatedServer() {
  return cookies().get(ADMIN_COOKIE_NAME)?.value === ADMIN_COOKIE_VALUE;
}

export function applyAdminSession(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: ADMIN_COOKIE_VALUE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_MAX_AGE,
  });
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: '未授权，请先登录管理后台' }, { status: 401 });
}
