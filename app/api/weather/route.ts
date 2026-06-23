import { NextRequest, NextResponse } from 'next/server';

interface CacheEntry { data: any; ts: number; }
const TTL_MS = 5 * 60_000;
const cache = new Map<string, CacheEntry>();

const FALLBACK = { city: 'Москва', lat: 55.7558, lon: 37.6173 };

function getIp(req: NextRequest): string {
  const fromQuery = new URL(req.url).searchParams.get('ip');
  if (fromQuery) return fromQuery.trim();
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? '';
}

async function tryIpwho(ip: string): Promise<{ city: string; lat: number; lon: number } | string> {
  try {
    const r = await fetch(`https://ipwho.is/${ip}`, {
      headers: { 'user-agent': 'Mozilla/5.0 FortochkaWeather/1.0' }
    });
    if (!r.ok) return `ipwho ${r.status}`;
    const j: any = await r.json();
    if (j.success === false) return `ipwho: ${j.message ?? 'success=false'}`;
    if (typeof j.latitude !== 'number' || typeof j.longitude !== 'number') return 'ipwho: no coords';
    return { city: j.city ?? j.region ?? FALLBACK.city, lat: j.latitude, lon: j.longitude };
  } catch (e: any) {
    return `ipwho threw: ${e?.message ?? e}`;
  }
}

async function tryIpapi(ip: string): Promise<{ city: string; lat: number; lon: number } | string> {
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'user-agent': 'Mozilla/5.0 FortochkaWeather/1.0' }
    });
    if (!r.ok) return `ipapi ${r.status}`;
    const j: any = await r.json();
    if (j.error) return `ipapi: ${j.reason ?? 'error'}`;
    if (typeof j.latitude !== 'number' || typeof j.longitude !== 'number') return 'ipapi: no coords';
    return { city: j.city ?? j.region ?? FALLBACK.city, lat: j.latitude, lon: j.longitude };
  } catch (e: any) {
    return `ipapi threw: ${e?.message ?? e}`;
  }
}

async function tryIpwhois(ip: string): Promise<{ city: string; lat: number; lon: number } | string> {
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon`);
    if (!r.ok) return `ip-api ${r.status}`;
    const j: any = await r.json();
    if (j.status !== 'success') return `ip-api: ${j.message ?? 'fail'}`;
    if (typeof j.lat !== 'number' || typeof j.lon !== 'number') return 'ip-api: no coords';
    return { city: j.city ?? j.regionName ?? FALLBACK.city, lat: j.lat, lon: j.lon };
  } catch (e: any) {
    return `ip-api threw: ${e?.message ?? e}`;
  }
}

async function lookupGeo(ip: string): Promise<{ city: string; lat: number; lon: number; debug?: string }> {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('::') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    return { ...FALLBACK, debug: 'private-ip' };
  }
  const reasons: string[] = [];
  for (const fn of [tryIpwho, tryIpapi, tryIpwhois]) {
    const r = await fn(ip);
    if (typeof r === 'object') return r;
    reasons.push(r);
  }
  return { ...FALLBACK, debug: reasons.join(' | ') };
}

async function fetchWeather(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`open-meteo ${r.status}`);
  const j: any = await r.json();
  const c = j.current ?? {};
  return {
    tempC: Math.round(c.temperature_2m ?? 0),
    code: Number(c.weather_code ?? 0),
    isDay: c.is_day === 1
  };
}

export async function GET(req: NextRequest) {
  const ip = getIp(req);
  const key = ip || 'fallback';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json(hit.data);
  }
  try {
    const geo = await lookupGeo(ip);
    const w = await fetchWeather(geo.lat, geo.lon);
    const data = { city: geo.city, ...w, ip, debug: geo.debug };
    cache.set(key, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
