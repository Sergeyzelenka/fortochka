'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { EngineHandle } from '@/lib/relax/engine';
import type { SoundHandle, Bus } from '@/lib/relax/sound';
import Brand from '@/components/Brand';

// Полянка тяжёлая (~50 KB JS вместе с движком и звуком). Загружаем модули
// динамически только при первом открытии, чтобы не тащить их в initial bundle
// каждой страницы. Кэшируем промис, чтобы повторное открытие было мгновенным.
let _modulesPromise: Promise<{
  startRelax: typeof import('@/lib/relax/engine').startRelax;
  startSound: typeof import('@/lib/relax/sound').startSound;
}> | null = null;
function loadRelaxModules() {
  if (!_modulesPromise) {
    _modulesPromise = Promise.all([
      import('@/lib/relax/engine'),
      import('@/lib/relax/sound')
    ]).then(([eng, snd]) => ({ startRelax: eng.startRelax, startSound: snd.startSound }));
  }
  return _modulesPromise;
}

const BUSES: { key: Bus; label: string }[] = [
  { key: 'master',  label: 'Общая' },
  { key: 'nature',  label: 'Природа' },
  { key: 'birds',   label: 'Птицы' },
  { key: 'animals', label: 'Животные' },
  { key: 'insects', label: 'Насекомые' },
  { key: 'rustle',  label: 'Шелест' }
];
type Q = 'auto' | 'low' | 'mid' | 'high';
const QOPTS: { key: Q; label: string }[] = [
  { key: 'auto', label: 'Авто' }, { key: 'low', label: 'Эко' },
  { key: 'mid', label: 'Средне' }, { key: 'high', label: 'Красиво' },
];
const TIMES = [3, 5, 10, 20];

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RelaxWindow() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mixOpen, setMixOpen] = useState(false);
  const [introCollapsed, setIntroCollapsed] = useState(false);
  const [quality, setQuality] = useState<Q>('auto');
  // Дефолтные значения миксера при открытии «Полянки» (0..1 = 0..100% на ползунках).
  const [vols, setVols] = useState<Record<Bus, number>>({ master: 0.70, nature: 0.11, rustle: 0.11, animals: 0.45, insects: 0.27, birds: 0.5 });
  const [timer, setTimer] = useState(0);       // выбранные минуты (0 = выкл)
  const [left, setLeft] = useState(0);          // осталось секунд
  const [timeUp, setTimeUp] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const soundRef = useRef<SoundHandle | null>(null);

  const close = useCallback(() => { setOpen(false); setTimeUp(false); setTimer(0); setLeft(0); }, []);

  // Свёрнутость плашки помним между сессиями: пользователь уже читал, не показывать снова.
  useEffect(() => {
    if (!open) return;
    try { if (localStorage.getItem('relax-intro-hidden') === '1') setIntroCollapsed(true); } catch {}
  }, [open]);
  const collapseIntro = () => {
    setIntroCollapsed(true);
    try { localStorage.setItem('relax-intro-hidden', '1'); } catch {}
  };
  const expandIntro = () => {
    setIntroCollapsed(false);
    try { localStorage.removeItem('relax-intro-hidden'); } catch {}
  };

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    loadRelaxModules().then(({ startRelax, startSound }) => {
      if (cancelled || !canvasRef.current) return;
      const engine = startRelax(canvasRef.current, { reducedMotion: reduce });
      engineRef.current = engine;
      const sound = startSound();
      soundRef.current = sound;
      engine.setSound({ meow: v => sound.meow(v), purr: () => sound.purr(), mrr: () => sound.mrr(), squeak: () => sound.squeak(), wings: () => sound.wings() });
      (Object.keys(vols) as Bus[]).forEach(b => sound.setVolume(b, vols[b]));
      if (muted) sound.setMuted(true);
      if (quality !== 'auto') engine.setQuality(quality);
      let rustleRaf = requestAnimationFrame(function pump() {
        sound.setRustle(engine.getPointerSpeed());
        rustleRaf = requestAnimationFrame(pump);
      });
      cleanup = () => {
        cancelAnimationFrame(rustleRaf); engine.destroy(); sound.stop();
        engineRef.current = null; soundRef.current = null;
      };
    });

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      cleanup?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // обратный отсчёт
  useEffect(() => {
    if (!open || left <= 0) return;
    const id = setInterval(() => setLeft(l => {
      if (l <= 1) { setTimeUp(true); return 0; }
      return l - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [open, left]);

  useEffect(() => { soundRef.current?.setMuted(muted); }, [muted]);

  const setVol = (bus: Bus, v: number) => { setVols(p => ({ ...p, [bus]: v })); soundRef.current?.setVolume(bus, v); };
  const pickQuality = (q: Q) => { setQuality(q); engineRef.current?.setQuality(q); };
  const startTimer = (min: number) => { setTimer(min); setLeft(min * 60); setTimeUp(false); };
  const extend = () => { setTimeUp(false); setLeft(5 * 60); setTimer(5); };

  return (
    <>
      <button className="relax-trigger" title="Полянка — отдохнуть на лужайке" onClick={() => setOpen(true)}>
        <svg className="relax-trigger-icon" viewBox="0 0 32 24" aria-hidden>
          {/* Солнце с лучиками в верхнем правом углу */}
          <g className="relax-trigger-sun">
            <circle cx="27" cy="5" r="2.4" />
            <g className="relax-trigger-sunrays">
              <path d="M27 1.2 L27 2.4 M27 7.6 L27 8.8 M23.2 5 L24.4 5 M29.6 5 L30.8 5 M24.3 2.3 L25.1 3.1 M28.9 6.9 L29.7 7.7 M24.3 7.7 L25.1 6.9 M28.9 3.1 L29.7 2.3" />
            </g>
          </g>
          {/* Дальний зелёный холм */}
          <path className="relax-trigger-hill" d="M0 19 Q9 16 18 17.5 Q24 18.5 32 16.5 L32 24 L0 24 Z" />
          {/* Передний ряд травинок */}
          <g className="relax-trigger-grass">
            <path d="M2.5 19 L2 15.5" />
            <path d="M4.5 19 L4.2 14.5" />
            <path d="M6.5 19 L6.7 15" />
            <path d="M9 19 L9 14" />
            <path d="M11 19 L11.2 15" />
            <path d="M22 19 L21.7 15" />
            <path d="M24 19 L24.3 14.5" />
            <path d="M26 19 L26 15.5" />
            <path d="M28 19 L28.4 14" />
            <path d="M30 19 L29.7 15.5" />
          </g>
          {/* Цветочек слева на полянке */}
          <g className="relax-trigger-flower">
            <circle cx="14" cy="18.5" r="1" />
            <circle className="relax-trigger-flower-c" cx="14" cy="18.5" r=".3" />
          </g>
          {/* Котик в центре, сидит на полянке */}
          <g className="relax-trigger-cat">
            <ellipse cx="17.5" cy="17.2" rx="3" ry="2.5" />
            <circle cx="17.5" cy="12.4" r="2.7" />
            <path d="M15.6 10.8 L14.6 8 L16.9 9.5 Z" />
            <path d="M19.4 10.8 L20.4 8 L18.1 9.5 Z" />
            <circle className="relax-trigger-eye" cx="16.4" cy="12.4" r=".45" />
            <circle className="relax-trigger-eye" cx="18.6" cy="12.4" r=".45" />
            <path className="relax-trigger-nose" d="M17.1 13.7 L17.9 13.7 L17.5 14.2 Z" />
            <path className="relax-trigger-tail" d="M20.5 17 Q22.7 15.8 22.2 13.2" />
          </g>
        </svg>
        <span className="relax-label">Полянка</span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="relax-overlay" role="dialog" aria-label="Полянка — комната отдыха от тревог">
          <canvas ref={canvasRef} className="relax-canvas" />

          <div className="relax-topbar">
            <span className="relax-brand"><Brand size={22} tone="light" /></span>
            {!introCollapsed && (
              <div className="relax-intro">
                <button
                  className="relax-intro-close"
                  onClick={collapseIntro}
                  aria-label="Свернуть"
                  title="Свернуть"
                >×</button>
                <h2>Комната отдыха от тревог</h2>
                <p>Пространство, чтобы выдохнуть. Подвигай мышью — котики побегут, трава колыхнётся. Слушай ветер и птиц, дай глазам и голове отдохнуть несколько минут.</p>
              </div>
            )}
            <div className="relax-controls">
              {introCollapsed && (
                <button
                  className="relax-btn relax-help"
                  onClick={expandIntro}
                  title="Что это"
                  aria-label="Что это"
                >
                  <svg viewBox="0 0 24 24" className="icon">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4M12 17h.01" />
                  </svg>
                </button>
              )}
              {left > 0 && <span className="relax-timerchip">{fmt(left)}</span>}
              <button className="relax-btn" onClick={() => setMixOpen(v => !v)} title="Настройки" aria-expanded={mixOpen}>
                <svg viewBox="0 0 24 24" className="icon">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              <button className="relax-btn" onClick={close} title="Закрыть (Esc)">
                <svg viewBox="0 0 24 24" className="icon"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>
              {mixOpen && (
                <div className="relax-mixpanel">
                  <div className="relax-mixhead"><b>Звук</b><button className="relax-mini" onClick={() => setMuted(m => !m)}>{muted ? 'Включить' : 'Заглушить'}</button></div>
                  {BUSES.map(b => (
                    <div className="relax-mixrow" key={b.key}>
                      <label>{b.label}</label>
                      <input type="range" min={0} max={1} step={0.01} value={vols[b.key]} onChange={e => setVol(b.key, parseFloat(e.target.value))} aria-label={b.label} />
                      <span className="relax-mixv">{Math.round(vols[b.key] * 100)}</span>
                    </div>
                  ))}
                  <div className="relax-mixhead" style={{ marginTop: 12 }}><b>Качество</b></div>
                  <div className="relax-qrow">{QOPTS.map(q => (<button key={q.key} className={'relax-qbtn' + (quality === q.key ? ' on' : '')} onClick={() => pickQuality(q.key)}>{q.label}</button>))}</div>
                  <div className="relax-mixhead" style={{ marginTop: 12 }}><b>Таймер отдыха</b></div>
                  <div className="relax-qrow">
                    {TIMES.map(m => (<button key={m} className={'relax-qbtn' + (timer === m ? ' on' : '')} onClick={() => startTimer(m)}>{m} мин</button>))}
                  </div>
                  {left > 0 && <button className="relax-mini" style={{ marginTop: 8, width: '100%' }} onClick={() => { setLeft(0); setTimer(0); }}>Сбросить таймер</button>}
                </div>
              )}
            </div>
          </div>

          {timeUp && (
            <div className="relax-timeup">
              <div className="relax-timeup-card">
                <div className="relax-timeup-emoji">🌿</div>
                <h3>Пора работать</h3>
                <p>Перерыв на лужайке закончился. Возвращайтесь к делам — а сюда заглянете позже.</p>
                <div className="relax-timeup-btns">
                  <button className="relax-mini" onClick={extend}>Ещё 5 минут</button>
                  <button className="relax-timeup-go" onClick={close}>Иду работать</button>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
