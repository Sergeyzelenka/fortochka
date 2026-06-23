// ФОРТОЧКА · звук «Релакс-окна».
// Использует реальные сэмплы из /sounds/ (банк пользователя). Если файла нет —
// мягкий процедурный фолбэк. Раздельные шины громкости. Старт по жесту.
//
// Банк (public/sounds/):
//   мяу:   meow_hunt, meow_play, meow_extra, meow_soft1..8
//   отдых: purr (луп), mrr (короткое)
//   фон:   wind, birds, bees (лупы), rustle (шелест, управляется мышью)

export type Bus = 'master' | 'nature' | 'rustle' | 'animals' | 'insects' | 'birds';
export type MeowKind = 'hunt' | 'play' | 'soft' | 'touch';
export interface MeowVoice { voiceId?: number; pitch?: number; strength?: number; kind?: MeowKind }

export interface SoundHandle {
  stop: () => void;
  setMuted: (m: boolean) => void;
  setVolume: (bus: Bus, v: number) => void;
  setRustle: (intensity: number) => void;
  meow: (voice?: MeowVoice) => void;
  purr: () => void;
  mrr: () => void;
  squeak: () => void;
  wings: () => void;
  ready: () => boolean;
}

const SOUNDS = '/sounds/';
const SOFT_COUNT = 9;

