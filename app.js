// ÂLF — living surface renderer + scroll story. Vanilla, no dependencies.
(() => {
  const doc = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const TAU = Math.PI * 2;

  /* ---------- math ---------- */

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ss = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const mix = (a, b, t) => a + (b - a) * t;

  function hash(x, y, seed) {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function valueNoise(seed) {
    const v = new Float32Array(65536);
    const r = rng(seed);
    for (let i = 0; i < v.length; i++) v[i] = r();
    return (x, y) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const x0 = xi & 255;
      const y0 = yi & 255;
      const x1 = (x0 + 1) & 255;
      const y1 = (y0 + 1) & 255;
      const u = xf * xf * (3 - 2 * xf);
      const w = yf * yf * (3 - 2 * yf);
      const a = v[(y0 << 8) | x0];
      const b = v[(y0 << 8) | x1];
      const c = v[(y1 << 8) | x0];
      const d = v[(y1 << 8) | x1];
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    };
  }

  const nA = valueNoise(11);
  const nB = valueNoise(23);
  const nC = valueNoise(37);

  function fbm(n, x, y, oct) {
    let s = 0;
    let a = 0.5;
    let t = 0;
    for (let i = 0; i < oct; i++) {
      s += a * n(x, y);
      t += a;
      a *= 0.5;
      x *= 2.03;
      y *= 2.03;
    }
    return s / t;
  }

  // Warm directional daylight from the upper left.
  const L = (() => {
    const x = -0.55, y = -0.65, z = 0.55;
    const m = Math.hypot(x, y, z);
    return [x / m, y / m, z / m];
  })();

  /* ---------- palette (sRGB 0–255) ---------- */

  const RAW = [112, 99, 84]; // dense whole-rye dough
  const RISEN = [136, 121, 102]; // aerated, lighter
  const FLOUR = [224, 216, 201];
  const FLOUR_BAKED = [214, 196, 168];
  const CRUST = [104, 64, 36];
  const CRUST_DEEP = [70, 40, 22];
  const CRACK_DOUGH = [92, 78, 63];
  const CRACK_BAKED = [52, 30, 17];
  const BOARD = [18, 16, 13]; // = page night colour, so the canvas has no visible edge
  const EMBER = [74, 32, 12];

  /* ---------- bubbles (vector, drawn on top of the surface) ---------- */

  function drawDome(ctx, x, y, r, a) {
    if (r < 0.6 || a <= 0.01) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(28, 20, 13, 0.5)";
    ctx.beginPath();
    ctx.arc(x + r * 0.14, y + r * 0.18, r * 1.04, 0, TAU);
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.05, x, y, r);
    g.addColorStop(0, "rgba(238, 226, 206, 0.95)");
    g.addColorStop(0.38, "rgba(158, 140, 118, 0.95)");
    g.addColorStop(1, "rgba(98, 84, 69, 0.95)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 250, 240, 0.8)";
    ctx.beginPath();
    ctx.arc(x - r * 0.36, y - r * 0.4, r * 0.15, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawHole(ctx, x, y, r, a) {
    if (r < 0.6 || a <= 0.01) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(24, 17, 11, 0.85)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(214, 198, 176, 0.55)";
    ctx.lineWidth = Math.max(0.8, r * 0.22);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, -0.1 * Math.PI, 0.65 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ---------- the loaf: precomputed fields, per-frame shading ---------- */

  const G = 6; // crack cells across the loaf

  function cellPoint(i, j) {
    return [i + 0.15 + 0.7 * hash(i, j, 3), j + 0.15 + 0.7 * hash(i, j, 5)];
  }

  function createFields(F, onDone) {
    const size = F * F;
    const f = {
      F,
      tex: new Float32Array(size),
      height: new Float32Array(size),
      gx: new Float32Array(size),
      gy: new Float32Array(size),
      edge: new Float32Array(size),
      cell: new Float32Array(size),
      crackVar: new Float32Array(size),
      flour: new Float32Array(size),
      wobble: new Float32Array(360),
    };
    for (let a = 0; a < 360; a++) {
      const t = (a / 360) * TAU;
      f.wobble[a] = (fbm(nB, Math.cos(t) * 1.6 + 4, Math.sin(t) * 1.6 + 4, 3) - 0.5) * 0.14;
    }
    let row = 0;
    const step = () => {
      const end = Math.min(F, row + 48);
      for (; row < end; row++) {
        const v = (row / (F - 1)) * 2 - 1;
        for (let x = 0; x < F; x++) {
          const u = (x / (F - 1)) * 2 - 1;
          const i = row * F + x;
          const wu = u + (fbm(nB, u * 2.2 + 5, v * 2.2, 3) - 0.5) * 0.42;
          const wv = v + (fbm(nB, u * 2.2, v * 2.2 + 9, 3) - 0.5) * 0.42;
          const gu = ((wu + 1) / 2) * G;
          const gv = ((wv + 1) / 2) * G;
          const ci = Math.floor(gu);
          const cj = Math.floor(gv);
          let d1 = 1e9, d2 = 1e9, id = 0;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const p = cellPoint(ci + di, cj + dj);
              const dx = p[0] - gu;
              const dy = p[1] - gv;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < d1) {
                d2 = d1;
                d1 = d;
                id = (ci + di) * 131 + (cj + dj);
              } else if (d < d2) d2 = d;
            }
          }
          f.edge[i] = d2 - d1;
          f.cell[i] = hash(id, 7, 9);
          f.tex[i] = fbm(nA, u * 7, v * 7, 4);
          f.height[i] = fbm(nC, u * 16, v * 16, 3);
          f.crackVar[i] = fbm(nB, u * 3 + 20, v * 3, 2);
          const patch = fbm(nC, u * 2.4 + 7, v * 2.4, 3);
          f.flour[i] = clamp((patch - 0.18) * 2.2, 0, 1) * (0.7 + 0.3 * hash(x, row, 1));
        }
      }
      if (row < F) {
        window.requestAnimationFrame(step);
        return;
      }
      for (let y = 1; y < F - 1; y++) {
        for (let x = 1; x < F - 1; x++) {
          const i = y * F + x;
          f.gx[i] = (f.height[i + 1] - f.height[i - 1]) * F * 0.02;
          f.gy[i] = (f.height[i + F] - f.height[i - F]) * F * 0.02;
        }
      }
      onDone(f);
    };
    step();
  }

  // Bubbles live in loaf space (u, v in -1..1).
  const loafBubbles = (() => {
    const r = rng(101);
    const list = [];
    for (let k = 0; k < 46; k++) {
      const ang = r() * TAU;
      const rad = Math.sqrt(r()) * 0.82;
      list.push({
        u: Math.cos(ang) * rad,
        v: Math.sin(ang) * rad,
        s: 0.012 + Math.pow(r(), 2) * 0.04,
        born: 0.04 + r() * 0.22,
        pop: r() < 0.4 ? 0.26 + r() * 0.14 : 2,
        phase: r() * TAU,
        speed: 0.6 + r() * 0.9,
      });
    }
    return list;
  })();

  function stage(p) {
    const grow = ss(0.22, 0.45, p);
    return {
      p,
      grow,
      wake: ss(0, 0.12, p),
      rise: ss(0.1, 0.4, p),
      dome: 0.38 + 0.52 * grow,
      flour: ss(0.38, 0.52, p),
      crack: 0.13 * ss(0.5, 0.86, p),
      bake: ss(0.64, 0.95, p),
      heat: ss(0.62, 0.74, p) * (1 - ss(0.84, 0.97, p)),
      bubbles: ss(0.06, 0.2, p) * (1 - ss(0.4, 0.54, p)),
    };
  }

  function shadeLoaf(img, W, H, f, s) {
    const d = img.data;
    const F = f.F;
    const cx = W / 2;
    const cy = H / 2;
    const R = (Math.min(W, H) / 2) * 0.93 * (0.72 + 0.26 * s.grow);
    const dome = s.dome;
    const wobAmp = 1 - 0.55 * s.grow;
    const micro = 0.1 + 0.14 * s.bake;
    const warmR = 1 + 0.1 * s.heat;
    const warmB = 1 - 0.1 * s.heat;
    const dull = 0.84 + 0.16 * s.wake;
    const doughR = mix(RAW[0], RISEN[0], s.rise);
    const doughG = mix(RAW[1], RISEN[1], s.rise);
    const doughB = mix(RAW[2], RISEN[2], s.rise);
    const flR = mix(FLOUR[0], FLOUR_BAKED[0], s.bake);
    const flG = mix(FLOUR[1], FLOUR_BAKED[1], s.bake);
    const flB = mix(FLOUR[2], FLOUR_BAKED[2], s.bake);
    const ckR = mix(CRACK_DOUGH[0], CRACK_BAKED[0], s.bake);
    const ckG = mix(CRACK_DOUGH[1], CRACK_BAKED[1], s.bake);
    const ckB = mix(CRACK_DOUGH[2], CRACK_BAKED[2], s.bake);
    const sx = cx + R * 0.1;
    const sy = cy + R * 0.14;
    let o = 0;
    for (let y = 0; y < H; y++) {
      const dy = (y - cy) / R;
      for (let x = 0; x < W; x++, o += 4) {
        const dx = (x - cx) / R;
        const r2 = dx * dx + dy * dy;
        let ang = Math.atan2(dy, dx);
        if (ang < 0) ang += TAU;
        const edgeR = 1 + f.wobble[((ang / TAU) * 360) | 0] * wobAmp;
        // background: page colour, soft contact shadow, oven glow while baking
        const sd = Math.hypot(x - sx, y - sy) / R;
        const sh = 0.35 + 0.65 * ss(0.92, 1.45, sd);
        const glow = s.heat * (1 - ss(0.96, 1.14, Math.sqrt(r2)));
        const bgR = mix(BOARD[0], EMBER[0], glow) * sh;
        const bgG = mix(BOARD[1], EMBER[1], glow) * sh;
        const bgB = mix(BOARD[2], EMBER[2], glow) * sh;
        const rim = (Math.sqrt(r2) - edgeR) * R; // px outside the edge
        if (rim > 0) {
          d[o] = bgR;
          d[o + 1] = bgG;
          d[o + 2] = bgB;
          d[o + 3] = 255;
          continue;
        }
        const cover = clamp(-rim / 1.5, 0, 1); // anti-aliased edge
        const u = dx / edgeR;
        const v = dy / edgeR;
        const rr = u * u + v * v;
        const fi = ((((v + 1) * 0.5 * (F - 1)) | 0) * F) + (((u + 1) * 0.5 * (F - 1)) | 0);
        let nx = u * dome + f.gx[fi] * micro;
        let ny = v * dome + f.gy[fi] * micro;
        const nz = Math.sqrt(Math.max(0.02, 1 - rr * dome * dome));
        const nm = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        const diff = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) * nm);
        let shade = (0.3 + 0.95 * diff) * (1 - 0.4 * ss(0.7, 1, rr)) * dull;

        const t = 0.9 + 0.22 * f.tex[fi];
        const cv = f.cell[fi];
        let r = doughR * t;
        let g = doughG * t;
        let b = doughB * t;
        if (s.bake > 0) {
          const k = cv * 0.5;
          r = mix(r, mix(CRUST[0], CRUST_DEEP[0], k), s.bake);
          g = mix(g, mix(CRUST[1], CRUST_DEEP[1], k), s.bake);
          b = mix(b, mix(CRUST[2], CRUST_DEEP[2], k), s.bake);
        }
        const fl = s.flour * f.flour[fi] * (0.75 + 0.25 * cv) * 0.92;
        if (fl > 0) {
          r = mix(r, flR, fl);
          g = mix(g, flG, fl);
          b = mix(b, flB, fl);
        }
        if (s.crack > 0) {
          const w = s.crack * Math.min(1.35, 0.2 + 3 * f.crackVar[fi] * f.crackVar[fi]) * (1 - 0.5 * rr);
          const e = f.edge[fi];
          if (e < w * 1.9) {
            const c = 1 - ss(w * 0.3, w, e);
            r = mix(r, ckR, c);
            g = mix(g, ckG, c);
            b = mix(b, ckB, c);
            shade *= 1 - 0.5 * c;
            const lip = ss(w, w * 1.3, e) * (1 - ss(w * 1.3, w * 1.9, e));
            shade *= 1 + 0.16 * lip;
          }
        }
        d[o] = mix(bgR, r * shade * warmR, cover);
        d[o + 1] = mix(bgG, g * shade, cover);
        d[o + 2] = mix(bgB, b * shade * warmB, cover);
        d[o + 3] = 255;
      }
    }
    return R;
  }

  function drawLoafBubbles(ctx, W, H, R, s, time) {
    if (s.bubbles <= 0.01) return;
    const cx = W / 2;
    const cy = H / 2;
    for (const b of loafBubbles) {
      const born = ss(b.born, b.born + 0.06, s.p);
      if (born <= 0) continue;
      const breathe = 1 + 0.07 * Math.sin(time * b.speed + b.phase);
      const r = b.s * R * (0.45 + 0.9 * s.rise) * breathe;
      const x = cx + b.u * R;
      const y = cy + b.v * R;
      const a = born * s.bubbles;
      if (s.p > b.pop) drawHole(ctx, x, y, r * 0.8, a * 0.9);
      else drawDome(ctx, x, y, r, a);
    }
  }

  /* ---------- scroll story ---------- */

  function initStory(fields) {
    const section = document.querySelector(".transform");
    const canvas = document.querySelector('[data-surface="loaf"]');
    if (!section || !canvas) return;
    const stageEl = section.querySelector(".transform-stage");
    const wrap = section.querySelector(".loaf-wrap");
    const steps = [...section.querySelectorAll(".step")];
    const cues = [0, 0.1, 0.24, 0.38, 0.52, 0.64, 0.8, 0.93];
    const ctx = canvas.getContext("2d");
    let img;
    let size = 0;
    let shownP = -1;
    let current = 0;
    let R = 0;
    let visible = false;
    let raf = 0;
    let active = -1;

    function resize() {
      const box = Math.min(wrap.clientWidth, wrap.clientHeight || wrap.clientWidth);
      const next = Math.round(clamp(box * DPR, 280, 680));
      if (next === size) return;
      size = next;
      canvas.width = size;
      canvas.height = size;
      img = ctx.createImageData(size, size);
      shownP = -1;
    }

    function progress() {
      const r = section.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      return total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    }

    function frame(time) {
      raf = 0;
      const target = progress();
      current = motion.matches ? target : current + (target - current) * 0.14;
      if (Math.abs(target - current) < 0.0005) current = target;
      if (Math.abs(current - shownP) > 0.0008) {
        shownP = current;
        R = shadeLoaf(img, size, size, fields, stage(current));
      }
      const s = stage(current);
      ctx.putImageData(img, 0, 0);
      drawLoafBubbles(ctx, size, size, R, s, motion.matches ? 0 : time / 1000);
      stageEl.style.setProperty("--p", current.toFixed(4));
      let idx = 0;
      for (let k = 0; k < cues.length; k++) if (current >= cues[k] - 0.001) idx = k;
      if (idx !== active) {
        if (active >= 0) steps[active].classList.remove("is-active");
        steps[idx].classList.add("is-active");
        steps.forEach((el, k) => el.setAttribute("aria-current", k === idx ? "step" : "false"));
        active = idx;
      }
      const moving = current !== target || (s.bubbles > 0.01 && !motion.matches);
      if (visible && moving) raf = window.requestAnimationFrame(frame);
    }

    function kick() {
      if (!raf && visible) raf = window.requestAnimationFrame(frame);
    }

    resize();
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      kick();
    }).observe(section);
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", () => {
      resize();
      kick();
    });
    visible = true;
    frame(0);
  }

  /* ---------- rendered fallbacks for the three real photographs ---------- */

  function initShots(fields) {
    document.querySelectorAll(".shot").forEach((fig) => {
      const img = fig.querySelector("img");
      const frameEl = fig.querySelector(".frame");
      const render = () => {
        if (fig.classList.contains("is-rendered")) return;
        fig.classList.add("is-rendered");
        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        const w = Math.round(clamp(frameEl.clientWidth * DPR, 240, 560));
        const h = Math.round(w * 1.25);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        const data = ctx.createImageData(w, h);
        const s = stage(parseFloat(fig.dataset.stage) || 1);
        const R = shadeLoaf(data, w, h, fields, s);
        ctx.putImageData(data, 0, 0);
        drawLoafBubbles(ctx, w, h, R, s, 0);
        frameEl.appendChild(canvas);
      };
      if (!img) return render();
      if (img.complete && img.naturalWidth === 0) render();
      else if (!img.complete) img.addEventListener("error", render, { once: true });
    });
  }

  /* ---------- hero: the living surface ---------- */

  function initHero() {
    const canvas = document.querySelector('[data-surface="alive"]');
    if (!canvas) return;
    const host = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const base = document.createElement("canvas");
    const bctx = base.getContext("2d");
    let W = 0;
    let H = 0;
    let bubbles = [];
    let motes = [];
    let visible = true;
    let raf = 0;
    let lastW = 0;
    const r = rng(7);

    function spawn(b, t, fresh) {
      b.x = r() * W;
      b.y = r() * H;
      b.max = (3 + Math.pow(r(), 2.4) * 30) * (W / 600);
      b.grow = 3 + r() * 6;
      b.hold = 1 + r() * 4;
      b.fade = 3 + r() * 3;
      b.t0 = fresh ? t - r() * (b.grow + b.hold + b.fade) : t + r() * 2;
      return b;
    }

    function build() {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      const scale = Math.min(DPR, Math.sqrt(700000 / (w * h)));
      W = canvas.width = base.width = Math.round(w * scale);
      H = canvas.height = base.height = Math.round(h * scale);
      const img = bctx.createImageData(W, H);
      const d = img.data;
      const k = 1 / (150 * (W / 700 > 1 ? W / 700 : 1));
      const hgt = new Float32Array((W + 1) * (H + 1));
      for (let y = 0; y <= H; y++) {
        for (let x = 0; x <= W; x++) {
          hgt[y * (W + 1) + x] = fbm(nA, x * k, y * k, 4) + 0.08 * fbm(nC, x * k * 5, y * k * 5, 2);
        }
      }
      let o = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++, o += 4) {
          const i = y * (W + 1) + x;
          const h0 = hgt[i];
          let nx = -(hgt[i + 1] - h0) * 9;
          let ny = -(hgt[i + W + 1] - h0) * 9;
          const m = 1 / Math.sqrt(nx * nx + ny * ny + 0.02);
          nx *= m; ny *= m;
          const nz = 0.14 * m;
          const nn = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
          const ndl = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) * nn);
          const hz = (nz * nn + (nx * L[0] + ny * L[1] + nz * L[2]) * nn) * 0.5;
          const spec = Math.pow(Math.max(0, hz), 40) * 0.5;
          const px = x / W;
          const py = y / H;
          const pool = 1 - 0.62 * ss(0.15, 1.25, Math.hypot(px - 0.22, (py - 0.18) * 0.9));
          const t = 0.88 + 0.24 * fbm(nB, x * k * 3, y * k * 3, 3);
          const speck = hash(x, y, 4) > 0.992 ? 0.55 : 1;
          const light = (0.34 + 0.85 * ndl) * pool;
          d[o] = (RISEN[0] * t * speck * light + 255 * spec * pool);
          d[o + 1] = (RISEN[1] * t * speck * light + 246 * spec * pool);
          d[o + 2] = (RISEN[2] * t * speck * light + 228 * spec * pool);
          d[o + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);
      const now = performance.now() / 1000;
      bubbles = Array.from({ length: Math.round(28 * (W * H) / 400000) + 14 }, () => spawn({}, now, true));
      motes = Array.from({ length: 34 }, () => ({
        x: r() * W * 0.7,
        y: r() * H * 0.6,
        s: 0.6 + r() * 1.6,
        vx: 3 + r() * 8,
        vy: 2 + r() * 6,
        ph: r() * TAU,
      }));
    }

    function draw(t) {
      ctx.drawImage(base, 0, 0);
      const unit = W / 600;
      for (const b of bubbles) {
        let age = t - b.t0;
        if (age < 0) continue;
        const life = b.grow + b.hold + b.fade;
        if (age > life) {
          spawn(b, t, false);
          continue;
        }
        if (age < b.grow + b.hold) {
          const g = ss(0, b.grow, age);
          const breathe = 1 + 0.05 * Math.sin(t * 1.3 + b.x);
          drawDome(ctx, b.x, b.y, b.max * (0.15 + 0.85 * g) * breathe, ss(0, 0.6, age));
        } else {
          const f = (age - b.grow - b.hold) / b.fade;
          drawHole(ctx, b.x, b.y, b.max * 0.75, 1 - f);
        }
      }
      // rye dust drifting through the light
      ctx.fillStyle = "rgba(246, 238, 222, 0.7)";
      for (const m of motes) {
        const x = (m.x + t * m.vx * unit) % (W * 0.8);
        const y = (m.y + t * m.vy * unit + Math.sin(t * 0.5 + m.ph) * 6 * unit) % (H * 0.7);
        ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * 0.7 + m.ph) ** 2;
        ctx.beginPath();
        ctx.arc(x, y, m.s * unit, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function loop(ms) {
      raf = 0;
      draw(ms / 1000);
      if (visible && !motion.matches && !document.hidden) raf = window.requestAnimationFrame(loop);
    }

    function start() {
      if (!raf && visible && !document.hidden) raf = window.requestAnimationFrame(loop);
    }

    build();
    lastW = host.clientWidth;
    draw(performance.now() / 1000 + 4);
    if (!motion.matches) start();

    new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      if (visible && !motion.matches) start();
    }).observe(host);
    document.addEventListener("visibilitychange", () => {
      if (!motion.matches) start();
    });
    window.addEventListener("resize", () => {
      if (host.clientWidth === lastW) return; // ignore mobile toolbar height changes
      lastW = host.clientWidth;
      build();
      draw(performance.now() / 1000);
    });
  }

  /* ---------- reveals + adopt dock ---------- */

  function initReveals() {
    const els = document.querySelectorAll(
      ".litany li, .meet .essence, .section-head, .contents li, .ritual li, .shot, .adopt .display"
    );
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = `${(i % 5) * 70}ms`;
      io.observe(el);
    });
  }

  function initBar() {
    const bar = document.querySelector(".bar");
    const dark = document.querySelectorAll(".transform, .adopt");
    if (!bar) return;
    const over = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? over.add(e.target) : over.delete(e.target)));
        bar.classList.toggle("on-dark", over.size > 0);
      },
      { rootMargin: "0px 0px -100% 0px" } // only what sits under the bar
    );
    dark.forEach((el) => io.observe(el));
  }

  function initDock() {
    const dock = document.querySelector(".dock");
    const blockers = document.querySelectorAll(".hero, .transform, .box-cta, .adopt, .foot");
    if (!dock || !blockers.length) return;
    const showing = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? showing.add(e.target) : showing.delete(e.target)));
      dock.classList.toggle("is-visible", showing.size === 0);
    });
    blockers.forEach((el) => io.observe(el));
  }

  /* ---------- boot ---------- */

  if (!("IntersectionObserver" in window) || !window.CanvasRenderingContext2D) {
    doc.classList.remove("js");
    return;
  }

  initReveals();
  initBar();
  initDock();
  initHero();

  // Build the loaf fields just before they are needed.
  const target = document.querySelector(".transform");
  let built = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (built || !entries.some((e) => e.isIntersecting)) return;
      built = true;
      io.disconnect();
      const F = Math.round(clamp(Math.min(window.innerWidth, 900) * DPR, 320, 640));
      createFields(F, (fields) => {
        initStory(fields);
        initShots(fields);
      });
    },
    { rootMargin: "150% 0px" }
  );
  if (target) io.observe(target);
})();
