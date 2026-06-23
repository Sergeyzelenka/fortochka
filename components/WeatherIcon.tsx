// Цветные иконки погоды по кодам WMO Open-Meteo.
// https://open-meteo.com/en/docs#weather_variable_documentation

interface Props { code: number; isDay: boolean }

const SUN = '#F2B22D';
const MOON = '#E0E5EA';
const STAR = '#FFD27A';
const CLOUD_LIGHT = '#CCD3DC';
const CLOUD_DARK = '#7A8499';
const CLOUD_STORM = '#4D5560';
const RAIN = '#5B9DD8';
const SNOW = '#E8F1FB';
const BOLT = '#F4C24A';

export default function WeatherIcon({ code, isDay }: Props) {
  // 0 — ясно
  if (code === 0) {
    return isDay ? <Sun /> : <Moon />;
  }
  // 1, 2 — преимущественно ясно / переменная облачность
  if (code === 1 || code === 2) {
    return isDay ? <PartlyCloudyDay /> : <PartlyCloudyNight />;
  }
  // 3 — пасмурно
  if (code === 3) return <Cloud />;
  // 45, 48 — туман
  if (code === 45 || code === 48) return <Fog />;
  // 51-57 — морось
  if (code >= 51 && code <= 57) return <Drizzle />;
  // 61-67 — дождь
  if (code >= 61 && code <= 67) return code >= 65 ? <HeavyRain /> : <Rain />;
  // 71-77 — снег
  if (code >= 71 && code <= 77) return <Snowfall />;
  // 80-82 — ливень
  if (code >= 80 && code <= 82) return code === 82 ? <HeavyRain /> : <Rain />;
  // 85-86 — снежные ливни
  if (code === 85 || code === 86) return <Snowfall />;
  // 95-99 — гроза
  if (code >= 95) return <Thunder />;
  return <Cloud />;
}

const wrap = { width: 18, height: 18, viewBox: '0 0 24 24' } as const;

function Sun() {
  return (
    <svg {...wrap}>
      <g stroke={SUN} strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
      </g>
      <circle cx="12" cy="12" r="4.3" fill={SUN} />
    </svg>
  );
}

function Moon() {
  return (
    <svg {...wrap}>
      <circle cx="19" cy="6" r=".9" fill={STAR} />
      <circle cx="16" cy="14" r=".7" fill={STAR} />
      <path d="M21 14.5A8.5 8.5 0 1 1 10 3.5 7 7 0 0 0 21 14.5z" fill={MOON} />
    </svg>
  );
}

function PartlyCloudyDay() {
  return (
    <svg {...wrap}>
      <g stroke={SUN} strokeWidth="1.2" strokeLinecap="round">
        <path d="M8 2.5V4M2.5 8H4M4.4 4.4l1.1 1.1M11 8l1.1-1.1" />
      </g>
      <circle cx="8" cy="8" r="3.2" fill={SUN} />
      <path d="M8 18 a4 4 0 0 1 0-8 a5 5 0 0 1 9.2 1.4 A3.4 3.4 0 0 1 19 18 Z" fill={CLOUD_LIGHT} stroke={CLOUD_DARK} strokeWidth=".7" />
    </svg>
  );
}

function PartlyCloudyNight() {
  return (
    <svg {...wrap}>
      <path d="M11 8.5A4 4 0 1 1 7 3.4 3.4 3.4 0 0 0 11 8.5z" fill={MOON} />
      <path d="M8 18 a4 4 0 0 1 0-8 a5 5 0 0 1 9.2 1.4 A3.4 3.4 0 0 1 19 18 Z" fill={CLOUD_LIGHT} stroke={CLOUD_DARK} strokeWidth=".7" />
    </svg>
  );
}

function Cloud() {
  return (
    <svg {...wrap}>
      <path d="M6 18 a4 4 0 0 1 0-8 a5 5 0 0 1 9.2 1.4 A3.4 3.4 0 0 1 17 18 Z" fill={CLOUD_LIGHT} stroke={CLOUD_DARK} strokeWidth=".7" />
    </svg>
  );
}

function Fog() {
  return (
    <svg {...wrap}>
      <path d="M6 14 a4 4 0 0 1 0-8 a5 5 0 0 1 9.2 1.4 A3.4 3.4 0 0 1 17 14 Z" fill={CLOUD_LIGHT} stroke={CLOUD_DARK} strokeWidth=".7" />
      <g stroke={CLOUD_DARK} strokeWidth="1.4" strokeLinecap="round">
        <path d="M3 18h12M5 21h14" />
      </g>
    </svg>
  );
}

function Drizzle() {
  return (
    <svg {...wrap}>
      <path d="M6 14 a4 4 0 0 1 0-8 a5 5 0 0 1 9.2 1.4 A3.4 3.4 0 0 1 17 14 Z" fill={CLOUD_LIGHT} stroke={CLOUD_DARK} strokeWidth=".7" />
      <g stroke={RAIN} strokeWidth="1.4" strokeLinecap="round">
        <path d="M8 17v2M12 17v2M16 17v2" />
      </g>
    </svg>
  );
}

function Rain() {
  return (
    <svg {...wrap}>
      <path d="M6 14 a4 4 0 0 1 0-8 a5 5 0 0 1 9.2 1.4 A3.4 3.4 0 0 1 17 14 Z" fill={CLOUD_DARK} stroke={CLOUD_STORM} strokeWidth=".7" />
      <g stroke={RAIN} strokeWidth="1.6" strokeLinecap="round">
        <path d="M8 16.5l-1.5 4M12 16.5l-1.5 4M16 16.5l-1.5 4" />
      </g>
    </svg>
  );
}

function HeavyRain() {
  return (
    <svg {...wrap}>
      <path d="M6 13 a4 4 0 0 1 0-8 a5 5 0 0 1 9.2 1.4 A3.4 3.4 0 0 1 17 13 Z" fill={CLOUD_STORM} stroke={CLOUD_STORM} strokeWidth=".7" />
      <g stroke={RAIN} strokeWidth="1.8" strokeLinecap="round">
        <path d="M7 15l-1.8 5M11 15l-1.8 5M15 15l-1.8 5M19 15l-1.8 5" />
      </g>
    </svg>
  );
}

function Snowfall() {
  return (
    <svg {...wrap}>
      <path d="M6 14 a4 4 0 0 1 0-8 a5 5 0 0 1 9.2 1.4 A3.4 3.4 0 0 1 17 14 Z" fill={CLOUD_LIGHT} stroke={CLOUD_DARK} strokeWidth=".7" />
      <g stroke={SNOW} strokeWidth="1.2" strokeLinecap="round">
        <path d="M7.5 17.5l1 1M8 16.5v2.5M9 17.5l-1 1" />
        <path d="M11.5 19l1 1M12 18v2.5M13 19l-1 1" />
        <path d="M15.5 17.5l1 1M16 16.5v2.5M17 17.5l-1 1" />
      </g>
    </svg>
  );
}

function Thunder() {
  return (
    <svg {...wrap}>
      <path d="M5 13 a4 4 0 0 1 0-8 a5 5 0 0 1 9.2 1.4 A3.4 3.4 0 0 1 16 13 Z" fill={CLOUD_STORM} stroke={CLOUD_STORM} strokeWidth=".7" />
      <path d="M11 13 L8 18 L11 18 L9.5 22 L14 16 L11 16 Z" fill={BOLT} stroke={SUN} strokeWidth=".5" strokeLinejoin="round" />
    </svg>
  );
}
