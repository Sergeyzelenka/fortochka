const SKY = { bgTop: "#2a5120", bgBot: "#163a10" };
const BLADE_COLS = ["#2f6b22", "#3f8a2b", "#57a838", "#6cc24a", "#8fd65e"];
function rand(a, b) {
  return a + Math.random() * (b - a);
}
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function shade(hex, amt) {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = clamp(parseInt(m.slice(0, 2), 16) + amt, 0, 255);
  const g = clamp(parseInt(m.slice(2, 4), 16) + amt, 0, 255);
  const b = clamp(parseInt(m.slice(4, 6), 16) + amt, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export function startRelax(canvas, opts) {
  const ctx = canvas.getContext("2d", { alpha: false });
  let W = 0, H = 0, dpr = 1;
  let reducedMotion = !!(opts == null ? void 0 : opts.reducedMotion);
  let raf = 0, running = true, t = 0, wind = 0.6;
  let snd = {};
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  let quality = reducedMotion || mobile || cores <= 4 || mem <= 3 ? "low" : cores <= 8 ? "mid" : "high";
  const QCFG = {
    low: { grassDiv: 300, frontFrac: 0.35, targetFps: 30, flyers: 3, crawlers: 4, flowers: 10, shadows: false },
    mid: { grassDiv: 200, frontFrac: 0.55, targetFps: 48, flyers: 5, crawlers: 6, flowers: 16, shadows: true },
    high: { grassDiv: 140, frontFrac: 1, targetFps: 60, flyers: 7, crawlers: 9, flowers: 24, shadows: true }
  };
  let autoQuality = true;
  let cfg = QCFG[quality];
  const pointer = { x: -9999, y: -9999, active: false, speed: 0, down: 0 };
  let bg = null;
  let bgCtx = null;
  let frontBlades = [];
  let flowers = [];
  let flyers = [];
  let crawlers = [];
  let birds = [];
  let cats = [];
  let catSpawnCd = 90;
  let sceneInited = false;
  let catVoiceSeq = Math.random() * 8 | 0;
  let birdCooldown = 240 + Math.random() * 240;
  const COATS = [
    { base: "#5b5b5b", belly: "#9a9a9a", stripe: "#3c3c3c", eye: "#a7d96a", striped: true },
    { base: "#d98a3d", belly: "#f0c089", stripe: "#b86a22", eye: "#7ad15a", striped: true },
    { base: "#2c2c2c", belly: "#454545", stripe: "#000000", eye: "#f2c84b", striped: false },
    { base: "#e8e2d6", belly: "#ffffff", stripe: "#c9bfa8", eye: "#6db7e8", striped: false },
    { base: "#6e573e", belly: "#a98a63", stripe: "#4a3826", eye: "#a7d96a", striped: true }
  ];

  const SPRITE_BASE = "/sprites/cats/";
  const spriteSets = {};
  let spritesReady = false;
  let spriteCatCount = 0;
  function loadImg(name) {
    const bank = globalThis.__RELAX_SPRITES__;
    const key = name.replace('/sprites/cats/', '').replace('.png', '');
    const src = bank && bank[key] ? bank[key] : name;
    return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  async function loadSprites() {
    // Все 56 спрайтов грузим ОДНОЙ волной через Promise.all вместо последовательных await.
    // На сети с типичной задержкой 30-50ms сериальная загрузка занимала ~1.5-2с,
    // параллельная — ~150-200мс (зависит от лимита одновременных соединений).
    type Job = { prefix: string; key: string; idx: number; src: string; required?: boolean };
    const jobs: Job[] = [];
    for (let ci = 1; ci <= 4; ci++) {
      const prefix = "cat" + ci;
      for (let f = 0; f < 8; f++) jobs.push({ prefix, key: "walk", idx: f, src: SPRITE_BASE + prefix + "_walk_" + f + ".png", required: f === 0 });
      jobs.push({ prefix, key: "sit", idx: 0, src: SPRITE_BASE + prefix + "_sit_0.png" });
      for (let f = 0; f < 4; f++) jobs.push({ prefix, key: "wash", idx: f, src: SPRITE_BASE + prefix + "_wash_" + f + ".png" });
      jobs.push({ prefix, key: "sleep", idx: 0, src: SPRITE_BASE + prefix + "_sleep_0.png" });
      jobs.push({ prefix, key: "roll", idx: 0, src: SPRITE_BASE + prefix + "_roll_0.png" });
    }
    const results = await Promise.all(jobs.map(j => loadImg(j.src)));

    // Собираем наборы фреймов из результатов, в порядке загрузки.
    // Кадры walk должны идти подряд — если 3-й кадр загрузился, а 2-й нет, останавливаемся.
    const groups: Record<string, Record<string, (HTMLImageElement | null)[]>> = {};
    jobs.forEach((j, i) => {
      const cat = groups[j.prefix] ??= {};
      const arr = cat[j.key] ??= [];
      arr[j.idx] = results[i];
    });
    for (let ci = 1; ci <= 4; ci++) {
      const prefix = "cat" + ci;
      const cat = groups[prefix];
      if (!cat) continue;
      const walk = (cat.walk ?? []).filter((im, idx, arr) => im && arr.slice(0, idx + 1).every(Boolean)) as HTMLImageElement[];
      if (!walk.length) continue; // без walk кота вообще не показываем
      spriteSets[prefix + "_walk"] = walk;
      if (cat.sit?.[0]) spriteSets[prefix + "_sit"] = [cat.sit[0]!];
      const wash = (cat.wash ?? []).filter((im, idx, arr) => im && arr.slice(0, idx + 1).every(Boolean)) as HTMLImageElement[];
      if (wash.length) spriteSets[prefix + "_wash"] = wash;
      if (cat.sleep?.[0]) spriteSets[prefix + "_sleep"] = [cat.sleep[0]!];
      if (cat.roll?.[0]) spriteSets[prefix + "_roll"] = [cat.roll[0]!];
      spriteCatCount = ci;
    }
    spritesReady = spriteCatCount > 0;
  }
  loadSprites();
  function spriteFor(c) {
    if (!spritesReady) return null;
    const prefix = "cat" + (1 + (c.voice.id % Math.max(1, spriteCatCount)));
    let frames, fi = 0;
    if (c.state === "sleep") frames = spriteSets[prefix + "_sleep"];
    else if (c.state === "rollover") frames = spriteSets[prefix + "_roll"];
    else if (c.state === "wash" || c.state === "groom") { frames = spriteSets[prefix + "_wash"]; if (frames) fi = (c.anim | 0) % frames.length; }
    else if (c.state === "sit") frames = spriteSets[prefix + "_sit"];
    else { frames = spriteSets[prefix + "_walk"]; if (frames) fi = (c.run * 1.2 | 0) % frames.length; }
    if (!frames || !frames.length) frames = spriteSets[prefix + "_walk"];
    if (!frames || !frames.length) return null;
    return { img: frames[fi % frames.length], flip: c.dir < 0 };
  }

  // Виньетка — переиспользуемый градиент, пересоздаётся только при resize.
  let vignetteGrad: CanvasGradient | null = null;
  function rebuildVignette() {
    if (!ctx || !W || !H) { vignetteGrad = null; return; }
    const r = Math.max(W, H) * 0.78;
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.55, r * 0.35, W * 0.5, H * 0.55, r);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.7, "rgba(0,0,0,.08)");
    grad.addColorStop(1, "rgba(0,0,0,.30)");
    vignetteGrad = grad;
  }
  function drawVignette() {
    if (!vignetteGrad) return;
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, H);
  }
  const GRASS_TONES = ["#2f6b22", "#3f8a2b", "#4e9a30", "#57a838", "#6cc24a", "#7fb83e", "#8fd65e", "#3d7a3a"];
  function pickBladeKind() {
    const r = Math.random();
    return r < 0.45 ? "thin" : r < 0.72 ? "wide" : r < 0.88 ? "reed" : "curl";
  }
  function paintBlade(g, x, baseY, h, w, color, kind, tipX) {
    const tx = x + tipX, ty = baseY - h, mx = (x + tx) / 2, my = baseY - h * 0.55;
    g.strokeStyle = color;
    g.lineCap = "round";
    if (kind === "wide") {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x - w * 0.5, baseY);
      g.quadraticCurveTo(mx - w * 0.4, my, tx, ty);
      g.quadraticCurveTo(mx + w * 0.4, my, x + w * 0.5, baseY);
      g.closePath();
      g.fill();
    } else if (kind === "reed") {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, baseY);
      g.lineTo(tx * 0.4 + x * 0.6, my);
      g.lineTo(tx, ty);
      g.stroke();
      g.fillStyle = "#caa84a";
      g.beginPath();
      g.ellipse(tx, ty, w * 0.9, h * 0.08, 0, 0, Math.PI * 2);
      g.fill();
    } else if (kind === "curl") {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, baseY);
      g.quadraticCurveTo(mx, my, tx, ty);
      g.quadraticCurveTo(tx + w * 2, ty - h * 0.1, tx + w, ty + h * 0.08);
      g.stroke();
    } else {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, baseY);
      g.quadraticCurveTo(mx, my, tx, ty);
      g.stroke();
    }
  }
  function buildStatic() {
    bg = document.createElement("canvas");
    bg.width = Math.round(W * dpr);
    bg.height = Math.round(H * dpr);
    bgCtx = bg.getContext("2d", { alpha: false });
    const g = bgCtx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, SKY.bgTop);
    grad.addColorStop(1, SKY.bgBot);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W * 0.7, -H * 0.1, 0, W * 0.7, -H * 0.1, H * 0.9);
    rg.addColorStop(0, "rgba(180,230,120,.16)");
    rg.addColorStop(1, "rgba(180,230,120,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
    // ── V2: атмосферная перспектива ────────────────────────────────────
    // Тонкая голубовато-молочная полоса вдоль горизонта дальняя травa
    // прочитывается как «далёкая», даёт ощущение глубины кадра.
    const haze = g.createLinearGradient(0, H * 0.18, 0, H * 0.55);
    haze.addColorStop(0, "rgba(180,205,210,0)");
    haze.addColorStop(0.4, "rgba(180,205,210,.10)");
    haze.addColorStop(1, "rgba(180,205,210,0)");
    g.fillStyle = haze;
    g.fillRect(0, 0, W, H);
    const n = Math.round(W * H / cfg.grassDiv);
    const sb = [];
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const baseY = (0.02 + Math.random() * 1.04) * H;
      const depth = clamp(baseY / H, 0, 1);
      const kind = pickBladeKind();
      const h = rand(16, 40) * (0.65 + depth * 0.7) * (kind === "reed" ? 1.25 : 1);
      const w = (kind === "wide" ? rand(4, 7) : kind === "reed" ? rand(1.4, 2.2) : rand(1.4, 3)) * (0.7 + depth * 0.6);
      sb.push({ x, baseY, h, w, lean: rand(-0.28, 0.28), color: GRASS_TONES[Math.random() * GRASS_TONES.length | 0], kind });
    }
    sb.sort((a, b) => a.baseY - b.baseY);
    for (const b of sb) paintBlade(g, b.x, b.baseY, b.h, b.w, b.color, b.kind, b.lean * 24);
    flowers = [];
    const cloverCols = ["#E89BC8", "#F2A6D0", "#D98AC0"];
    for (let i = 0; i < cfg.flowers; i++) {
      const y = rand(H * 0.34, H - 14), r = rand(5, 9) * (0.7 + y / H * 0.6);
      const roll = Math.random();
      const kind = roll < 0.34 ? "clover" : roll < 0.55 ? "daisy" : roll < 0.72 ? "dandelion" : roll < 0.88 ? "bluebell" : "poppy";
      const color = kind === "clover" ? cloverCols[Math.random() * cloverCols.length | 0] : "#fff";
      const f = { x: rand(20, W - 20), y, r, kind, color };
      flowers.push(f);
      drawFlower(g, f);
    }
  }
  function drawFlower(g, f) {
    g.strokeStyle = "#3f8a2b";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(f.x, f.y + f.r * 1.8);
    g.lineTo(f.x, f.y);
    g.stroke();
    if (f.kind === "clover") {
      g.fillStyle = f.color;
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + f.x;
        g.beginPath();
        g.arc(f.x + Math.cos(a) * f.r * 0.5, f.y + Math.sin(a) * f.r * 0.5, f.r * 0.42, 0, Math.PI * 2);
        g.fill();
      }
    } else if (f.kind === "daisy") {
      g.fillStyle = "#fff";
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        g.beginPath();
        g.ellipse(f.x + Math.cos(a) * f.r * 0.8, f.y + Math.sin(a) * f.r * 0.8, f.r * 0.5, f.r * 0.22, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#F2C23E";
      g.beginPath();
      g.arc(f.x, f.y, f.r * 0.42, 0, Math.PI * 2);
      g.fill();
    } else if (f.kind === "dandelion") {
      g.fillStyle = "#F4C42E";
      g.beginPath();
      g.arc(f.x, f.y, f.r * 0.85, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#E0A91E";
      g.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        g.beginPath();
        g.moveTo(f.x, f.y);
        g.lineTo(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r);
        g.stroke();
      }
    } else if (f.kind === "bluebell") {
      g.fillStyle = "#7B8FE0";
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.ellipse(f.x + i * f.r * 0.5, f.y + Math.abs(i) * f.r * 0.3, f.r * 0.32, f.r * 0.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.fillStyle = "#E0443A";
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2;
        g.beginPath();
        g.ellipse(f.x + Math.cos(a) * f.r * 0.4, f.y + Math.sin(a) * f.r * 0.4, f.r * 0.6, f.r * 0.5, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#2a1a1a";
      g.beginPath();
      g.arc(f.x, f.y, f.r * 0.25, 0, Math.PI * 2);
      g.fill();
    }
  }
  function buildDynamic() {
    frontBlades = [];
    const nf = Math.round(W * H / cfg.grassDiv * cfg.frontFrac);
    for (let i = 0; i < nf; i++) {
      const x = Math.random() * W;
      const baseY = (0.06 + Math.random() * 1) * H;
      const depth = clamp(baseY / H, 0, 1);
      const kind = pickBladeKind();
      const h = rand(16, 38) * (0.65 + depth * 0.7) * (kind === "reed" ? 1.25 : 1);
      const w = (kind === "wide" ? rand(4, 7) : kind === "reed" ? rand(1.4, 2.2) : rand(1.6, 3.2)) * (0.7 + depth * 0.6);
      frontBlades.push({ x, baseY, h, w, phase: Math.random() * Math.PI * 2, lean: rand(-0.2, 0.2), color: GRASS_TONES[Math.random() * GRASS_TONES.length | 0], bend: 0, kind });
    }
    frontBlades.sort((a, b) => a.baseY - b.baseY);
    flyers = [];
    for (let i = 0; i < cfg.flyers; i++) flyers.push(spawnFlyer());
    crawlers = [];
    for (let i = 0; i < cfg.crawlers; i++) crawlers.push(spawnCrawler());
    if (!sceneInited) {
      birds = [];
      cats = [];
      catSpawnCd = 70;
      sceneInited = true;
    }
  }
  function spawnFlyer() {
    const kind = Math.random() < 0.6 ? "butterfly" : "bee";
    const palette = ["#E86A92", "#F2B22D", "#6AA9E8", "#E8A0C8", "#F58F4C", "#fff"];
    const c = flowers.length ? flowers[Math.random() * flowers.length | 0] : null;
    return { kind, x: rand(0, W), y: rand(H * 0.1, H * 0.8), tx: c ? c.x : rand(0, W), ty: c ? c.y - 6 : rand(H * 0.2, H * 0.7), wing: Math.random() * Math.PI * 2, hue: kind === "bee" ? "#F2B22D" : palette[Math.random() * palette.length | 0], size: kind === "bee" ? rand(6, 9) : rand(10, 16), rest: 0 };
  }
  function spawnCrawler() {
    return { x: rand(0, W), y: rand(H * 0.3, H - 12), dir: Math.random() > 0.5 ? 1 : -1, speed: rand(0.15, 0.5), kind: Math.random() > 0.5 ? "ladybug" : "beetle", legPhase: Math.random() * Math.PI * 2, size: rand(5, 8), alive: true };
  }
  function resize() {
    dpr = clamp(window.devicePixelRatio || 1, 1, quality === "low" ? 1.5 : 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sceneInited = false;
    buildStatic();
    buildDynamic();
    rebuildVignette();
  }
  function drawFrontGrass() {
    const sway = reducedMotion ? 0.2 : 1;
    for (const b of frontBlades) {
      const baseTip = Math.sin(t * 0.025 + b.phase) * wind * 7 * sway + b.lean * 22;
      let push = 0;
      if (pointer.active) {
        const dx = b.x - pointer.x, dy = b.baseY - pointer.y, d2 = dx * dx + dy * dy, r = 80;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 1, f = 1 - d / r;
          push += dx / d * f * 30 + f * pointer.speed * 18 * Math.sign(dx || 1);
        }
      }
      for (const c of cats) {
        const r = c.size * 0.9, dx = b.x - c.x, dy = b.baseY - (c.y + c.size * 0.4);
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 1, f = 1 - d / r;
          const sp = Math.hypot(c.vx, c.vy);
          push += dx / d * f * (16 + sp * 4);
        }
      }
      b.bend += (push - b.bend) * 0.25;
      paintBlade(ctx, b.x, b.baseY, b.h, b.w, b.color, b.kind, baseTip + b.bend);
    }
  }
  function updateFlyers() {
    const speed = reducedMotion ? 0.4 : 1;
    for (const f of flyers) {
      f.wing += f.kind === "bee" ? 0.9 : 0.4;
      if (f.rest > 0) {
        f.rest -= 1;
        continue;
      }
      const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
      if (d < 6) {
        f.rest = rand(40, 120);
        const c = flowers.length ? flowers[Math.random() * flowers.length | 0] : null;
        if (c) {
          f.tx = c.x + rand(-8, 8);
          f.ty = c.y - 6;
        } else {
          f.tx = rand(0, W);
          f.ty = rand(H * 0.2, H * 0.8);
        }
      } else {
        f.x += dx / d * 1.6 * speed + Math.cos(f.wing * 0.5) * 0.6;
        f.y += dy / d * 1.6 * speed + Math.sin(f.wing * 0.7) * 0.5;
      }
      if (pointer.active) {
        const px = f.x - pointer.x, py = f.y - pointer.y, pd = Math.hypot(px, py);
        if (pd < 80 && pd > 0.1) {
          f.x += px / pd * 3;
          f.y += py / pd * 3;
        }
      }
    }
  }
  function drawFlyers() {
    for (const f of flyers) {
      ctx.save();
      ctx.translate(f.x, f.y);
      const flap = Math.sin(f.wing);
      if (f.kind === "butterfly") {
        const w = f.size * (0.5 + Math.abs(flap) * 0.7);
        for (const s of [-1, 1]) {
          const grd = ctx.createLinearGradient(0, -f.size, 0, f.size);
          grd.addColorStop(0, f.hue);
          grd.addColorStop(1, shade(f.hue.length === 7 ? f.hue : "#E86A92", -20));
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.ellipse(s * w * 0.5, -2, w * 0.5, f.size * 0.7, s * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(s * w * 0.4, f.size * 0.5, w * 0.4, f.size * 0.5, s * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.5)";
          ctx.beginPath();
          ctx.arc(s * w * 0.55, -2, f.size * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#2A2A2A";
        ctx.fillRect(-1, -f.size * 0.6, 2, f.size * 1.2);
      } else {
        const grd = ctx.createLinearGradient(0, -f.size, 0, f.size);
        grd.addColorStop(0, "#F7C544");
        grd.addColorStop(1, "#E09A1E");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size, f.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2A2A2A";
        for (let i = -1; i <= 1; i++) ctx.fillRect(i * f.size * 0.5 - 1, -f.size * 0.7, 2.5, f.size * 1.4);
        ctx.fillStyle = "rgba(255,255,255,.65)";
        const ww = f.size * (0.8 + Math.abs(flap) * 0.4);
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(s * f.size * 0.3, -f.size * 0.6, ww * 0.5, f.size * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
  function updateCrawlers() {
    const speed = reducedMotion ? 0.4 : 1;
    for (const c of crawlers) {
      if (!c.alive) continue;
      c.x += c.dir * c.speed * speed;
      c.legPhase += 0.3;
      if (pointer.active) {
        const dx = c.x - pointer.x, dy = c.y - pointer.y, d = Math.hypot(dx, dy);
        if (d < 64 && d > 0.1) {
          c.x += dx / d * 3;
          c.dir = dx > 0 ? 1 : -1;
        }
      }
      if (c.x < -20) c.x = W + 20;
      if (c.x > W + 20) c.x = -20;
    }
    if (crawlers.filter((c) => c.alive).length < 3 && Math.random() < 0.01) {
      const dead = crawlers.find((c) => !c.alive);
      if (dead) Object.assign(dead, spawnCrawler());
    }
  }
  function drawCrawlers() {
    for (const c of crawlers) {
      if (!c.alive) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (cfg.shadows) {
        ctx.fillStyle = "rgba(0,0,0,.15)";
        ctx.beginPath();
        ctx.ellipse(0, c.size * 0.7, c.size * 1.1, c.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#1A1A1A";
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        const lp = Math.sin(c.legPhase + i) * 2;
        ctx.beginPath();
        ctx.moveTo(i * c.size * 0.4, 0);
        ctx.lineTo(i * c.size * 0.4 + lp, c.size * 0.7);
        ctx.stroke();
      }
      if (c.kind === "ladybug") {
        const grd = ctx.createRadialGradient(-c.size * 0.3, -c.size * 0.3, 0, 0, 0, c.size);
        grd.addColorStop(0, "#F0594B");
        grd.addColorStop(1, "#C0271B");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(0, 0, c.size, c.size * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -c.size * 0.85);
        ctx.lineTo(0, c.size * 0.85);
        ctx.stroke();
        ctx.fillStyle = "#1A1A1A";
        for (const p of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.35], [0.4, 0.35]]) {
          ctx.beginPath();
          ctx.arc(p[0] * c.size, p[1] * c.size, c.size * 0.13, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, -c.size, c.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const grd = ctx.createRadialGradient(-c.size * 0.3, -c.size * 0.3, 0, 0, 0, c.size);
        grd.addColorStop(0, "#3a4d24");
        grd.addColorStop(1, "#1c2712");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(0, 0, c.size, c.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function spawnBird() {
    const fromLeft = Math.random() > 0.5;
    const prey = crawlers.find((c) => c.alive) || null;
    const groundY = prey ? prey.y : rand(H * 0.55, H - 30);
    birds.push({ x: fromLeft ? -40 : W + 40, y: rand(H * 0.08, H * 0.22), groundY, vx: (fromLeft ? 1 : -1) * rand(4, 5.5), vy: 0, wing: 0, state: "incoming", target: prey, size: rand(13, 18), color: ["#3A4654", "#5A4632", "#2C3A2A"][Math.random() * 3 | 0], carry: 0, stateT: 0, dir: fromLeft ? 1 : -1, bank: 0 });
  }
  function updateBirds(dt) {
    var _a, _b;
    const speed = reducedMotion ? 0.5 : 1;
    if (!birds.length) {
      birdCooldown -= dt;
      if (birdCooldown <= 0) {
        spawnBird();
        birdCooldown = 420 + Math.random() * 600;
      }
    }
    for (const b of birds) {
      b.stateT += dt;
      const fast = b.state === "incoming" || b.state === "takeoff" || b.state === "leave" || b.state === "pounce";
      b.wing += fast ? 0.85 : 0.4;
      if (b.state === "incoming") {
        const tx = b.target && b.target.alive ? b.target.x : W / 2, lx = tx - b.dir * 60;
        const ovx = b.vx;
        b.x += (lx - b.x) * 0.06 * speed;
        b.y += (b.groundY - b.y) * 0.07 * speed;
        b.bank = clamp((b.x - (b.x - ovx)) * 0.04, -0.4, 0.4);
        if (Math.abs(b.x - lx) < 18 && Math.abs(b.y - b.groundY) < 12) {
          b.state = "land";
          b.stateT = 0;
          (_a = snd.wings) == null ? void 0 : _a.call(snd);
        }
      } else if (b.state === "land") {
        b.bank *= 0.8;
        if (b.stateT > 14) {
          b.state = "watch";
          b.stateT = 0;
        }
      } else if (b.state === "watch") {
        if (!b.target || !b.target.alive) {
          b.state = "takeoff";
          b.stateT = 0;
        } else if (b.stateT > 36) {
          b.state = "pounce";
          b.stateT = 0;
        }
      } else if (b.state === "pounce") {
        const tg = b.target;
        if (!tg || !tg.alive) {
          b.state = "takeoff";
          b.stateT = 0;
        } else {
          const dx = tg.x - b.x, dy = tg.y - b.y, d = Math.hypot(dx, dy) || 1;
          b.x += dx / d * 8 * speed;
          b.y += dy / d * 8 * speed;
          b.dir = dx >= 0 ? 1 : -1;
          if (d < 12) {
            tg.alive = false;
            b.carry = 1;
            b.state = "takeoff";
            b.stateT = 0;
            (_b = snd.wings) == null ? void 0 : _b.call(snd);
          }
        }
      } else if (b.state === "takeoff") {
        b.y -= 4 * speed;
        b.x += b.dir * 2 * speed;
        b.bank = -0.3 * b.dir;
        if (b.y < H * 0.2) {
          b.state = "leave";
          b.stateT = 0;
        }
      } else {
        b.x += b.dir * 5 * speed;
        b.y += (H * 0.13 - b.y) * 0.03 + Math.sin(b.stateT * 0.1) * 0.6;
        b.bank = 0.15 * b.dir;
        if (b.x < -60 || b.x > W + 60) birds = birds.filter((x) => x !== b);
      }
    }
  }
  function drawBirds() {
    for (const b of birds) {
      const grounded = b.state === "land" || b.state === "watch";
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.bank);
      ctx.scale(b.dir, 1);
      if (grounded && cfg.shadows) {
        ctx.fillStyle = "rgba(0,0,0,.18)";
        ctx.beginPath();
        ctx.ellipse(0, b.size * 0.7, b.size * 0.9, b.size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const flap = Math.sin(b.wing);
      ctx.fillStyle = shade(b.color, -30);
      const fw = grounded ? -b.size * 0.1 : -flap * b.size * 1.3;
      ctx.beginPath();
      ctx.moveTo(-b.size * 0.1, -b.size * 0.05);
      ctx.quadraticCurveTo(-b.size * 0.7, fw * 0.7, -b.size * 1.3, fw * 0.4);
      ctx.quadraticCurveTo(-b.size * 0.5, b.size * 0.25, -b.size * 0.1, -b.size * 0.05);
      ctx.fill();
      const bg2 = ctx.createLinearGradient(0, -b.size, 0, b.size);
      bg2.addColorStop(0, shade(b.color, 18));
      bg2.addColorStop(1, b.color);
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.size, b.size * 0.5, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(b.color, 40);
      ctx.beginPath();
      ctx.ellipse(b.size * 0.5, b.size * 0.1, b.size * 0.4, b.size * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.size * 0.92, -b.size * 0.22, b.size * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#E8A33D";
      ctx.beginPath();
      ctx.moveTo(b.size * 1.22, -b.size * 0.22);
      ctx.lineTo(b.size * 1.62, -b.size * 0.1);
      ctx.lineTo(b.size * 1.22, -b.size * 0.02);
      ctx.fill();
      ctx.fillStyle = shade(b.color, -16);
      const nw = grounded ? -b.size * 0.1 : -flap * b.size * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -b.size * 0.05);
      ctx.quadraticCurveTo(-b.size * 0.4, nw, -b.size * 1, nw * 0.55);
      ctx.quadraticCurveTo(-b.size * 0.3, b.size * 0.3, 0, -b.size * 0.05);
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(-b.size, 0);
      ctx.lineTo(-b.size * 1.6, -b.size * 0.3);
      ctx.lineTo(-b.size * 1.5, b.size * 0.25);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(b.size * 1.02, -b.size * 0.27, b.size * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(b.size * 1.05, -b.size * 0.3, b.size * 0.03, 0, Math.PI * 2);
      ctx.fill();
      if (grounded) {
        ctx.strokeStyle = "#E8A33D";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-b.size * 0.1, b.size * 0.45);
        ctx.lineTo(-b.size * 0.1, b.size * 0.7);
        ctx.moveTo(b.size * 0.2, b.size * 0.45);
        ctx.lineTo(b.size * 0.2, b.size * 0.7);
        ctx.stroke();
      }
      if (b.carry) {
        ctx.fillStyle = "#C0271B";
        ctx.beginPath();
        ctx.arc(b.size * 1.52, -b.size * 0.05, b.size * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  const ACTS = ["wash", "groom", "sleep", "rollover", "sit", "walk"];
  function spawnCat(active) {
    const fromLeft = Math.random() > 0.5;
    const size = rand(54, 70) * (reducedMotion ? 0.9 : 1);
    const coat = COATS[Math.random() * COATS.length | 0];
    const voice = { pitch: clamp(70 / size + rand(-0.12, 0.12), 0.7, 1.5), timbre: rand(0.25, 0.8), id: catVoiceSeq++ };
    const entryY = rand(H * 0.52, H - size * 0.6);
    cats.push({
      x: fromLeft ? -size * 1.8 : W + size * 1.8,
      y: entryY,
      vx: (fromLeft ? 1 : -1) * 2.5,
      vy: 0,
      state: active ? "enter" : "walk",
      // занятые тоже входят (walk к точке вглубь)
      busy: !active,
      size,
      coat,
      dir: fromLeft ? 1 : -1,
      run: 0,
      timer: 0,
      stateT: 0,
      nextAct: rand(150, 360),
      jump: 0,
      jumpVy: 0,
      purr: 0,
      meowT: 0,
      anim: Math.random() * 6,
      walkTx: fromLeft ? rand(W * 0.2, W * 0.6) : rand(W * 0.4, W * 0.8),
      // куда зайти
      voice,
      chillT: rand(360, 720)
      // сколько пробудет, потом уйдёт
    });
  }
  function ensureCats(dt) {
    catSpawnCd -= dt;
    const active = cats.filter((c) => !c.busy).length;
    const busy = cats.filter((c) => c.busy).length;
    const total = cats.length;
    if (catSpawnCd <= 0 && total < 2) {
      if (active === 0 && Math.random() < 0.6) spawnCat(true);
      else if (busy < 2) spawnCat(false);
      catSpawnCd = 420 + Math.random() * 540;
    }
  }
  function meowMaybe(c) {
    var _a, _b, _c, _d, _e;
    if (c.meowT > 0) {
      c.meowT -= 1;
      return;
    }
    const v = { voiceId: c.voice.id, pitch: c.voice.pitch };
    if (c.state === "sleep") {
      if (Math.random() < 5e-3) {
        c.purr = 110;
        (_a = snd.purr) == null ? void 0 : _a.call(snd);
      }
      return;
    }
    if (c.state === "wash" || c.state === "groom" || c.state === "sit") {
      if (Math.random() < 4e-3) {
        c.purr = 90;
        (_b = snd.purr) == null ? void 0 : _b.call(snd);
      } else if (Math.random() < 1e-3) {
        c.meowT = 60;
        (_c = snd.mrr) == null ? void 0 : _c.call(snd);
      }
      return;
    }
    if (c.state === "play" || c.state === "enter") {
      if (Math.random() < 6e-3) {
        c.meowT = 70;
        (_d = snd.meow) == null ? void 0 : _d.call(snd, { ...v, kind: Math.random() < 0.5 ? "hunt" : "play", strength: 0.85 });
      }
      return;
    }
    if (c.state === "walk") {
      if (Math.random() < 35e-4) {
        c.meowT = 80;
        (_e = snd.meow) == null ? void 0 : _e.call(snd, { ...v, kind: "soft", strength: 0.7 });
      }
      return;
    }
  }
  function poke(px, py) {
    var _a, _b;
    (_a = snd.squeak) == null ? void 0 : _a.call(snd);
    for (const c of cats) {
      const d = Math.hypot(px - c.x, py - c.y);
      if (!c.busy) {
        c.jumpVy = -10;
        c.vx += clamp((px - c.x) * 0.06, -9, 9);
        c.dir = px >= c.x ? 1 : -1;
        if (Math.random() < 0.7) {
          c.meowT = 60;
          (_b = snd.meow) == null ? void 0 : _b.call(snd, { voiceId: c.voice.id, pitch: c.voice.pitch, kind: "touch", strength: 0.95 });
        }
      } else if (d < 280 && Math.random() < 0.5) {
        c.busy = false;
        c.state = "play";
        c.stateT = 0;
      }
    }
  }
  function updateCats(dt) {
    ensureCats(dt);
    const sp = reducedMotion ? 0.6 : 1;
    const px = pointer.active ? pointer.x : W / 2, py = pointer.active ? pointer.y : H * 0.6;
    for (let i = cats.length - 1; i >= 0; i--) {
      const c = cats[i];
      c.timer += dt;
      c.stateT += dt;
      c.anim += 0.08;
      c.run += Math.hypot(c.vx, c.vy) * 0.08 + 0.04;
      if (c.purr > 0) c.purr -= dt;
      c.jump += c.jumpVy;
      c.jumpVy += 0.6;
      if (c.jump > 0) {
        c.jump = 0;
        c.jumpVy = 0;
      }
      meowMaybe(c);
      if (!c.busy) {
        if (c.state === "enter") {
          const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy) || 1;
          c.vx += dx / d * 1.6 * sp;
          c.vy += dy / d * 1.1 * sp;
          if (d < 240) {
            c.state = "play";
            c.stateT = 0;
          }
        } else if (c.state === "play") {
          const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy) || 1;
          if (c.stateT % 36 < 1.2) {
            c.vx += dx / d * 9 * sp;
            c.vy += dy / d * 6 * sp;
          } else {
            c.vx += dx / d * 0.4 * sp;
            c.vy += dy / d * 0.3 * sp;
          }
          if (c.timer > rand(720, 1100) && c.stateT > 200) {
            c.state = "flee";
            c.stateT = 0;
          }
        } else if (c.state === "flee") {
          const goLeft = c.x < W / 2, tx = goLeft ? -c.size * 3 : W + c.size * 3;
          c.vx += Math.sign(tx - c.x) * 1.8 * sp;
          c.vy *= 0.9;
          if (c.x < -c.size * 2.5 || c.x > W + c.size * 2.5) {
            cats.splice(i, 1);
            continue;
          }
        }
        c.vx *= 0.82;
        c.vy *= 0.82;
        const max = 11 * sp, v = Math.hypot(c.vx, c.vy);
        if (v > max) {
          c.vx = c.vx / v * max;
          c.vy = c.vy / v * max;
        }
        c.x += c.vx;
        c.y += c.vy;
        c.y = clamp(c.y, H * 0.34, H - c.size * 0.4);
        if (Math.abs(c.vx) > 0.5) c.dir = c.vx > 0 ? 1 : -1;
      } else {
        c.chillT -= dt;
        const leaving = c.chillT <= 0;
        if (leaving) {
          const goLeft = c.x < W / 2, tx = goLeft ? -c.size * 2.5 : W + c.size * 2.5;
          c.state = "walk";
          c.vx += Math.sign(tx - c.x) * 0.7 * sp;
          c.dir = tx > c.x ? 1 : -1;
          c.vx *= 0.86;
          c.x += c.vx;
          if (c.x < -c.size * 2 || c.x > W + c.size * 2) {
            cats.splice(i, 1);
            continue;
          }
        } else if (c.state === "walk") {
          const dx = c.walkTx - c.x, d = Math.abs(dx);
          if (d < 8) {
            c.state = ACTS[Math.random() * 5 | 0];
            c.stateT = 0;
            c.nextAct = rand(160, 360);
          } else {
            c.vx += Math.sign(dx) * 0.5 * sp;
            c.dir = dx > 0 ? 1 : -1;
          }
          c.vx *= 0.85;
          c.x += c.vx;
          c.y = clamp(c.y, H * 0.5, H - c.size * 0.4);
        } else {
          c.vx *= 0.8;
          c.x += c.vx;
          if (c.stateT > c.nextAct) {
            const r = Math.random();
            if (r < 0.4) {
              c.state = "walk";
              c.walkTx = rand(c.size * 2, W - c.size * 2);
            } else {
              c.state = ACTS[Math.random() * 5 | 0];
            }
            c.stateT = 0;
            c.nextAct = rand(160, 420);
          }
        }
      }
    }
  }
  function catHead(c, hx, hy, hs, lookX) {
    const co = c.coat;
    ctx.fillStyle = co.base;
    ctx.beginPath();
    ctx.moveTo(hx - hs * 0.62, hy - hs * 0.35);
    ctx.quadraticCurveTo(hx - hs * 0.78, hy - hs * 1.15, hx - hs * 0.22, hy - hs * 0.72);
    ctx.quadraticCurveTo(hx - hs * 0.4, hy - hs * 0.5, hx - hs * 0.62, hy - hs * 0.35);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + hs * 0.62, hy - hs * 0.35);
    ctx.quadraticCurveTo(hx + hs * 0.78, hy - hs * 1.15, hx + hs * 0.22, hy - hs * 0.72);
    ctx.quadraticCurveTo(hx + hs * 0.4, hy - hs * 0.5, hx + hs * 0.62, hy - hs * 0.35);
    ctx.fill();
    ctx.fillStyle = "#E79BB0";
    ctx.beginPath();
    ctx.moveTo(hx - hs * 0.5, hy - hs * 0.45);
    ctx.quadraticCurveTo(hx - hs * 0.58, hy - hs * 0.9, hx - hs * 0.3, hy - hs * 0.62);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + hs * 0.5, hy - hs * 0.45);
    ctx.quadraticCurveTo(hx + hs * 0.58, hy - hs * 0.9, hx + hs * 0.3, hy - hs * 0.62);
    ctx.fill();
    const hg = ctx.createRadialGradient(hx - hs * 0.2, hy - hs * 0.2, hs * 0.1, hx, hy, hs);
    hg.addColorStop(0, shade(co.base, 22));
    hg.addColorStop(1, co.base);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hs * 0.78, hs * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = co.belly;
    ctx.beginPath();
    ctx.ellipse(hx, hy + hs * 0.22, hs * 0.5, hs * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (co.striped) {
      ctx.strokeStyle = co.stripe;
      ctx.lineWidth = hs * 0.08;
      ctx.lineCap = "round";
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(hx + k * hs * 0.18, hy - hs * 0.62);
        ctx.lineTo(hx + k * hs * 0.12, hy - hs * 0.3);
        ctx.stroke();
      }
    }
    const eo = clamp(lookX * 0.12, -hs * 0.12, hs * 0.12);
    for (const s of [-1, 1]) {
      ctx.fillStyle = co.eye;
      ctx.beginPath();
      ctx.ellipse(hx + s * hs * 0.32, hy - hs * 0.02, hs * 0.17, hs * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#16201a";
      ctx.beginPath();
      ctx.ellipse(hx + s * hs * 0.32 + eo, hy - hs * 0.02, hs * 0.05, hs * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.beginPath();
      ctx.arc(hx + s * hs * 0.32 - hs * 0.04, hy - hs * 0.1, hs * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#E0788F";
    ctx.beginPath();
    ctx.moveTo(hx - hs * 0.08, hy + hs * 0.16);
    ctx.lineTo(hx + hs * 0.08, hy + hs * 0.16);
    ctx.lineTo(hx, hy + hs * 0.27);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = 1;
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(hx + s * hs * 0.15, hy + hs * 0.18 + k * 2 - 2);
      ctx.lineTo(hx + s * hs * 0.85, hy + hs * 0.1 + k * 5 - 5);
      ctx.stroke();
    }
  }
  function bodyStripes(c, w, h) {
    if (!c.coat.striped) return;
    ctx.strokeStyle = c.coat.stripe;
    ctx.lineWidth = c.size * 0.05;
    ctx.lineCap = "round";
    for (let k = -2; k <= 2; k++) {
      const bx = k * w * 0.28;
      ctx.beginPath();
      ctx.moveTo(bx, -h * 0.7);
      ctx.quadraticCurveTo(bx + w * 0.1, 0, bx, h * 0.5);
      ctx.stroke();
    }
  }
  function drawLeg(co, hipX, hipY, len, ph, gait, front) {
    const swing = Math.sin(ph) * gait;
    const lift = Math.max(0, Math.cos(ph)) * gait;
    const kneeX = hipX + swing * len * 0.5;
    const kneeY = hipY + len * 0.5 - lift * len * 0.35;
    const footX = hipX + swing * len * (front ? 0.9 : 1);
    const footY = hipY + len - lift * len * 0.55;
    ctx.strokeStyle = co.base;
    ctx.lineWidth = len * 0.26;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.fillStyle = co.belly;
    ctx.beginPath();
    ctx.ellipse(footX, footY, len * 0.16, len * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawTail(co, x0, y0, len, baseAng, wave, w0) {
    let px = x0, py = y0, ang = baseAng;
    const seg = 6, sl = len / seg;
    ctx.strokeStyle = co.base;
    ctx.lineCap = "round";
    for (let i = 0; i < seg; i++) {
      ang += Math.sin(wave + i * 0.7) * 0.28;
      const nx = px + Math.cos(ang) * sl, ny = py + Math.sin(ang) * sl;
      ctx.lineWidth = w0 * (1 - i / seg * 0.7);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      px = nx;
      py = ny;
    }
  }
  function drawCat(c) {
    const s = c.size, d = c.dir, co = c.coat;
    const sp = spriteFor(c);
    if (sp) {
      ctx.save();
      ctx.translate(c.x, c.y + c.jump);
      if (cfg.shadows) {
        ctx.save();
        ctx.translate(0, -c.jump);
        ctx.fillStyle = "rgba(0,0,0,.2)";
        ctx.beginPath();
        ctx.ellipse(0, s * 0.5, s * 0.6 - c.jump * 0.2, s * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (sp.flip) ctx.scale(-1, 1);
      const ar = sp.img.width / sp.img.height;
      const hImg = s * 2, wImg = hImg * ar;
      ctx.drawImage(sp.img, -wImg / 2, -hImg * 0.72, wImg, hImg);
      ctx.restore();
      drawCatLabels(c);
      return;
    }
    ctx.save();
    ctx.translate(c.x, c.y + c.jump);
    if (cfg.shadows) {
      ctx.save();
      ctx.translate(0, -c.jump);
      ctx.fillStyle = "rgba(0,0,0,.2)";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.5, s * 0.6 - c.jump * 0.2, s * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.scale(d, 1);
    const bodyGrad = () => {
      const g = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.4);
      g.addColorStop(0, co.base);
      g.addColorStop(1, shade(co.belly, -6));
      return g;
    };
    if (c.state === "sleep") {
      ctx.fillStyle = bodyGrad();
      ctx.beginPath();
      ctx.ellipse(0, s * 0.1, s * 0.85, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      bodyStripes(c, s * 0.8, s * 0.4);
      const breathe = Math.sin(c.anim * 0.6) * s * 0.02;
      ctx.strokeStyle = co.base;
      ctx.lineWidth = s * 0.22;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s * 0.7, s * 0.2);
      ctx.quadraticCurveTo(s * 1, -s * 0.2 + breathe, s * 0.2, -s * 0.25);
      ctx.stroke();
      const hx = -s * 0.5, hy = -s * 0.02 + breathe, hs = s * 0.42;
      ctx.fillStyle = co.base;
      ctx.beginPath();
      ctx.ellipse(hx, hy, hs * 0.78, hs * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - hs * 0.5, hy - hs * 0.4);
      ctx.lineTo(hx - hs * 0.3, hy - hs * 0.95);
      ctx.lineTo(hx, hy - hs * 0.5);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + hs * 0.1, hy - hs * 0.5);
      ctx.lineTo(hx + hs * 0.3, hy - hs * 0.95);
      ctx.lineTo(hx + hs * 0.5, hy - hs * 0.35);
      ctx.fill();
      ctx.strokeStyle = "#222";
      ctx.lineWidth = hs * 0.06;
      ctx.beginPath();
      ctx.arc(hx - hs * 0.05, hy, hs * 0.16, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.font = `${Math.round(s * 0.3)}px sans-serif`;
      ctx.textAlign = "center";
      const zf = Math.sin(c.anim) * 0.5 + 0.5;
      ctx.globalAlpha = zf;
      ctx.fillText("z", hx, hy - s * 0.7 - zf * 8);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    if (c.state === "rollover") {
      ctx.fillStyle = co.belly;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.05, s * 0.62, s * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = co.base;
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const lx = (-0.3 + i * 0.2) * s, w = Math.sin(c.anim * 1.4 + i * 1.5) * s * 0.1;
        ctx.beginPath();
        ctx.moveTo(lx, -s * 0.1);
        ctx.lineTo(lx + w, -s * 0.5);
        ctx.stroke();
      }
      catHead(c, s * 0.55, -s * 0.05, s * 0.4, -1);
      drawTail(co, -s * 0.55, s * 0.05, s * 0.7, -2.4, c.anim * 1.2, s * 0.16);
      ctx.restore();
      return;
    }
    if (c.state === "sit" || c.state === "wash" || c.state === "groom") {
      ctx.fillStyle = bodyGrad();
      ctx.beginPath();
      ctx.ellipse(0, s * 0.1, s * 0.5, s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      bodyStripes(c, s * 0.45, s * 0.5);
      ctx.fillStyle = co.belly;
      ctx.beginPath();
      ctx.ellipse(-s * 0.16, s * 0.5, s * 0.12, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s * 0.16, s * 0.5, s * 0.12, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      drawTail(co, -s * 0.4, s * 0.45, s * 0.65, 0.2, c.anim * 0.8, s * 0.18);
      const lookX = pointer.active ? Math.sign(pointer.x - c.x) * c.dir : 0;
      const hx = 0, hy = -s * 0.5, hs = s * 0.46;
      if (c.state === "wash") {
        catHead(c, hx, hy, hs, 0);
        ctx.strokeStyle = co.belly;
        ctx.lineWidth = s * 0.13;
        ctx.lineCap = "round";
        const lp = Math.sin(c.anim * 2.2) * s * 0.08;
        ctx.beginPath();
        ctx.moveTo(s * 0.05, s * 0.1);
        ctx.lineTo(hx + s * 0.12, hy + s * 0.1 + lp);
        ctx.stroke();
        ctx.fillStyle = co.belly;
        ctx.beginPath();
        ctx.arc(hx + s * 0.12, hy + s * 0.12 + lp, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
      } else if (c.state === "groom") {
        catHead(c, hx + s * 0.05, hy + s * 0.18 + Math.sin(c.anim * 1.6) * s * 0.04, hs * 0.9, 0);
        ctx.strokeStyle = co.belly;
        ctx.lineWidth = s * 0.13;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-s * 0.05, s * 0.45);
        ctx.lineTo(hx, hy + s * 0.4);
        ctx.stroke();
      } else catHead(c, hx, hy, hs, lookX);
      ctx.restore();
      return;
    }
    const speed = Math.hypot(c.vx, c.vy);
    const gait = clamp(speed / 6, 0, 1);
    const isJump = c.jump < -2 || c.jumpVy < -2;
    const cyc = c.run;
    const stretch = 1 + Math.sin(cyc) * 0.12 * gait;
    const crouch = isJump ? 0.85 : 1;
    const bodyW = s * 0.66 * stretch, bodyH = s * 0.34 * crouch;
    const bob = -Math.abs(Math.sin(cyc)) * s * 0.06 * gait;
    drawLeg(co, -s * 0.32, s * 0.05 + bob, s * 0.5, cyc + Math.PI, gait, false);
    drawLeg(co, -s * 0.18, s * 0.05 + bob, s * 0.5, cyc + Math.PI * 0.7, gait, false);
    drawTail(co, -s * 0.6, -s * 0.05 + bob, s * 0.75, -0.5 - gait * 0.4, cyc * 1.4, s * 0.16);
    ctx.fillStyle = bodyGrad();
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.05 + bob, bodyW, bodyH, Math.sin(cyc) * 0.05 * gait, 0, Math.PI * 2);
    ctx.fill();
    bodyStripes(c, s * 0.6 * stretch, s * 0.3);
    drawLeg(co, s * 0.28, s * 0.05 + bob, s * 0.5, cyc, gait, true);
    drawLeg(co, s * 0.4, s * 0.05 + bob, s * 0.5, cyc + Math.PI * 0.3, gait, true);
    const headBob = Math.sin(cyc) * s * 0.03 * gait;
    catHead(c, s * 0.55 * stretch, -s * 0.28 + bob + headBob, s * 0.42, pointer.active ? Math.sign(pointer.x - c.x) * c.dir : 1);
    ctx.restore();
    drawCatLabels(c);
  }
  function drawCatLabels(c) {
    const s = c.size;
    if (c.purr > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(c.purr / 110, 0, 1);
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(s * 0.3)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("\u043C\u0440\u0440", c.x, c.y + c.jump - s * 0.8 - (110 - c.purr) * 0.2);
      ctx.restore();
    }
    if (c.meowT > 50) {
      ctx.save();
      ctx.globalAlpha = clamp((c.meowT - 50) / 25, 0, 1);
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(s * 0.34)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("\u043C\u044F\u0443", c.x, c.y + c.jump - s * 0.85);
      ctx.restore();
    }
  }
  function drawMouse() {
    if (!pointer.active) return;
    const x = pointer.x, y = pointer.y, s = 16, pressed = pointer.down > 0;
    ctx.save();
    ctx.translate(x, y);
    if (cfg.shadows) {
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.5, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#caa";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, s * 0.1);
    ctx.quadraticCurveTo(-s * 1.4, s * 0.1 + Math.sin(t * 0.1) * 4, -s * 1.5, -s * 0.4);
    ctx.stroke();
    const bg2 = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
    bg2.addColorStop(0, "#9c8f80");
    bg2.addColorStop(1, "#6f6356");
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.65, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a7d6f";
    ctx.beginPath();
    ctx.ellipse(s * 0.55, -s * 0.08, s * 0.34, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9c8f80";
    ctx.beginPath();
    ctx.arc(s * 0.42, -s * 0.42, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.78, -s * 0.34, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#E79BB0";
    ctx.beginPath();
    ctx.arc(s * 0.42, -s * 0.42, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.78, -s * 0.34, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(s * 0.68, -s * 0.1, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#E0788F";
    ctx.beginPath();
    ctx.arc(s * 0.9, -s * 0.02, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.7)";
    ctx.lineWidth = 1;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.85, -s * 0.02);
      ctx.lineTo(s * 1.35, -s * 0.02 + k * 5);
      ctx.stroke();
    }
    if (pressed) {
      ctx.fillStyle = "#fff";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.globalAlpha = clamp(pointer.down / 20, 0, 1);
      ctx.fillText("\u043F\u0438!", 0, -s * 1.2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  let last = performance.now();
  let acc = 0;
  let frameInterval = 1e3 / cfg.targetFps;
  let slowFrames = 0, fpsCheck = performance.now(), framesThisSec = 0, downgraded = false;
  function render(dt) {
    t += dt;
    wind = 0.5 + Math.sin(t * 5e-3) * 0.4;
    pointer.speed *= 0.86;
    if (pointer.down > 0) pointer.down -= dt;
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = SKY.bgBot;
      ctx.fillRect(0, 0, W, H);
    }
    updateCrawlers();
    updateFlyers();
    updateBirds(dt);
    updateCats(dt);
    drawCrawlers();
    cats.slice().sort((a, b) => a.y - b.y).forEach(drawCat);
    drawBirds();
    drawFrontGrass();
    drawFlyers();
    // Виньетка идёт ПОД курсором, но НАД сценой: глубина, не мешая взаимодействию.
    drawVignette();
    drawMouse();
  }
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const elapsed = now - last;
    if (elapsed < frameInterval - 1) return;
    const dt = Math.min(2.5, elapsed / 16.67);
    last = now - elapsed % frameInterval;
    render(dt);
    framesThisSec++;
    if (now - fpsCheck >= 1e3) {
      const fps = framesThisSec;
      framesThisSec = 0;
      fpsCheck = now;
      if (autoQuality && !downgraded && fps < cfg.targetFps * 0.6) {
        slowFrames++;
        if (slowFrames >= 5 && quality !== "low") {
          downgrade();
          downgraded = true;
        }
      } else slowFrames = 0;
    }
  }
  function downgrade() {
    quality = quality === "high" ? "mid" : "low";
    cfg = QCFG[quality];
    frameInterval = 1e3 / cfg.targetFps;
    slowFrames = 0;
    buildStatic();
    rebuildFrontGrass();
  }
  function rebuildFrontGrass() {
    frontBlades = [];
    const nf = Math.round(W * H / cfg.grassDiv * cfg.frontFrac);
    for (let i = 0; i < nf; i++) {
      const x = Math.random() * W;
      const baseY = (0.06 + Math.random() * 1) * H;
      const depth = clamp(baseY / H, 0, 1);
      const kind = pickBladeKind();
      const h = rand(16, 38) * (0.65 + depth * 0.7) * (kind === "reed" ? 1.25 : 1);
      const w = (kind === "wide" ? rand(4, 7) : kind === "reed" ? rand(1.4, 2.2) : rand(1.6, 3.2)) * (0.7 + depth * 0.6);
      frontBlades.push({ x, baseY, h, w, phase: Math.random() * Math.PI * 2, lean: rand(-0.2, 0.2), color: GRASS_TONES[Math.random() * GRASS_TONES.length | 0], bend: 0, kind });
    }
    frontBlades.sort((a, b) => a.baseY - b.baseY);
  }
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const nx = e.clientX - r.left, ny = e.clientY - r.top;
    if (pointer.active) {
      const dx = nx - pointer.x, dy = ny - pointer.y;
      pointer.speed = Math.max(pointer.speed, Math.min(1, Math.sqrt(dx * dx + dy * dy) / 40));
    }
    pointer.x = nx;
    pointer.y = ny;
    pointer.active = true;
  }
  function onDown(e) {
    const r = canvas.getBoundingClientRect();
    onMove(e);
    pointer.down = 22;
    poke(e.clientX - r.left, e.clientY - r.top);
  }
  function onLeave() {
    pointer.active = false;
    pointer.x = -9999;
    pointer.y = -9999;
    pointer.speed = 0;
  }
  function onVisibility() {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }
  canvas.style.cursor = "none";
  canvas.addEventListener("pointermove", onMove, { passive: true });
  canvas.addEventListener("pointerdown", onDown, { passive: true });
  canvas.addEventListener("pointerleave", onLeave, { passive: true });
  canvas.addEventListener("touchend", onLeave, { passive: true });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibility);
  resize();
  raf = requestAnimationFrame(loop);
  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      canvas.style.cursor = "";
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("touchend", onLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    },
    setReducedMotion(v) {
      reducedMotion = v;
      resize();
    },
    getPointerSpeed() {
      return pointer.active ? pointer.speed : 0;
    },
    setSound(ev) {
      snd = ev || {};
    },
    getQuality() {
      return autoQuality ? "auto (" + quality + ")" : quality;
    },
    setQuality(q) {
      if (q === "auto") {
        autoQuality = true;
        quality = reducedMotion || mobile || cores <= 4 || mem <= 3 ? "low" : cores <= 8 ? "mid" : "high";
      } else {
        autoQuality = false;
        quality = q;
      }
      cfg = QCFG[quality];
      frameInterval = 1e3 / cfg.targetFps;
      slowFrames = 0;
      downgraded = false;
      buildStatic();
      rebuildFrontGrass();
    }
  };
}
