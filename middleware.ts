// Защита /admin и /api/admin: проверяем cookie с админ-ключом.
// Если cookie нет или значение не совпадает — отправляем на /admin/login
// (для страниц) или возвращаем 401 (для API).

import { NextResponse, type NextRequest } from 'next/server';

export const ADMIN_COOKIE = 'fortochka_admin';

function isPublic(pathname: string): boolean {
  // Эти роуты доступны без cookie — иначе на /admin/login нельзя было бы зайти.
  if (pathname === '/admin/login') return true;
  if (pathname === '/api/admin/login') return true;
  if (pathname === '/api/admin/logout') return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  const expected = process.env.ADMIN_KEY ?? 'change-me';
  const ok = cookie && cookie === expected;
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/admin')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