export function startSound(): SoundHandle {
  const AC: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx = new AC();

  const vols: Record<Bus, number> = { master: 0.7, nature: 0.6, rustle: 0.7, animals: 0.8, insects: 0.4, birds: 0.5 };
  let muted = false;

  const master = ctx.createGain(); master.gain.value = vols.master; master.connect(ctx.destination);
  const nature = ctx.createGain(); nature.gain.value = vols.nature; nature.connect(master);
  const rustleBus = ctx.createGain(); rustleBus.gain.value = vols.rustle; rustleBus.connect(master);
  const animals = ctx.createGain(); animals.gain.value = vols.animals; animals.connect(master);
  const insects = ctx.createGain(); insects.gain.value = vols.insects; insects.connect(master);
  const birdsBus = ctx.createGain(); birdsBus.gain.value = vols.birds; birdsBus.connect(master);

  const buffers: Record<string, AudioBuffer> = {};
  let loaded = false;

  function b64ToBuf(dataUri: string): ArrayBuffer {
    const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
    const bin = atob(b64);
    const len = bin.length, bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  async function load(name: string): Promise<void> {
    try {
      const bank = (globalThis as any).__RELAX_SOUNDS__ as Record<string, string> | undefined;
      let ab: ArrayBuffer;
      if (bank && bank[name]) {
        // автономный режим: декодируем base64 напрямую (надёжнее fetch на больших data-URI)
        ab = b64ToBuf(bank[name]);
      } else {
        const r = await fetch(SOUNDS + name + '.mp3', { cache: 'force-cache' });
        if (!r.ok) return;
        ab = await r.arrayBuffer();
      }
      buffers[name] = await ctx.decodeAudioData(ab);
    } catch { /* нет файла/ошибка — фолбэк на синтез */ }
  }

  // одноразовый сэмпл
  function play(name: string, bus: GainNode, vol = 1, rate = 1): boolean {
    const b = buffers[name]; if (!b) return false;
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(bus); src.start();
    return true;
  }

  // Бесшовный луп: готовим буфер, у которого конец плавно перетекает в начало
  // (кроссфейд внутри буфера), затем играем нативным loop=true — без таймеров и швов.
  function makeSeamless(b: AudioBuffer, xfSec: number): AudioBuffer {
    const sr = b.sampleRate, ch = b.numberOfChannels;
    const xf = Math.min(Math.floor(xfSec * sr), Math.floor(b.length / 3));
    const outLen = b.length - xf;                 // хвост накладываем на начало
    const out = ctx.createBuffer(ch, outLen, sr);
    for (let c = 0; c < ch; c++) {
      const src = b.getChannelData(c), dst = out.getChannelData(c);
      for (let i = 0; i < outLen; i++) dst[i] = src[i];
      // вмешиваем последние xf сэмплов в первые xf с равномощным кроссфейдом
      for (let i = 0; i < xf; i++) {
        const t = i / xf;
        const fadeIn = Math.sqrt(t), fadeOut = Math.sqrt(1 - t);
        dst[i] = dst[i] * fadeIn + src[outLen + i] * fadeOut;
      }
    }
    return out;
  }
  function loopGapless(name: string, bus: GainNode, vol: number): boolean {
    const b = buffers[name]; if (!b) return false;
    const seamless = makeSeamless(b, Math.min(0.5, b.duration * 0.15));
    const g = ctx.createGain(); g.gain.value = vol; g.connect(bus);
    const src = ctx.createBufferSource(); src.buffer = seamless; src.loop = true;
    src.connect(g).start();
    loops[name] = g; return true;
  }

  // зацикленный фон
  const loops: Record<string, GainNode> = {};
  const bgSrcs: AudioBufferSourceNode[] = [];
  const xfadeTimers: ReturnType<typeof setTimeout>[] = [];
  const xfadeAlive: (() => void)[] = [];
  function loop(name: string, bus: GainNode, vol: number) {
    const b = buffers[name]; if (!b) return false;
    const seamless = makeSeamless(b, Math.min(0.5, b.duration * 0.12));
    const src = ctx.createBufferSource(); src.buffer = seamless; src.loop = true;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(bus); src.start();
    loops[name] = g; return true;
  }

  // ── фолбэк-синтез (если нет сэмплов) ──
  const noiseBuf = ctx.createBuffer(1, 2 * ctx.sampleRate, ctx.sampleRate);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  let synthWind: AudioBufferSourceNode | null = null, synthBuzz: OscillatorNode[] = [];
  let synthWindGain: GainNode | null = null, synthBuzzGain: GainNode | null = null;
  let synthBirdsOn = false; let birdTimer: ReturnType<typeof setTimeout> | null = null;
  const rustleSrc = ctx.createBufferSource(); rustleSrc.buffer = noiseBuf; rustleSrc.loop = true;
  const rustleFilter = ctx.createBiquadFilter(); rustleFilter.type = 'highpass'; rustleFilter.frequency.value = 2200;
  const rustleGain = ctx.createGain(); rustleGain.gain.value = 0;
  rustleSrc.connect(rustleFilter).connect(rustleGain).connect(rustleBus);

  function synthMeow(v: MeowVoice) {
    const pitch = v.pitch ?? 1, strength = v.strength ?? 0.8;
    const now = ctx.currentTime, dur = 0.45 + Math.random() * 0.2;
    const base = (440 + Math.random() * 120) * pitch;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6; const g = ctx.createGain();
    o.frequency.setValueAtTime(base * 0.8, now); o.frequency.linearRampToValueAtTime(base * 1.25, now + dur * 0.35); o.frequency.linearRampToValueAtTime(base * 0.7, now + dur);
    f.frequency.setValueAtTime(900, now); f.frequency.linearRampToValueAtTime(1500, now + dur * 0.4); f.frequency.linearRampToValueAtTime(700, now + dur);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.3 * strength, now + 0.05); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(f).connect(g).connect(animals); o.start(now); o.stop(now + dur + 0.05);
  }
  function synthPurr() {
    const now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 28;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; const g = ctx.createGain(); g.gain.value = 0;
    const tr = ctx.createOscillator(); tr.type = 'sine'; tr.frequency.value = 26; const tg = ctx.createGain(); tg.gain.value = 0.12; tr.connect(tg).connect(g.gain);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.2, now + 0.08); g.gain.setTargetAtTime(0, now + 0.9, 0.4);
    o.connect(lp).connect(g).connect(animals); o.start(now); tr.start(now); o.stop(now + 1.6); tr.stop(now + 1.6);
  }
  function synthSqueak() {
    const now = ctx.currentTime, dur = 0.14; const o = ctx.createOscillator(); o.type = 'triangle'; const g = ctx.createGain();
    o.frequency.setValueAtTime(2200, now); o.frequency.exponentialRampToValueAtTime(3200, now + 0.05); o.frequency.exponentialRampToValueAtTime(1900, now + dur);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.22, now + 0.01); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g).connect(animals); o.start(now); o.stop(now + dur + 0.02);
  }
  function synthWings() {
    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) { const ts = now + i * 0.08; const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; const g = ctx.createGain();
      g.gain.setValueAtTime(0, ts); g.gain.linearRampToValueAtTime(0.18, ts + 0.02); g.gain.exponentialRampToValueAtTime(0.001, ts + 0.07);
      s.connect(f).connect(g).connect(animals); s.start(ts); s.stop(ts + 0.09); }
  }

  // синтез-фон (запускаем СРАЗУ, чтобы звук был всегда; если догрузится сэмпл — заглушим синтез)
  function startSynthWind() {
    synthWind = ctx.createBufferSource(); synthWind.buffer = noiseBuf; synthWind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 450; wf.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0.4; synthWind.connect(wf).connect(wg).connect(nature); synthWind.start();
    synthWindGain = wg;
  }
  function startSynthBuzz() {
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 142;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 148;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 220; bf.Q.value = 4;
    const bg = ctx.createGain(); bg.gain.value = 0.06; o1.connect(bf); o2.connect(bf); bf.connect(bg).connect(insects);
    o1.start(); o2.start(); synthBuzz = [o1, o2]; synthBuzzGain = bg;
  }
  function startSynthBirds() {
    synthBirdsOn = true;
    const chirp = () => {
      if (!synthBirdsOn) return;
      const now = ctx.currentTime, notes = 2 + ((Math.random() * 3) | 0), baseF = 1800 + Math.random() * 1500;
      for (let n = 0; n < notes; n++) {
        const o = ctx.createOscillator(); o.type = 'sine'; const g = ctx.createGain();
        const ts = now + n * 0.09, f0 = baseF * (0.85 + Math.random() * 0.4);
        o.frequency.setValueAtTime(f0, ts); o.frequency.exponentialRampToValueAtTime(f0 * 1.5, ts + 0.05);
        g.gain.setValueAtTime(0, ts); g.gain.linearRampToValueAtTime(0.12, ts + 0.01); g.gain.exponentialRampToValueAtTime(0.001, ts + 0.08);
        o.connect(g).connect(birdsBus); o.start(ts); o.stop(ts + 0.1);
      }
      birdTimer = setTimeout(chirp, 2500 + Math.random() * 5000);
    };
    birdTimer = setTimeout(chirp, 800 + Math.random() * 1500);
  }

  // СРАЗУ запускаем синтез-фон и шелест — звук есть с первой секунды
  startSynthWind(); startSynthBuzz(); startSynthBirds();
  try { rustleSrc.start(); } catch {}

  // надёжный луп фонового сэмпла: нативный loop=true, БЕЗ makeSeamless (он рискован на длинных файлах)
  // Вечный луп с кроссфейдом на стыке: планируем повторные запуски буфера
  // с перекрытием xf секунд, фейдим вход/выход каждой копии. Шов не слышен.
  function loopXfade(name: string, bus: GainNode, vol: number): boolean {
    const b = buffers[name]; if (!b) return false;
    const g = ctx.createGain(); g.gain.value = vol; g.connect(bus);
    const dur = b.duration, xf = Math.min(2.0, dur * 0.25);
    let alive = true; xfadeAlive.push(() => { alive = false; });
    let nextAt = ctx.currentTime + 0.05;
    function fire(at: number) {
      if (!alive) return;
      const src = ctx.createBufferSource(); src.buffer = b;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, at);
      sg.gain.exponentialRampToValueAtTime(1, at + xf);
      sg.gain.setValueAtTime(1, at + dur - xf);
      sg.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(sg).connect(g); src.start(at); src.stop(at + dur + 0.1);
      bgSrcs.push(src);
      // следующая копия стартует за xf до конца текущей — перекрытие
      const next = at + dur - xf;
      const id = setTimeout(() => fire(next), Math.max(0, (next - ctx.currentTime - 0.5) * 1000));
      xfadeTimers.push(id);
    }
    fire(nextAt);
    loops[name] = g; return true;
  }
  function loopPlain(name: string, bus: GainNode, vol: number): boolean {
    const b = buffers[name]; if (!b) return false;
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(bus); src.start();
    loops[name] = g; bgSrcs.push(src); return true;
  }

  // грузим каждый фон отдельно и СРАЗУ подменяем синтез на сэмпл, как только он готов.
  // НЕ ждём общий Promise.all — один сбойный файл не блокирует остальные.
  load('wind').then(() => {
    if (buffers['wind'] && loopXfade('wind', nature, 0.95) && synthWindGain) synthWindGain.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
  });
  load('birds').then(() => {
    if (buffers['birds'] && loopPlain('birds', birdsBus, 0.6)) synthBirdsOn = false;
  });
  load('bees').then(() => {
    if (buffers['bees'] && loopPlain('bees', insects, 0.7) && synthBuzzGain) synthBuzzGain.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
  });
  // мяу/мурчание/мрр — грузим в фоне, на слышимость фона не влияют
  (async () => {
    const names = ['meow_hunt', 'meow_play', 'meow_extra', 'purr', 'mrr'];
    for (let i = 1; i <= SOFT_COUNT; i++) names.push('meow_soft' + i);
    await Promise.all(names.map(load)).catch(() => {});
    loaded = true;
  })();

  let muteSaved = vols.master;
  return {
    stop() {
      xfadeAlive.forEach(f => f()); xfadeTimers.forEach(clearTimeout);
      synthBirdsOn = false; if (birdTimer) clearTimeout(birdTimer);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => { try { ctx.close(); } catch {} }, 700);
    },
    setMuted(m) { muted = m; master.gain.setTargetAtTime(m ? 0 : vols.master, ctx.currentTime, 0.2); },
    setVolume(bus, v) {
      v = Math.max(0, Math.min(1, v)); vols[bus] = v;
      const node = { master, nature, rustle: rustleBus, animals, insects, birds: birdsBus }[bus];
      if (bus === 'master') { if (!muted) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); }
      else node.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
    },
    setRustle(intensity) {
      const v = Math.max(0, Math.min(1, intensity));
      rustleGain.gain.setTargetAtTime(v * 0.7, ctx.currentTime, 0.05);
      rustleFilter.frequency.setTargetAtTime(1800 + v * 1800, ctx.currentTime, 0.1);
    },
    meow(voice = {}) {
      const kind = voice.kind ?? 'soft';
      const pitch = voice.pitch ?? 1;
      const rate = Math.max(0.7, Math.min(1.5, pitch + (Math.random() - 0.5) * 0.08));
      const vol = voice.strength ?? 0.9;
      let name = null;
      if (kind === 'hunt') name = 'meow_hunt';
      else if (kind === 'play') name = 'meow_play';
      else if (kind === 'touch') name = ['meow_play', 'meow_extra', 'meow_soft' + (1 + (Math.random() * SOFT_COUNT | 0))][(Math.random() * 3) | 0];
      else { const id = ((voice.voiceId ?? 0) % SOFT_COUNT) + 1; name = 'meow_soft' + id; }
      if (name && play(name, animals, vol, rate)) return;
      synthMeow({ pitch, strength: vol });
    },
    purr() { if (play('purr', animals, 0.8)) return; synthPurr(); },
    mrr() { if (play('mrr', animals, 0.7)) return; synthPurr(); },
    squeak() { if (play('squeak', animals, 0.9)) return; synthSqueak(); },
    wings() { if (play('wings', animals, 0.7)) return; synthWings(); },
    ready() { return loaded; },
  };
}
