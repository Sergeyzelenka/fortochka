import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/middleware';

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* пусто */ }
  const expected = process.env.ADMIN_KEY ?? 'change-me';
  if (body?.key !== expected) {
    return NextResponse.json({ error: 'invalid' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS,
    secure: process.env.NODE_ENV === 'production'
  });
  return res;
}
