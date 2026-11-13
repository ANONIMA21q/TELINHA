// Telinha — configurações: temas, fundo, padrões de transmissão, sons e placa de vídeo.
'use strict';
(() => {
  const api = window.telinha || null;
  const KEY = 'telinha.settings';

  const THEMES = [
    { id: 'brasa',    nome: 'Brasa',    accent: '#ff7a45', bg: '#0e1117', bg2: '#151a23', bg3: '#1d2430', line: '#2a3242', glow: 'rgba(255,122,69,.16)', glow2: 'rgba(110,90,255,.14)' },
    { id: 'neon',     nome: 'Neon',     accent: '#b26bff', bg: '#0c0a14', bg2: '#141022', bg3: '#1d1730', line: '#2e2545', glow: 'rgba(178,107,255,.20)', glow2: 'rgba(0,229,255,.14)' },
    { id: 'oceano',   nome: 'Oceano',   accent: '#3db8ff', bg: '#08111a', bg2: '#0e1a26', bg3: '#152434', line: '#21364a', glow: 'rgba(61,184,255,.18)', glow2: 'rgba(0,255,200,.10)' },
    { id: 'floresta', nome: 'Floresta', accent: '#3ddc84', bg: '#0a120e', bg2: '#101a15', bg3: '#17241d', line: '#24382d', glow: 'rgba(61,220,132,.16)', glow2: 'rgba(200,255,90,.08)' },
    { id: 'sakura',   nome: 'Sakura',   accent: '#ff6fa8', bg: '#140b10', bg2: '#1d1118', bg3: '#281822', line: '#3c2533', glow: 'rgba(255,111,168,.18)', glow2: 'rgba(255,190,120,.10)' },
    { id: 'grafite',  nome: 'Grafite',  accent: '#e6e6e6', bg: '#0b0b0c', bg2: '#141416', bg3: '#1c1c1f', line: '#2b2b30', glow: 'rgba(255,255,255,.06)', glow2: 'rgba(255,255,255,.04)' },
    { id: 'claro',    nome: 'Claro',    accent: '#ff6a2b', bg: '#f3f4f7', bg2: '#ffffff', bg3: '#eceef3', line: '#d9dce4', glow: 'rgba(255,106,43,.14)', glow2: 'rgba(90,110,255,.10)', light: true },
  ];

  const DEFAULTS = {
    theme: 'brasa', accent: '', bg: '', bgBlur: 8, bgDim: 55, glass: true,
    animations: true, sounds: true, volume: 60, reactions: true,
    codec: 'auto', capture: 'auto',
    avatarType: 'initial', avatarEmoji: '😎', avatarPhoto: '', nameColor: '',
    closeToTray: true, splash: true,
    micMode: 'vad', micDevice: '', pttKey: 'KeyV', vadLevel: 35, voiceVolume: 100, micNoise: true,
    pipOnMinimize: true, remoteAllow: true, discordStatus: true, discordJoin: true,
  };
  const KEY_NAMES = { Space: 'Espaço', CapsLock: 'Caps Lock', Backquote: "'", ShiftLeft: 'Shift esq.', ControlLeft: 'Ctrl esq.', AltLeft: 'Alt esq.', Tab: 'Tab' };
  const keyName = (code) => KEY_NAMES[code] || String(code || '').replace(/^Key|^Digit/, '');

  const EMOJIS = ['😎', '🤠', '👾', '🤖', '👻', '💀', '🐱', '🐶', '🦊', '🐼', '🐸', '🐵', '🦄', '🐲', '🔥', '⚡', '🎮', '🎧', '🍕', '🌮', '⚽', '🏀', '🚀', '👑'];
  const NAME_COLORS = ['', '#ff7a45', '#ffc24b', '#3ddc84', '#3db8ff', '#7a8cff', '#b26bff', '#ff6fa8', '#ff4d5e', '#e8ecf3'];
  const CHANGELOG = [
    ['4.1', 'Janelinha de novidades, janelinha flutuante, atualização leve, controle remoto, convite clicável, assistir pelo navegador e status no Discord.', [
      ['🆕', 'Novidades', 'Esta janelinha: sempre que o Telinha atualizar, ela mostra o que mudou.'],
      ['🪟', 'Janelinha flutuante', 'Assista a tela do amigo numa janela pequena, sempre por cima, enquanto usa o PC. Botão no vídeo ou minimizando o Telinha.'],
      ['⚡', 'Atualização leve', 'As próximas atualizações baixam só o que mudou (menos de 1 MB) e valem quando você reabrir o Telinha.'],
      ['🖱️', 'Controle remoto', 'Quem assiste pode pedir pra mexer no seu PC. Você aceita ou não, e para quando quiser (Ctrl+Shift+F12).'],
      ['🔗', 'Convite clicável', 'O link de convite agora abre no Discord e no WhatsApp com um clique.'],
      ['🌐', 'Assistir pelo navegador', 'Quem não tem o Telinha assiste pelo link, no PC ou no celular.'],
      ['🎮', 'Status no Discord', 'Seus amigos veem "Telinha · numa sala" no seu perfil, com botão pra entrar.'],
    ]],
    ['4.0', 'Atualização automática, ping e tipo de conexão de cada pessoa, som de um programa só, filtro de ruído (IA) no microfone, dono da sala (senha, expulsar, mutar, passar o dono), imagens e arquivos no chat (dá pra colar print) com aviso e som. Salas recentes saíram.'],
    ['3.4', 'VPN do Telinha (ZeroTier) embutida: o código de 12 letras já leva a rede, e entrar é automático.'],
    ['3.0', 'Microfone (detecção de voz, push-to-talk ou aberto) com indicador de quem fala, e desenho na tela: quem assiste rabisca ou aponta com laser e você vê por cima do seu monitor.'],
    ['2.5', 'Perfil com avatar e cor do nome, salas recentes, link de convite, modo cinema, gravação, atalhos globais, bandeja do sistema, abertura animada, ícone próprio, instalador e esta tela de Sobre.'],
    ['2.1', 'Captura de janela pelo GDI otimizado (só a janela, sem bordas, sem quadros repetidos) e salvador de configurações com exportar/importar.'],
    ['2.0', 'Configurações com temas, cor de destaque, foto de fundo e vidro; detector de placa de vídeo; reações com emoji; sons.'],
    ['1.8', 'H.264 na placa de vídeo (NVENC / AMF / Quick Sync) quando disponível.'],
    ['1.7', 'Captura pausa sozinha quando ninguém assiste; compressor de imagem mais rápido escolhido automaticamente.'],
    ['1.6', 'Prévia da própria tela desligada por padrão; captura sem travar a placa de vídeo; redução de tamanho na placa.'],
    ['1.5', 'Captura nativa pelo DXGI (placa de vídeo, até 60 fps).'],
    ['1.4', 'Captura nativa pelo GDI para Windows que bloqueiam a captura moderna.'],
    ['1.0', 'Primeira versão: salas por código, compartilhar tela com som, chat.'],
  ];

  let S = { ...DEFAULTS };
  try { S = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') || {}) }; } catch { /* sem armazenamento */ }
  // ------------------------------------------------------------ salvador
  // Além do armazenamento do app, guarda tudo em Documentos\Telinha\configuracoes.json.
  const EXTRA = ['telinha.name', 'telinha.quality', 'telinha.kind', 'telinha.preview'];
  function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* */ } }
  function snapshot() {
    const extra = {};
    for (const k of EXTRA) { const v = lsGet(k); if (v != null) extra[k] = v; }
    return JSON.stringify({ app: 'telinha', version: 1, savedAt: new Date().toISOString(), settings: S, extra });
  }
  let lastBackup = '';
  let backupTimer = null;
  function backupSoon() {
    if (!api || !api.settingsSave) return;
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => {
      const snap = snapshot();
      const cmp = snap.replace(/"savedAt":"[^"]*",/, '');
      if (cmp === lastBackup) return;
      api.settingsSave(snap).then((ok) => { if (ok) lastBackup = cmp; });
    }, 700);
  }
  function applyBackup(text, quiet) {
    let j;
    try { j = JSON.parse(text); } catch { return false; }
    if (!j || j.app !== 'telinha' || typeof j.settings !== 'object') return false;
    S = { ...DEFAULTS, ...j.settings };
    for (const k of EXTRA) if (j.extra && typeof j.extra[k] === 'string') lsSet(k, j.extra[k]);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* */ }
    applyAppearance();
    const nm = document.querySelector('#name');
    if (nm && !nm.value && j.extra && j.extra['telinha.name']) nm.value = j.extra['telinha.name'];
    renderSettings();
    if (!quiet) toast('Configurações importadas!');
    backupSoon();
    return true;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Não deu pra salvar (imagem grande demais?)', 'warn'); }
    backupSoon();
    profileChanged();
    if (api && api.setCloseToTray) api.setCloseToTray(S.closeToTray);
  }

  // Foto de perfil: corta no meio, quadrada, 128 px.
  function pickAvatar() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        const bmp = await createImageBitmap(f);
        const side = Math.min(bmp.width, bmp.height);
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 128, 128);
        bmp.close();
        S.avatarPhoto = c.toDataURL('image/jpeg', 0.8);
        S.avatarType = 'photo';
        save();
        renderSettings();
      } catch (e) { toast('Não consegui abrir essa imagem: ' + e.message, 'error'); }
    };
    inp.click();
  }

  // Desenha um avatar (usado aqui e na sala).
  function avatarEl(name, prof, size) {
    const a = el('span', 'avatar');
    if (size) { a.style.width = a.style.height = size + 'px'; a.style.fontSize = Math.round(size * 0.45) + 'px'; }
    const p = prof || {};
    const av = p.av || {};
    if (av.t === 'photo' && /^data:image\/jpeg;base64,/.test(av.v || '')) {
      const img = el('img');
      img.src = av.v;
      img.alt = '';
      a.append(img);
      a.classList.add('photo');
    } else if (av.t === 'emoji' && av.v) {
      a.textContent = av.v;
      a.classList.add('emoji');
    } else {
      a.textContent = (name || '?').trim().charAt(0).toUpperCase() || '?';
    }
    return a;
  }

  const $ = (q) => document.querySelector(q);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const toast = (t, k) => (window.__telinhaToast ? window.__telinhaToast(t, k) : console.log(t));

  // ------------------------------------------------------------ cores
  function hexToRgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const mix = (rgb, to, t) => rgb.map((c, i) => Math.round(c + (to[i] - c) * t));
  const toHex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
  const lum = (rgb) => { const a = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };

  // ------------------------------------------------------------ aparência
  function applyAppearance() {
    const t = THEMES.find((x) => x.id === S.theme) || THEMES[0];
    const r = document.documentElement.style;
    const accent = hexToRgb(S.accent) || hexToRgb(t.accent);
    const light = !!t.light;
    r.setProperty('--bg', t.bg);
    r.setProperty('--bg-2', t.bg2);
    r.setProperty('--bg-3', t.bg3);
    r.setProperty('--line', t.line);
    r.setProperty('--text', light ? '#161a22' : '#e8ecf3');
    r.setProperty('--muted', light ? '#5d667a' : '#8b95a8');
    r.setProperty('--accent', toHex(accent));
    r.setProperty('--accent-2', toHex(mix(accent, light ? [0, 0, 0] : [255, 255, 255], 0.2)));
    r.setProperty('--accent-ink', lum(accent) > 0.45 ? '#14100c' : '#ffffff');
    r.setProperty('--accent-rgb', accent.join(','));
    r.setProperty('--glow', t.glow);
    r.setProperty('--glow-2', t.glow2);
    r.setProperty('--stage-bg', light ? '#11141a' : '#05070a');
    document.body.classList.toggle('light', light);
    document.body.classList.toggle('no-anim', !S.animations);

    const layer = $('#bg-layer');
    const hasBg = !!S.bg;
    document.body.classList.toggle('has-bg', hasBg);
    document.body.classList.toggle('glass', hasBg && S.glass);
    if (layer) {
      layer.style.backgroundImage = hasBg ? `url("${S.bg}")` : '';
      layer.style.filter = hasBg ? `blur(${S.bgBlur}px)` : '';
      layer.style.transform = hasBg && S.bgBlur > 0 ? 'scale(1.06)' : '';
    }
    r.setProperty('--bg-dim', String((S.bgDim || 0) / 100));
  }

  // ------------------------------------------------------------ sons
  let actx = null;
  function beep(notes) {
    if (!S.sounds) return;
    try {
      actx = actx || new AudioContext();
      const vol = (S.volume / 100) * 0.12;
      let t = actx.currentTime;
      for (const [f, d] of notes) {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + d + 0.02);
        t += d * 0.7;
      }
    } catch { /* sem áudio */ }
  }
  const SOUNDS = {
    join: [[660, 0.12], [880, 0.16]],
    leave: [[700, 0.12], [460, 0.18]],
    chat: [[990, 0.08]],
    react: [[1200, 0.05]],
    live: [[520, 0.1], [780, 0.1], [1040, 0.18]],
  };
  const play = (name) => SOUNDS[name] && beep(SOUNDS[name]);

  // ------------------------------------------------------------ placa
  let gpu = null;
  async function loadGpu() {
    if (!api || !api.gpuInfo) return null;
    try { gpu = await api.gpuInfo(); } catch { gpu = null; }
    return gpu;
  }
  function autoCodec() { return gpu && gpu.encoder ? 'h264' : 'vp8'; }
  function codecChoice() { return S.codec === 'auto' ? autoCodec() : S.codec; }
  function gpuLabel() {
    if (!gpu || !gpu.main) return 'Nenhuma placa detectada';
    const n = gpu.main.name || `${gpu.main.vendor} (0x${(gpu.main.deviceId || 0).toString(16)})`;
    return n.toLowerCase().includes(gpu.main.vendor.toLowerCase()) ? n : `${gpu.main.vendor} ${n}`;
  }
  function encoderLabel() {
    if (gpu && gpu.encoder) return `${gpu.encoder} (H.264 na placa de vídeo)`;
    return 'Processador (sem codificador de placa)';
  }

  // ------------------------------------------------------------ fundo
  function pickBackground() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        const bmp = await createImageBitmap(f);
        const max = 1920;
        const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * k);
        c.height = Math.round(bmp.height * k);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        bmp.close();
        S.bg = c.toDataURL('image/jpeg', 0.82);
        save();
        applyAppearance();
        renderSettings();
      } catch (e) {
        toast('Não consegui abrir essa imagem: ' + e.message, 'error');
      }
    };
    inp.click();
  }

  // ------------------------------------------------------------ tela de configurações
  let tab = 'aparencia';
  function openSettings(which) {
    if (which) tab = which;
    $('#settings').classList.remove('hidden');
    loadGpu().then(renderSettings);
    renderSettings();
  }
  function closeSettings() { $('#settings').classList.add('hidden'); }

  function row(label, hint, control) {
    const r = el('div', 'set-row');
    const t = el('div', 'set-label');
    t.append(el('strong', null, label));
    if (hint) t.append(el('span', 'muted', hint));
    r.append(t, control);
    return r;
  }
  function toggle(key, onChange) {
    const l = el('label', 'switch');
    const i = el('input');
    i.type = 'checkbox';
    i.checked = !!S[key];
    i.onchange = () => { S[key] = i.checked; save(); applyAppearance(); if (onChange) onChange(); };
    l.append(i, el('span', 'knob'));
    return l;
  }
  function select(key, options, onChange) {
    const sel = el('select');
    for (const [v, t] of options) { const o = el('option', null, t); o.value = v; sel.append(o); }
    sel.value = S[key];
    sel.onchange = () => { S[key] = sel.value; save(); if (onChange) onChange(); };
    return sel;
  }
  function storeSelect(storeKey, options, def) {
    const sel = el('select');
    for (const [v, t] of options) { const o = el('option', null, t); o.value = v; sel.append(o); }
    let cur = def;
    try { cur = localStorage.getItem(storeKey) || def; } catch { /* */ }
    sel.value = cur;
    sel.onchange = () => { try { localStorage.setItem(storeKey, sel.value); } catch { /* */ } backupSoon(); };
    return sel;
  }
  function slider(key, min, max, unit) {
    const w = el('div', 'slider');
    const i = el('input');
    i.type = 'range'; i.min = min; i.max = max; i.value = S[key];
    const v = el('span', 'slider-val', `${S[key]}${unit}`);
    i.oninput = () => { S[key] = Number(i.value); v.textContent = `${S[key]}${unit}`; applyAppearance(); document.dispatchEvent(new CustomEvent('telinha-voice-settings')); };
    i.onchange = save;
    w.append(i, v);
    return w;
  }

  function renderSettings() {
    const body = $('#settings-body');
    if (!body) return;
    document.querySelectorAll('.set-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    body.textContent = '';

    if (tab === 'voz') {
      body.append(el('h3', null, 'Microfone'));
      const dev = el('select');
      const def = el('option', null, 'Padrão do Windows');
      def.value = '';
      dev.append(def);
      dev.value = S.micDevice;
      dev.onchange = () => { S.micDevice = dev.value; save(); document.dispatchEvent(new CustomEvent('telinha-mic-device')); };
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then((list) => {
          for (const d of list.filter((x) => x.kind === 'audioinput' && x.deviceId !== 'default' && x.deviceId !== 'communications')) {
            const o = el('option', null, d.label || 'Microfone');
            o.value = d.deviceId;
            dev.append(o);
          }
          dev.value = S.micDevice;
        }).catch(() => {});
      }
      body.append(row('Dispositivo', null, dev));
      body.append(row('Filtro de ruído (IA)', 'Tira teclado, ventilador e chiado da sua voz. Vale ao religar o microfone', toggle('micNoise', () => document.dispatchEvent(new CustomEvent('telinha-mic-device')))));
      body.append(row('Modo', 'Ctrl+Shift+F8 liga/desliga de qualquer lugar', select('micMode', [
        ['vad', 'Detecção de voz (abre quando você fala)'],
        ['ptt', 'Push-to-talk (segurar uma tecla, com o Telinha em foco)'],
        ['open', 'Sempre aberto'],
      ], () => renderSettings())));
      if (S.micMode === 'vad') body.append(row('Sensibilidade', 'Mais alto = abre com voz mais baixa', slider('vadLevel', 1, 100, '')));
      if (S.micMode === 'ptt') {
        const b = el('button', 'btn small', keyName(S.pttKey));
        b.onclick = () => {
          b.textContent = 'Aperte uma tecla…';
          const h = (e) => { e.preventDefault(); S.pttKey = e.code; save(); document.removeEventListener('keydown', h, true); renderSettings(); };
          document.addEventListener('keydown', h, true);
        };
        body.append(row('Tecla do push-to-talk', 'Funciona com a janela do Telinha em foco', b));
      }
      body.append(el('h3', null, 'Ouvir os amigos'));
      body.append(row('Volume das vozes', null, slider('voiceVolume', 0, 200, '%')));
    }

    if (tab === 'perfil') {
      const nm = (() => { try { return localStorage.getItem('telinha.name') || 'Você'; } catch { return 'Você'; } })();
      const card = el('div', 'profile-card');
      const big = avatarEl(nm, profile(), 72);
      const who = el('div', 'profile-who');
      const nmEl = el('strong', 'profile-name', nm);
      if (S.nameColor) nmEl.style.color = S.nameColor;
      who.append(nmEl, el('span', 'muted', 'É assim que seus amigos te veem na sala'));
      card.append(big, who);
      body.append(card);

      body.append(el('h3', null, 'Avatar'));
      const types = el('div', 'seg');
      for (const [v, t] of [['initial', 'Inicial'], ['emoji', 'Emoji'], ['photo', 'Foto']]) {
        const b = el('button', 'seg-btn' + (S.avatarType === v ? ' active' : ''), t);
        b.onclick = () => { if (v === 'photo' && !S.avatarPhoto) { pickAvatar(); return; } S.avatarType = v; save(); renderSettings(); };
        types.append(b);
      }
      body.append(types);
      if (S.avatarType === 'emoji') {
        const g = el('div', 'emoji-grid');
        for (const e of EMOJIS) {
          const b = el('button', 'emoji-pick' + (S.avatarEmoji === e ? ' selected' : ''), e);
          b.onclick = () => { S.avatarEmoji = e; save(); renderSettings(); };
          g.append(b);
        }
        body.append(g);
      }
      if (S.avatarType === 'photo') {
        const r = el('div', 'tool-row');
        const ch = el('button', 'btn small', 'Trocar foto');
        ch.onclick = pickAvatar;
        const rm = el('button', 'btn small ghost', 'Remover foto');
        rm.onclick = () => { S.avatarPhoto = ''; S.avatarType = 'initial'; save(); renderSettings(); };
        r.append(ch, rm);
        body.append(r);
      }

      body.append(el('h3', null, 'Cor do nome'));
      const pal = el('div', 'palette');
      for (const c of NAME_COLORS) {
        const b = el('button', 'pal' + ((S.nameColor || '') === c ? ' selected' : '') + (c ? '' : ' auto'));
        b.title = c ? c : 'Automática';
        if (c) b.style.background = c; else b.textContent = 'A';
        b.onclick = () => { S.nameColor = c; save(); renderSettings(); };
        pal.append(b);
      }
      const custom = el('input');
      custom.type = 'color';
      custom.className = 'pal-custom';
      custom.value = S.nameColor || '#ff7a45';
      custom.title = 'Outra cor';
      custom.onchange = () => { S.nameColor = custom.value; save(); renderSettings(); };
      pal.append(custom);
      body.append(pal);
    }

    if (tab === 'sobre') {
      const hero = el('div', 'about-hero');
      hero.innerHTML = '<svg class="about-logo" viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="8" width="40" height="27" rx="6" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M17 42h14M24 35v7" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="21.5" r="5" fill="currentColor"/></svg>';
      const t = el('div', 'about-title');
      t.append(el('h2', null, 'Telinha'), el('span', 'muted about-ver', appInfo ? `Versão ${appInfo.version}` : ''));
      hero.append(t);
      if (window.__telinhaUpdate) {
        const ub = el('button', 'btn small ghost', 'Procurar atualização');
        ub.onclick = async () => {
          ub.disabled = true; ub.textContent = 'Procurando…';
          const r = await window.__telinhaUpdate.check(true);
          ub.disabled = false;
          ub.textContent = r && r.version ? `Versão ${r.version} disponível — veja na tela inicial` : 'Procurar atualização';
        };
        t.append(ub);
      }
      if (window.__telinhaWhatsNew) {
        const nb = el('button', 'btn small ghost', 'Ver novidades');
        nb.onclick = () => window.__telinhaWhatsNew(true);
        t.append(nb);
      }
      body.append(hero);

      const credit = el('div', 'credit-card');
      credit.append(el('span', 'credit-label', 'Criado por'));
      const nm = el('div', 'credit-name');
      nm.append(el('strong', null, 'Th.exe'), el('span', 'credit-sep', '·'), el('span', 'credit-hex', '0x5448'));
      credit.append(nm, el('span', 'muted', 'Ideia, testes e direção do projeto'));
      body.append(credit);

      body.append(el('h3', null, 'Atalhos'));
      const keys = el('div', 'keys');
      for (const [k, d] of [['Ctrl + Shift + F9', 'Começar / parar de transmitir'], ['Ctrl + Shift + F10', 'Começar / parar de gravar'], ['Ctrl + Shift + F8', 'Ligar / desligar o microfone'], ['Esc', 'Sair do modo cinema'], ['2 cliques no vídeo', 'Tela cheia']]) {
        const r = el('div', 'key-row');
        r.append(el('kbd', null, k), el('span', null, d));
        keys.append(r);
      }
      body.append(keys);

      body.append(el('h3', null, 'Novidades'));
      const log = el('div', 'changelog');
      for (const [v, txt] of CHANGELOG) {
        const r = el('div', 'cl-row');
        r.append(el('span', 'cl-ver', v), el('span', null, txt));
        log.append(r);
      }
      body.append(log);

      body.append(el('p', 'muted about-tech', appInfo
        ? `Electron ${appInfo.electron} · Chromium ${appInfo.chrome} · PeerJS · WebRTC · captura nativa DXGI/GDI`
        : 'Electron · PeerJS · WebRTC'));
    }

    if (tab === 'aparencia') {
      body.append(el('h3', null, 'Tema'));
      const grid = el('div', 'theme-grid');
      for (const t of THEMES) {
        const b = el('button', 'theme-card' + (S.theme === t.id ? ' selected' : ''));
        b.type = 'button';
        const sw = el('div', 'theme-swatch');
        sw.style.background = `radial-gradient(120% 120% at 0% 0%, ${t.glow.replace(/[\d.]+\)$/, '.9)')}, transparent 60%), linear-gradient(135deg, ${t.bg2}, ${t.bg})`;
        const dot = el('span', 'theme-dot');
        dot.style.background = t.accent;
        sw.append(dot);
        b.append(sw, el('span', null, t.nome));
        b.onclick = () => { S.theme = t.id; save(); applyAppearance(); renderSettings(); };
        grid.append(b);
      }
      body.append(grid);

      const color = el('div', 'color-row');
      const ci = el('input');
      ci.type = 'color';
      ci.value = S.accent || (THEMES.find((x) => x.id === S.theme) || THEMES[0]).accent;
      ci.oninput = () => { S.accent = ci.value; applyAppearance(); };
      ci.onchange = save;
      const reset = el('button', 'btn small ghost', 'Cor do tema');
      reset.onclick = () => { S.accent = ''; save(); applyAppearance(); renderSettings(); };
      color.append(ci, reset);
      body.append(row('Cor de destaque', 'Botões, bordas e detalhes', color));

      body.append(el('h3', null, 'Imagem de fundo'));
      const bgBox = el('div', 'bg-box');
      const prev = el('div', 'bg-preview');
      if (S.bg) prev.style.backgroundImage = `url("${S.bg}")`;
      else prev.append(el('span', 'muted', 'Sem imagem'));
      const btns = el('div', 'bg-btns');
      const choose = el('button', 'btn small primary', S.bg ? 'Trocar imagem' : 'Escolher imagem');
      choose.onclick = pickBackground;
      btns.append(choose);
      if (S.bg) {
        const rm = el('button', 'btn small ghost', 'Remover');
        rm.onclick = () => { S.bg = ''; save(); applyAppearance(); renderSettings(); };
        btns.append(rm);
      }
      bgBox.append(prev, btns);
      body.append(bgBox);
      if (S.bg) {
        body.append(row('Desfoque', null, slider('bgBlur', 0, 30, ' px')));
        body.append(row('Escurecer', 'Deixa o texto legível em cima da foto', slider('bgDim', 0, 90, '%')));
        body.append(row('Efeito de vidro', 'Painéis transparentes por cima da foto', toggle('glass')));
      }

      body.append(el('h3', null, 'Interface'));
      body.append(row('Animações', 'Transições e efeitos', toggle('animations')));
      body.append(row('Sons', 'Quando alguém entra, sai ou manda mensagem', toggle('sounds', () => play('join'))));
      if (S.sounds) body.append(row('Volume dos sons', null, slider('volume', 0, 100, '%')));
      body.append(row('Reações', 'Emojis flutuando na tela', toggle('reactions')));
    }

    if (tab === 'transmissao') {
      body.append(el('h3', null, 'Padrões'));
      body.append(row('Qualidade', null, storeSelect('telinha.quality', [['high', 'Alta · 1080p'], ['medium', 'Média · 720p'], ['low', 'Leve · 540p']], 'medium')));
      body.append(row('Conteúdo', '60 fps em "Jogos e vídeos"', storeSelect('telinha.kind', [['detail', 'Programas e texto (30 fps, nítido)'], ['motion', 'Jogos e vídeos (60 fps, fluido)']], 'detail')));

      body.append(el('h3', null, 'Codificação do vídeo'));
      const rec = gpu && gpu.encoder ? `Recomendado: H.264 (${gpu.encoder})` : 'Recomendado: VP8 (processador)';
      body.append(row('Codec', rec, select('codec', [
        ['auto', 'Automático (pela sua placa)'],
        ['h264', 'H.264 — placa de vídeo (NVENC / AMF / Quick Sync)'],
        ['vp9', 'VP9 — melhor qualidade, mais pesado'],
        ['vp8', 'VP8 — processador, mais compatível'],
      ])));

      body.append(el('h3', null, 'Captura da tela'));
      body.append(row('Método', 'Use "Automático", a não ser que algo dê errado', select('capture', [
        ['auto', 'Automático (tenta tudo e escolhe)'],
        ['chromium', 'Windows padrão (o mesmo do Chrome)'],
        ['dxgi', 'Nativo · DXGI (placa de vídeo, até 60 fps)'],
        ['gdi', 'Nativo · GDI (compatível, até 30 fps)'],
      ])));

      body.append(el('h3', null, 'Assistindo'));
      body.append(row('Janelinha flutuante ao minimizar', 'Minimizou o Telinha assistindo alguém? A tela dele fica numa janela pequena por cima de tudo', toggle('pipOnMinimize')));
      body.append(el('h3', null, 'Discord'));
      const dsync = () => window.__telinhaDiscordSync && window.__telinhaDiscordSync();
      body.append(row('Mostrar no status do Discord', 'Seus amigos veem "Telinha · numa sala" no seu perfil (o Discord precisa estar aberto)', toggle('discordStatus', dsync)));
      body.append(row('Botão "Entrar na sala"', 'Quem vê seu perfil pode entrar na sala com um clique', toggle('discordJoin', dsync)));
      body.append(el('h3', null, 'Controle remoto'));
      body.append(row('Deixar pedirem controle', 'Quem assiste pode pedir pra mexer no seu PC. Você sempre decide se aceita', toggle('remoteAllow')));
    }

    if (tab === 'sistema') {
      body.append(el('h3', null, 'Sua placa de vídeo'));
      const card = el('div', 'gpu-card');
      const vendor = gpu && gpu.main ? gpu.main.vendor : '';
      const badge = el('div', 'gpu-badge ' + (vendor || 'none').toLowerCase(), vendor || '?');
      const info = el('div', 'gpu-info');
      info.append(el('strong', null, gpu ? gpuLabel() : 'Detectando…'));
      info.append(el('span', 'muted', gpu ? `Codificador: ${encoderLabel()}` : ''));
      if (gpu && gpu.main && gpu.main.driver) info.append(el('span', 'muted', `Driver ${gpu.main.driver}`));
      card.append(badge, info);
      body.append(card);
      let last = '';
      try { last = localStorage.getItem('telinha.lastEncoder') || ''; } catch { /* */ }
      body.append(row('Último codificador usado', 'Aparece depois de transmitir pra alguém', el('span', 'mono', last || '—')));
      if (gpu && gpu.devices && gpu.devices.length > 1) {
        body.append(row('Outras placas', null, el('span', 'muted', gpu.devices.filter((d) => d !== gpu.main && d.vendor !== 'Microsoft').map((d) => d.name || d.vendor).join(', ') || '—')));
      }

      body.append(el('h3', null, 'Janela'));
      body.append(row('Fechar vai pra bandeja', 'O Telinha continua aberto perto do relógio (e na sala)', toggle('closeToTray')));
      body.append(row('Abertura animada', null, toggle('splash')));

      body.append(el('h3', null, 'Ferramentas'));
      const tools = el('div', 'tool-row');
      if (api && api.startDiag) {
        const d = el('button', 'btn small', 'Testar captura');
        d.onclick = () => api.startDiag(null);
        tools.append(d);
      }
      if (api && api.openLogFolder) {
        const l = el('button', 'btn small', 'Abrir pasta do log');
        l.onclick = () => api.openLogFolder();
        tools.append(l);
      }
      body.append(tools);

      body.append(el('h3', null, 'Backup das configurações'));
      body.append(el('p', 'muted set-note', 'Tema, cores, fundo, sons e padrões são salvos sozinhos em Documentos\\Telinha\\configuracoes.json. Se o Telinha perder as configurações, ele restaura desse arquivo.'));
      const bk = el('div', 'tool-row');
      if (api && api.settingsExport) {
        const ex = el('button', 'btn small primary', 'Exportar…');
        ex.onclick = async () => { if (await api.settingsExport(snapshot())) toast('Configurações exportadas!'); };
        const im = el('button', 'btn small', 'Importar…');
        im.onclick = async () => {
          const r = await api.settingsImport();
          if (!r) return;
          if (r.erro) { toast('Não deu pra importar: ' + r.erro, 'error'); return; }
          if (!applyBackup(r.text)) toast('Arquivo inválido.', 'error');
        };
        bk.append(ex, im);
      }
      body.append(bk);

      body.append(el('h3', null, 'Recomeçar'));
      const tools2 = el('div', 'tool-row');
      const reset = el('button', 'btn small ghost', 'Restaurar configurações');
      reset.onclick = () => { S = { ...DEFAULTS }; save(); applyAppearance(); renderSettings(); toast('Configurações voltaram ao padrão.'); };
      tools2.append(reset);
      body.append(tools2);
    }
  }

  let appInfo = null;
  function hideSplash() {
    const sp = $('#splash');
    if (!sp) return;
    sp.classList.add('out');
    setTimeout(() => sp.remove(), 600);
  }

  function init() {
    applyAppearance();
    if (!S.splash || !S.animations) hideSplash();
    else setTimeout(hideSplash, 1400);
    if (api && api.appInfo) api.appInfo().then((i) => { appInfo = i; });
    if (api && api.setCloseToTray) api.setCloseToTray(S.closeToTray);
    // Sem configurações salvas no app (versão nova, cache limpo...)? Restaura do backup.
    if (api && api.settingsLoad) {
      if (lsGet(KEY) == null) {
        api.settingsLoad().then((t) => {
          if (t && applyBackup(t, true)) toast('Suas configurações foram restauradas do backup.');
        });
      } else {
        backupSoon();
      }
      // Nome, qualidade etc. mudam fora desta tela: confere de tempos em tempos.
      setInterval(backupSoon, 5000);
      window.addEventListener('beforeunload', () => { if (api.settingsSave) api.settingsSave(snapshot()); });
    }
    document.querySelectorAll('.set-tab').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; renderSettings(); }; });
    $('#settings-close').onclick = closeSettings;
    $('#settings').addEventListener('mousedown', (e) => { if (e.target.id === 'settings') closeSettings(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#settings').classList.contains('hidden')) closeSettings(); });
    document.querySelectorAll('[data-open-settings]').forEach((b) => { b.onclick = () => openSettings(); });
    loadGpu().then((g) => {
      const chip = $('#gpu-chip');
      if (chip && g) {
        chip.textContent = g.encoder ? `${g.main.vendor} · ${g.encoder}` : (g.main ? `${g.main.vendor} · processador` : 'sem placa detectada');
        chip.title = gpuLabel();
        chip.hidden = false;
      }
    });
  }

  function profile() {
    const av = S.avatarType === 'emoji' ? { t: 'emoji', v: S.avatarEmoji }
      : S.avatarType === 'photo' && S.avatarPhoto ? { t: 'photo', v: S.avatarPhoto } : { t: 'initial', v: '' };
    return { av, col: S.nameColor || '' };
  }
  function profileChanged() { document.dispatchEvent(new CustomEvent('telinha-profile')); }

  window.TelinhaSettings = {
    profile,
    changelog: () => CHANGELOG,
    get: (k) => S[k],
    codec: codecChoice,
    capture: () => S.capture,
    reactions: () => !!S.reactions,
    mic: () => ({ mode: S.micMode, device: S.micDevice, pttKey: S.pttKey, vad: S.vadLevel, volume: S.voiceVolume, noise: S.micNoise !== false }),
    keyName,
    play,
    open: openSettings,
    avatarEl,
    gpu: () => gpu,
    init,
  };
  document.addEventListener('DOMContentLoaded', init);
})();
