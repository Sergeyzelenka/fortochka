'use client';
import { useEffect, useLayoutEffect, useState } from 'react';
import WeatherIcon from '@/components/WeatherIcon';

// На сервере useLayoutEffect шумит warning'ом — подменяем на useEffect.
const useIsoEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface WeatherData {
  city: string;
  tempC: number;
  code: number;
  isDay: boolean;
}

function describeWeather(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? 'солнечно' : 'ясная ночь';
  if (code === 1) return isDay ? 'преимущественно ясно' : 'почти ясная ночь';
  if (code === 2) return 'переменная облачность';
  if (code === 3) return 'пасмурно';
  if (code === 45) return 'туман';
  if (code === 48) return 'изморозь и туман';
  if (code >= 51 && code <= 55) return 'идёт моросящий дождь';
  if (code === 56 || code === 57) return 'идёт ледяная морось';
  if (code === 61 || code === 63) return 'идёт дождь';
  if (code === 65) return 'идёт сильный дождь';
  if (code === 66 || code === 67) return 'идёт ледяной дождь';
  if (code === 71 || code === 73) return 'идёт снег';
  if (code === 75) return 'идёт сильный снег';
  if (code === 77) return 'идёт снежная крупа';
  if (code === 80 || code === 81) return 'идёт ливень';
  if (code === 82) return 'идёт сильный ливень';
  if (code === 85 || code === 86) return 'идёт снежный ливень';
  if (code === 95) return 'гроза';
  if (code === 96 || code === 99) return 'гроза с градом';
  return 'погода спокойная';
}

const CACHE_KEY = 'fortochka-weather';
const TTL_MS = 5 * 60_000;

interface Cached { data: WeatherData; ts: number }

function readCache(): Cached | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (Date.now() - c.ts > TTL_MS) return null;
    return c;
  } catch { return null; }
}

function writeCache(data: WeatherData) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota / private mode */ }
}

export default function Weather() {
  // Первый рендер ВСЕГДА null (= совпадает с серверным null).
  // useLayoutEffect выставляет данные ДО paint — пользователь не видит мерцания
  // при переходах между страницами, если данные есть в sessionStorage.
  const [data, setData] = useState<WeatherData | null>(null);

  useIsoEffect(() => {
    const c = readCache();
    if (c) setData(c.data);
  }, []);

  useEffect(() => {
    let alive = true;
    if (readCache()) return;
    (async () => {
      // На localhost у сервера в headers всегда 127.0.0.1, поэтому сначала
      // узнаём свой публичный IP у ipify и передаём его серверу параметром.
      // В проде это безвредно — заголовок x-forwarded-for всё равно совпадёт.
      let ip = '';
      try {
        const r = await fetch('https://api.ipify.org?format=json');
        if (r.ok) ip = (await r.json()).ip ?? '';
        console.log('[weather] ipify:', ip || 'EMPTY');
      } catch (e) {
        console.log('[weather] ipify failed:', e);
      }
      if (!ip) {
        try {
          const r = await fetch('https://ipv4.icanhazip.com/');
          if (r.ok) ip = (await r.text()).trim();
          console.log('[weather] icanhazip:', ip || 'EMPTY');
        } catch (e) {
          console.log('[weather] icanhazip failed:', e);
        }
      }
      try {
        const r = await fetch(`/api/weather${ip ? `?ip=${encodeURIComponent(ip)}` : ''}`);
        if (!r.ok) return;
        const d = await r.json();
        if (alive && d && !d.error) {
          setData(d);
          writeCache(d);
        }
      } catch (e) {
        console.log('[weather] api failed:', e);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!data) return null;
  const sign = data.tempC > 0 ? '+' : '';
  const desc = describeWeather(data.code, data.isDay);
  const tooltipText = `Сейчас в ${data.city} ${desc}, ${sign}${data.tempC}°`;
  return (
    <span className="weather">
      {' · '}
      <span className="w-ico" aria-hidden="true"><WeatherIcon code={data.code} isDay={data.isDay} /></span>
      <span className="w-temp">{sign}{data.tempC}°</span>
      <span className="w-city">{data.city}</span>
      <span className="w-tooltip" role="tooltip">{tooltipText}</span>
    </span>
  );
}
