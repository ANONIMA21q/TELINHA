// Telinha — camada de rabiscos (usada nos vídeos e na janela por cima da tela).
// Coordenadas sempre de 0 a 1 em relação à imagem transmitida.
'use strict';
(() => {
  const LIFE = 3200;   // rabisco fica 3,2 s inteiro...
  const FADE = 900;    // ...e some em 0,9 s
  const PLIFE = 1200;  // laser some 1,2 s depois de parar

  function layer(canvas, rectFn, opts = {}) {
    const ctx = canvas.getContext('2d');
    const strokes = new Map(); // id -> { pts: [], col, t }
    const ptrs = new Map();    // quem -> { x, y, col, n, t }
    const scale = opts.scale || 1;
    let raf = null;

    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };

    function apply(m) {
      if (!m || typeof m !== 'object') return;
      const now = performance.now();
      if (m.k === 's' && Array.isArray(m.p)) {
        let s = strokes.get(m.id);
        if (!s) { s = { pts: [], col: m.col || m.c || '#ff7a45', t: now }; strokes.set(m.id, s); }
        for (let i = 0; i + 1 < m.p.length; i += 2) s.pts.push(m.p[i], m.p[i + 1]);
        s.t = now;
      } else if (m.k === 'p' && Array.isArray(m.p)) {
        ptrs.set(m.n || m.id || '?', { x: m.p[0], y: m.p[1], col: m.c || '#ff4d5e', n: m.n || '', t: now });
      } else if (m.k === 'c') {
        for (const id of [...strokes.keys()]) if (!m.by || id.startsWith(m.by + ':')) strokes.delete(id);
      }
      kick();
    }

    function draw() {
      raf = null;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const r = rectFn();
      if (!r) return;
      const now = performance.now();
      let alive = false;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [id, s] of strokes) {
        const age = now - s.t;
        if (age > LIFE + FADE) { strokes.delete(id); continue; }
        alive = true;
        ctx.globalAlpha = age < LIFE ? 1 : 1 - (age - LIFE) / FADE;
        ctx.shadowColor = 'rgba(0,0,0,.55)';
        ctx.shadowBlur = 4 * scale;
        ctx.strokeStyle = s.col;
        ctx.lineWidth = 4 * scale;
        ctx.beginPath();
        for (let i = 0; i + 1 < s.pts.length; i += 2) {
          const x = r.x + s.pts[i] * r.w;
          const y = r.y + s.pts[i + 1] * r.h;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        if (s.pts.length === 2) ctx.lineTo(r.x + s.pts[0] * r.w + 0.1, r.y + s.pts[1] * r.h);
        ctx.stroke();
      }
      for (const [who, p] of ptrs) {
        const age = now - p.t;
        if (age > PLIFE) { ptrs.delete(who); continue; }
        alive = true;
        const x = r.x + p.x * r.w;
        const y = r.y + p.y * r.h;
        ctx.globalAlpha = age < PLIFE - 300 ? 1 : (PLIFE - age) / 300;
        ctx.shadowColor = p.col;
        ctx.shadowBlur = 18 * scale;
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(x, y, 7 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 2.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        if (opts.labels && p.n) {
          ctx.font = `700 ${12 * scale}px "Segoe UI", system-ui, sans-serif`;
          const tw = ctx.measureText(p.n).width;
          ctx.fillStyle = 'rgba(0,0,0,.65)';
          ctx.fillRect(x + 12 * scale, y + 8 * scale, tw + 12 * scale, 18 * scale);
          ctx.fillStyle = '#fff';
          ctx.fillText(p.n, x + 18 * scale, y + 21 * scale);
        }
      }
      ctx.globalAlpha = 1;
      if (alive) kick();
    }

    return { apply, clear() { strokes.clear(); ptrs.clear(); kick(); }, redraw: kick };
  }

  window.TelinhaDraw = { layer };
})();
