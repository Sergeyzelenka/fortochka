import { NextRequest, NextResponse } from 'next/server';
import { getPending } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(_req: NextRequest) {
  const items = await getPending();
  return NextResponse.json({ items }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}
