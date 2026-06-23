import { NextRequest, NextResponse } from 'next/server';
import { getPending } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const items = await getPending();
  return NextResponse.json({ items });
}
