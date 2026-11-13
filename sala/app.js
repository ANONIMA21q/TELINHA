// Telinha — interface, salas e transmissão (WebRTC via PeerJS).
//
// Como funciona:
//  - Quem cria a sala vira o "dono", com o ID  telinha-v1-<CÓDIGO>.
//  - Quem entra se conecta no dono, recebe a lista de quem já está lá e se
//    conecta em cada um (malha: todo mundo ligado a todo mundo).
//  - Quem compartilha a tela "liga" (media call) pra cada pessoa da sala.
//    O vídeo vai direto de PC pra PC; o servidor só serve pra se acharem.
'use strict';
(() => {
  const PREFIX = 'telinha-v1-';
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I
  const QUALITY = {
    high:   { w: 1920, h: 1080, detail: 3_000_000, motion: 6_000_000 },
    medium: { w: 1280, h: 720,  detail: 1_800_000, motion: 3_500_000 },
    low:    { w: 960,  h: 540,  detail: 1_000_000, motion: 2_000_000 },
  };

  // ?server=localhost&port=9000 aponta para um servidor PeerJS próprio (usado nos testes).
  const qs = new URLSearchParams(location.search);
  const PEER_OPTS = qs.get('server')
    ? { host: qs.get('server'), port: Number(qs.get('port')) || 9000, path: '/', secure: false }
    : {};
  const api = window.telinha || null;
  // Versão web (página no GitHub Pages): só assiste, sem instalar. O <html data-web="1"> marca.
  const WEB = !api && document.documentElement.dataset.web === '1';
  let APP_VER = WEB ? 'web' : '';
  if (api && api.appInfo) api.appInfo().then((i) => { APP_VER = (i && i.version) || ''; }).catch(() => {});

  // Servidores STUN/TURN (vêm do processo principal; o TURN repassa o vídeo quando a
  // internet de alguém não deixa a ligação direta). relay = força passar pelo TURN.
  let iceCache = null;
  async function peerOpts(relay) {
    const opts = { ...PEER_OPTS };
    try {
      if (api && api.iceServers && !qs.get('server')) iceCache = await api.iceServers();
    } catch { /* fica com o padrão do PeerJS */ }
    if (!api && Array.isArray(window.TELINHA_WEB_ICE) && !qs.get('server')) iceCache = window.TELINHA_WEB_ICE;
    if (iceCache && iceCache.length) {
      opts.config = { iceServers: iceCache, iceCandidatePoolSize: 2, iceTransportPolicy: relay ? 'relay' : 'all' };
    }
    return opts;
  }

  // Log: vai pro console e, no app, pro arquivo Documentos\Telinha\telinha-log.txt
  const short = (id) => (id ? String(id).replace(PREFIX, '').slice(-8) : '?');
  function log(...parts) {
    const line = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
    console.log('[telinha]', line);
    if (api && api.log) api.log(line);
  }
  window.addEventListener('error', (e) => log('ERRO JS:', e.message, e.filename + ':' + e.lineno));
  window.addEventListener('unhandledrejection', (e) => log('ERRO (promise):', String(e.reason && (e.reason.stack || e.reason))));

  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const ICON = {
    vol: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m23 9-6 6M17 9l6 6"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    screen: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    rec: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    cinema: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 5v14M17 5v14M2 9.5h5M17 9.5h5M2 14.5h5M17 14.5h5"/></svg>',
    mouse: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="11" width="8" height="7" rx="1" fill="currentColor" stroke="none"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3.1 4.1M6.6 6.6C4.4 8 2.8 10.1 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/></svg>',
  };

  const S = {
    name: '', code: '', hostId: '', isHost: false, peer: null, leaving: false,
    owner: '',            // id de quem manda na sala (expulsar, mutar, passar o dono)
    password: '',         // senha da sala (só o criador guarda e confere)
    admitted: new Set(),  // ids que o criador deixou entrar (os outros recusam quem não estiver aqui)
    banned: new Set(),    // ids de cliente expulsos (o criador recusa na porta)
    members: new Map(),   // id -> { id, name, conn, sharing }
    stream: null, shareOpts: null,
    outCalls: new Map(),  // id -> MediaConnection (eu → ele)
    inCalls: new Map(),   // id -> MediaConnection (ele → eu)
  };
  window.__telinha = S; // para depuração
  const VPN = { state: 'indisponivel', address: '', net: null }; // net = { nwid, owner }

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  };
  // id fixo deste PC (pra expulsão valer mesmo se a pessoa entrar de novo)
  const CLIENT_ID = store.get('telinha.cid') || (() => {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
    store.set('telinha.cid', id);
    return id;
  })();
  const myId = () => (S.peer ? S.peer.id : '');
  const iAmOwner = () => !!S.peer && S.owner === S.peer.id;

  // ---------------------------------------------------------------- utilidades
  function randCode(n) {
    const a = new Uint32Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, (x) => ALPHABET[x % ALPHABET.length]).join('');
  }
  // Código normal: 6 letras (K7P-2QX). Código com VPN: 12 letras (ABCD-EFGH-JKLM) que guardam
  // o ID da rede ZeroTier da sala (10 hex do PC dono + 5 hex aleatórios = 60 bits).
  const fmtCode = (c) => (c.length > 6 ? c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8) : c.slice(0, 3) + '-' + c.slice(3));
  const normCode = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const validCode = (c) => (c.length === 6 || c.length === 12) && [...c].every((ch) => ALPHABET.includes(ch));
  function nwidToCode(nwid) {
    const node = BigInt('0x' + nwid.slice(0, 10));
    const suf = BigInt('0x' + nwid.slice(10)) & 0xfffffn;
    let v = (node << 20n) | suf;
    let out = '';
    for (let i = 0; i < 12; i++) { out = ALPHABET[Number(v & 31n)] + out; v >>= 5n; }
    return out;
  }
  function codeToNwid(code) {
    if (code.length !== 12) return '';
    let v = 0n;
    for (const ch of code) { const i = ALPHABET.indexOf(ch); if (i < 0) return ''; v = (v << 5n) | BigInt(i); }
    return (v >> 20n).toString(16).padStart(10, '0') + (v & 0xfffffn).toString(16).padStart(6, '0');
  }
  window.__telinhaCode = { nwidToCode, codeToNwid };

  function colorFor(text) {
    let h = 0;
    for (const ch of text || '?') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360} 70% 68%)`;
  }

  window.__telinhaToast = (t, k) => toast(t, k);
  const SET = window.TelinhaSettings || { codec: () => 'h264', capture: () => 'auto', reactions: () => true, play: () => {}, profile: () => ({ av: { t: 'initial' }, col: '' }), avatarEl: null };
  // Perfil vindo de outra pessoa: só aceita formatos esperados.
  function cleanProfile(p) {
    const out = { av: { t: 'initial', v: '' }, col: '' };
    if (!p || typeof p !== 'object') return out;
    const av = p.av || {};
    if (av.t === 'emoji' && typeof av.v === 'string' && av.v.length <= 8) out.av = { t: 'emoji', v: av.v };
    if (av.t === 'photo' && typeof av.v === 'string' && av.v.length < 40000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(av.v)) out.av = { t: 'photo', v: av.v };
    if (typeof p.col === 'string' && /^#[0-9a-f]{6}$/i.test(p.col)) out.col = p.col;
    return out;
  }
  function toastAction(text, label, fn) {
    const t = el('div', 'toast info with-action');
    t.append(el('span', null, text));
    const b = el('button', 'btn small', label);
    b.onclick = () => { fn(); t.remove(); };
    t.append(b);
    $('#toasts').append(t);
    setTimeout(() => t.classList.add('out'), 7500);
    setTimeout(() => t.remove(), 8000);
  }
  function toast(text, kind = 'info') {
    const t = el('div', 'toast ' + kind, text);
    $('#toasts').append(t);
    setTimeout(() => t.classList.add('out'), 4500);
    setTimeout(() => t.remove(), 5000);
  }

  function errText(err) {
    switch (err && err.type) {
      case 'network': case 'server-error': case 'socket-error': case 'socket-closed':
        return 'Sem conexão com o servidor de salas. Confere sua internet e tenta de novo.';
      case 'browser-incompatible':
        return 'Este computador não suporta WebRTC.';
      case 'peer-unavailable':
        return 'Sala não encontrada. Confere o código.';
      default:
        return 'Algo deu errado: ' + ((err && (err.message || err.type)) || 'erro desconhecido');
    }
  }

  // ------------------------------------------------------------------ telas
  function showView(v) {
    $('#lobby').classList.toggle('hidden', v !== 'lobby');
    $('#room').classList.toggle('hidden', v !== 'room');
  }
  const lobbyMsg = (t) => { $('#lobby-msg').textContent = t || ''; };
  function setBusy(b) { $('#create').disabled = b; $('#join').disabled = b; }

  function takeName() {
    const name = $('#name').value.trim();
    if (!name) { lobbyMsg('Coloca seu nome primeiro.'); $('#name').focus(); return false; }
    S.name = name.slice(0, 24);
    store.set('telinha.name', S.name);
    return true;
  }

  // ------------------------------------------------------------ PeerJS base
  async function openPeer(id, relay) {
    const opts = await peerOpts(relay);
    return new Promise((resolve, reject) => {
      const peer = new Peer(id, opts);
      const onError = (err) => { peer.off('open', onOpen); peer.destroy(); reject(err); };
      const onOpen = () => { peer.off('error', onError); resolve(peer); };
      peer.once('open', onOpen);
      peer.once('error', onError);
    });
  }

  function attachPeer(peer) {
    S.peer = peer;
    log(`entrou no servidor de salas como ${peer.id} (sala ${S.code || '?'})`);
    peer.on('connection', setupConn);
    peer.on('call', onCall);
    peer.on('error', (err) => {
      log('erro do peer:', err.type, err.message);
      if (err.type === 'peer-unavailable') return; // alguém que já saiu
      if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        toast('A conexão com o servidor de salas oscilou. Quem já está na sala continua conectado.', 'warn');
      } else {
        console.warn('erro do peer', err);
      }
    });
    peer.on('disconnected', () => {
      if (S.leaving || peer.destroyed) return;
      log('caiu a conexão com o servidor de salas, reconectando…');
      setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect(); }, 2000);
    });
  }

  // ------------------------------------------------------- criar / entrar
  async function createRoom(fixedCode) {
    if (!takeName()) return;
    setBusy(true);
    lobbyMsg(fixedCode ? 'Recriando a sua sala…' : 'Criando sala…');
    // VPN: cria a rede ZeroTier da sala (ou recria a mesma, se a sala é minha)
    let vpnCode = '';
    if (VPN.state === 'ok' && api && api.ztCreate) {
      const want = fixedCode && fixedCode.length === 12 ? codeToNwid(fixedCode) : '';
      if (!fixedCode || (want && want.startsWith(VPN.address))) {
        lobbyMsg('Criando a rede da sala…');
        const r = await api.ztCreate(want || null).catch(() => null);
        if (r && r.nwid) {
          VPN.net = { nwid: r.nwid, owner: true }; VPN.ip = r.ip || '';
          vpnCode = nwidToCode(r.nwid);
          if (!r.ok) log('rede da sala criada, mas sem IP ainda:', r.status);
        } else log('não deu pra criar a rede da sala; seguindo sem VPN', r && r.state);
      }
    }
    const tries = fixedCode ? 12 : 4;
    for (let i = 0; i < tries; i++) {
      const code = fixedCode || vpnCode || randCode(6);
      try {
        const peer = await openPeer(PREFIX + code);
        Object.assign(S, { code, isHost: true, hostId: PREFIX + code, owner: PREFIX + code, password: ($('#room-pass').value || '').trim().slice(0, 40) });
        attachPeer(peer);
        enterRoom();
        return;
      } catch (err) {
        if (err.type === 'unavailable-id' && vpnCode && !fixedCode) vpnCode = ''; // muito raro: tenta um código normal
        if (err.type !== 'unavailable-id') { vpnLeave(); lobbyMsg(errText(err)); setBusy(false); return; }
        // O servidor ainda lembra da sala antiga por alguns segundos: espera e tenta de novo.
        if (fixedCode) await new Promise((r) => setTimeout(r, 2500));
      }
    }
    vpnLeave();
    lobbyMsg(fixedCode ? 'Não deu pra recriar a mesma sala. Cria uma nova.' : 'Não deu pra criar a sala agora. Tenta de novo.');
    setBusy(false);
  }

  // ------------------------------------------------------- VPN da sala (ZeroTier)
  function vpnLeave() {
    const n = VPN.net;
    VPN.net = null;
    if (n && api && api.ztLeave) api.ztLeave(n.nwid).catch(() => {});
  }
  async function vpnJoinFor(code) {
    const nwid = codeToNwid(code);
    if (!nwid) return;
    if (VPN.state !== 'ok' || !api || !api.ztJoin) {
      log('sala com VPN, mas o ZeroTier não está ativo aqui; tentando sem VPN');
      showVpnWarn('Essa sala usa a VPN do Telinha. Ative a VPN pra conectar mais fácil.');
      return;
    }
    if (nwid.startsWith(VPN.address)) return; // a rede é minha (sala antiga minha)
    lobbyMsg('Entrando na rede da sala…');
    const r = await api.ztJoin(nwid).catch(() => null);
    VPN.net = { nwid, owner: false }; VPN.ip = (r && r.ip) || '';
    log(r && r.ok ? `na rede da sala: ${r.ip}` : `rede da sala não respondeu (${r ? r.status : 'erro'}); tentando assim mesmo`);
  }
  function showVpnWarn(text) {
    const box = $('#vpn-warn');
    if (!box || !api || !api.ztSetup) return;
    box.querySelector('.net-warn-text').textContent = text;
    box.classList.remove('hidden');
  }
  async function setupVpn() {
    const box = $('#vpn-warn');
    const btn = box && box.querySelector('button');
    if (btn) { btn.disabled = true; btn.textContent = 'Instalando… (aceite a permissão do Windows)'; }
    const st = await api.ztSetup().catch(() => null);
    if (st) { VPN.state = st.state; VPN.address = st.address || ''; }
    if (VPN.state === 'ok') { box.classList.add('hidden'); toast('VPN do Telinha ativada! Agora é só criar a sala e mandar o código.'); }
    else toast('Não deu pra ativar a VPN. Clica em "Sim" quando o Windows perguntar e tenta de novo.', 'warn');
    if (btn) { btn.disabled = false; btn.textContent = 'Ativar VPN'; }
  }
  async function checkVpnOnStart() {
    if (!api || !api.ztStatus) return;
    const st = await api.ztStatus().catch(() => null);
    if (!st) return;
    VPN.state = st.state; VPN.address = st.address || '';
    if (api.platform !== 'win32') return;
    if (st.state === 'sem-zerotier' || st.state === 'sem-permissao') showVpnWarn('A VPN do Telinha (ZeroTier) não está ativa. Ela faz os amigos conectarem mesmo com internet travada.');
    else if (st.state === 'desligado') showVpnWarn('O ZeroTier está desligado. Ative pra usar a VPN do Telinha.');
  }

  // ---------------------------------------------------------------- atualização automática
  // Ao abrir, procura versão nova no GitHub.
  // Leve (só o código): baixa sozinha em segundo plano e avisa "vale quando reabrir".
  // Completa (quando o motor muda): mostra a faixa azul com "Atualizar agora".
  const UPD = { info: null, busy: false };
  function updBox(text, label, fn) {
    const box = $('#upd-warn');
    if (!box) return null;
    box.querySelector('.net-warn-text').textContent = text;
    const btn = box.querySelector('button');
    btn.textContent = label; btn.disabled = false; btn.onclick = fn;
    box.classList.remove('hidden');
    return btn;
  }
  function showUpdate(info) {
    UPD.info = info;
    if (info.kind === 'lite' && info.ready) {
      updBox(`A versão ${info.version} do Telinha já foi baixada. Vale quando você reabrir o Telinha.`, 'Reiniciar agora', restartUpdate);
      return;
    }
    if (info.kind === 'lite') { installUpdate(true); return; }
    updBox(`Versão nova do Telinha: ${info.version}${info.size ? ` (${Math.round(info.size / 1048576)} MB)` : ''}. Atualiza em 1 clique, suas configurações ficam.`, 'Atualizar agora', () => installUpdate(false));
  }
  async function restartUpdate() {
    if (S.peer && !(await confirmBox('Reiniciar agora?', 'O Telinha fecha e abre de novo já atualizado. Você sai da sala, depois é só entrar de novo.', 'Reiniciar'))) return;
    api.updateRestart();
  }
  async function installUpdate(quiet) {
    if (UPD.busy || !UPD.info) return;
    const lite = UPD.info.kind === 'lite';
    if (!lite && S.peer && !(await confirmBox('Atualizar agora?', 'O Telinha vai fechar pra instalar e você sai da sala. Depois é só entrar de novo.', 'Atualizar'))) return;
    UPD.busy = true;
    const btn = lite ? null : $('#upd-warn button');
    if (btn) { btn.disabled = true; btn.textContent = 'Baixando… 0%'; }
    api.onUpdateProgress((pct) => { if (btn) btn.textContent = `Baixando… ${pct}%`; });
    const r = await api.updateInstall().catch((e) => ({ error: e.message }));
    UPD.busy = false;
    if (r && r.ok && r.kind === 'lite') {
      UPD.info.ready = true;
      showUpdate(UPD.info);
      toast(`Atualização ${UPD.info.version} baixada. Vale quando você reabrir o Telinha.`);
      return;
    }
    if (r && r.ok) { if (btn) btn.textContent = 'Instalando… o Telinha abre sozinho'; return; }
    if (lite && quiet) {
      // a leve falhou: oferece a completa pelo botão
      UPD.info.kind = 'full-retry';
      updBox(`Versão nova do Telinha: ${UPD.info.version}. Não deu pra baixar sozinho${r && r.error ? ` (${r.error})` : ''}.`, 'Tentar de novo', () => { UPD.info.kind = 'lite'; installUpdate(false); });
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Tentar de novo'; }
    toast('Não deu pra baixar a atualização' + (r && r.error ? ` (${r.error})` : '') + '.', 'warn');
  }
  async function checkUpdate(manual) {
    if (!api || !api.updateCheck) return null;
    const r = await api.updateCheck().catch((e) => ({ error: e.message }));
    if (r && r.version) { showUpdate(r); return r; }
    if (manual) toast(r && r.error ? 'Não deu pra procurar atualização agora. Confere a internet.' : 'Você já está na versão mais nova.', r && r.error ? 'warn' : 'info');
    return r;
  }
  window.__telinhaUpdate = { check: checkUpdate, install: installUpdate, state: UPD };

  // ---------------------------------------------------------------- novidades
  // Na primeira abertura depois de atualizar, mostra o que mudou desde a versão anterior.
  function verNum(v) { const p = String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0); return (p[0] || 0) * 1e6 + (p[1] || 0) * 1e3 + (p[2] || 0); }
  async function showWhatsNew(force) {
    const info = api && api.appInfo ? await api.appInfo().catch(() => null) : null;
    const cur = info ? info.version : '';
    if (!cur) return false;
    const last = store.get('telinha.lastVer');
    store.set('telinha.lastVer', cur);
    // a 4.0 não guardava a versão: se já tem nome salvo, é atualização, não instalação nova
    const prev = last || (store.get('telinha.name') ? '4.0.0' : '');
    if (!force && (!prev || verNum(cur) <= verNum(prev))) return false;
    if (!force && new URLSearchParams(location.search).get('server') && !new URLSearchParams(location.search).get('news')) return false; // testes automáticos
    const log = (window.TelinhaSettings && window.TelinhaSettings.changelog) ? window.TelinhaSettings.changelog() : [];
    let items = log.filter(([v]) => verNum(v) > verNum(prev) && verNum(v) <= verNum(cur));
    if (force || !items.length) items = log.slice(0, 1);
    if (!items.length) return false;
    const wrap = el('div', 'modal whatsnew');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    const card = el('div', 'modal-card whatsnew-card');
    const head = el('div', 'whatsnew-head');
    head.append(el('span', 'whatsnew-tag', 'Atualizado'), el('h2', null, `Novidades da versão ${cur.replace(/\.0$/, '')}`));
    card.append(head);
    const list = el('div', 'whatsnew-list');
    for (const [v, txt, bullets] of items) {
      if (items.length > 1) list.append(el('div', 'whatsnew-ver', 'Versão ' + v));
      if (bullets && bullets.length) {
        for (const [ico, title, desc] of bullets) {
          const r = el('div', 'whatsnew-item');
          const t = el('div');
          t.append(el('strong', null, title), el('span', 'muted', desc));
          r.append(el('span', 'whatsnew-ico', ico), t);
          list.append(r);
        }
      } else list.append(el('p', 'muted', txt));
    }
    card.append(list);
    const actions = el('div', 'modal-actions');
    const ok = el('button', 'btn primary', 'Bora!');
    actions.append(ok);
    card.append(actions);
    wrap.append(card);
    document.body.append(wrap);
    const close = () => wrap.remove();
    ok.onclick = close;
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    ok.focus();
    return true;
  }
  window.__telinhaWhatsNew = showWhatsNew;

  // Uma tentativa de entrar: abre um peer e liga no dono. Devolve 'ok' | 'notfound' | 'timeout' | 'icefail'.
  async function tryJoin(code, relay, waitMs) {
    let peer;
    try {
      peer = await openPeer(PREFIX + code + '-' + randCode(8).toLowerCase(), relay);
    } catch (err) {
      return { result: 'server', err };
    }
    Object.assign(S, { code, isHost: false, hostId: PREFIX + code, owner: PREFIX + code });
    attachPeer(peer);
    let denyWhy = '';
    const result = await new Promise((resolve) => {
      const conn = connectTo(S.hostId);
      const done = (r) => {
        clearTimeout(timer); peer.off('error', onErr); conn.off('open', onOpen); conn.off('data', onMsg); resolve(r);
      };
      const onErr = (err) => { if (err.type === 'peer-unavailable') done('notfound'); };
      // conectou: espera o criador responder (welcome = pode entrar, deny = senha errada / expulso)
      // (todo Telinha manda o welcome assim que abre; se fechar antes dele, foi recusado)
      const onOpen = () => { conn.once('close', () => { denyWhy = denyWhy || 'senha'; done('deny'); }); };
      const onMsg = (msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'welcome') done('ok');
        else if (msg.t === 'deny') { denyWhy = String(msg.why || ''); done('deny'); }
      };
      conn.on('data', onMsg);
      // ICE = a negociação do caminho entre os dois PCs; 'failed' = não achou caminho nenhum
      conn.on('iceStateChanged', (st) => {
        log(`entrando (${relay ? 'só TURN' : 'normal'}): ice=${st}`);
        if (st === 'failed') done('icefail');
      });
      const timer = setTimeout(() => done('timeout'), waitMs);
      peer.on('error', onErr);
      conn.on('open', onOpen);
    });
    if (result !== 'ok') {
      S.leaving = true;
      peer.destroy();
      resetState();
    }
    return { result, why: denyWhy };
  }

  // Teste da própria internet: quais caminhos o WebRTC consegue montar daqui.
  //  host = rede local · srflx = internet direta (STUN) · relay = repasse (TURN)
  async function netTest() {
    const out = { host: false, srflx: false, relay: false };
    let pc;
    try {
      const opts = await peerOpts(false);
      pc = new RTCPeerConnection({ iceServers: (opts.config && opts.config.iceServers) || [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('teste');
      await new Promise(async (resolve) => {
        const t = setTimeout(resolve, 6000);
        pc.onicecandidate = (e) => {
          if (!e.candidate) { clearTimeout(t); resolve(); return; }
          const m = / typ (host|srflx|prflx|relay)/.exec(e.candidate.candidate);
          if (m) out[m[1] === 'prflx' ? 'srflx' : m[1]] = true;
        };
        await pc.setLocalDescription(await pc.createOffer());
      });
    } catch (e) { log('teste de rede falhou:', String(e)); }
    try { pc && pc.close(); } catch { /* */ }
    log('teste de rede:', out);
    return out;
  }

  async function explainFailure() {
    lobbyMsg('Não conectou. Testando a sua internet…');
    const [net, fw] = await Promise.all([
      netTest(),
      api && api.firewallStatus ? api.firewallStatus().catch(() => null) : Promise.resolve(null),
    ]);
    const tips = [];
    if (fw && (fw.state === 'bloqueado' || fw.state === 'sem-regra')) {
      tips.push(fw.state === 'bloqueado' ? 'o Firewall do Windows está BLOQUEANDO o Telinha neste PC' : 'o Telinha não está liberado no Firewall deste PC');
      showFirewallWarn(fw.state);
    }
    if (!net.srflx && !net.relay) tips.push('a sua internet (ou um antivírus) está bloqueando a conexão de vídeo; teste em outra rede, tipo o 4G do celular');
    else if (!net.relay) tips.push('o servidor de repasse (TURN) não respondeu daqui; tenta de novo em alguns minutos');
    if (!tips.length) tips.push('do seu lado está tudo certo, então o problema deve estar no PC do seu amigo: ele precisa atualizar o Telinha e clicar em "Liberar no Firewall"');
    lobbyMsg('Não consegui conectar na sala. ' + tips.map((t) => t[0].toUpperCase() + t.slice(1)).join('. ') + '.');
  }

  async function joinRoom(recreateIfGone) {
    if (!takeName()) return;
    if (typeof recreateIfGone !== 'string') recreateIfGone = null;
    const code = normCode($('#code').value);
    if (!validCode(code)) { lobbyMsg('Confere o código: ele tem 6 ou 12 letras/números, tipo K7P-2QX.'); $('#code').focus(); return; }
    setBusy(true);
    if (code.length === 12) await vpnJoinFor(code);
    lobbyMsg('Entrando…');

    // 1ª tentativa: caminho normal (direto quando dá, TURN quando precisa)
    let r = await tryJoin(code, false, 20000);
    // 2ª tentativa: tudo pelo servidor de repasse (resolve CGNAT, 4G, rede que bloqueia UDP)
    if (r.result === 'timeout' || r.result === 'icefail') {
      log(`primeira tentativa: ${r.result}; tentando de novo só pelo TURN`);
      lobbyMsg('Demorou… tentando de novo por outro caminho (servidor de repasse).');
      await new Promise((res) => setTimeout(res, 400));
      r = await tryJoin(code, true, 25000);
    }
    if (r.result === 'ok') { enterRoom(); return; }
    vpnLeave();
    if (r.result === 'deny') {
      if (r.why === 'senha') {
        lobbyMsg(($('#room-pass').value ? 'Senha errada.' : 'Essa sala tem senha.') + ' Coloca a senha no campo "Senha da sala" e tenta de novo.');
        $('#room-pass').focus();
      } else lobbyMsg('Você foi removido dessa sala pelo dono e não pode entrar de novo.');
      setBusy(false);
      return;
    }
    if (r.result === 'server') { lobbyMsg(errText(r.err)); setBusy(false); return; }
    if (r.result === 'notfound') {
      if (recreateIfGone) { setBusy(false); createRoom(recreateIfGone); return; }
      lobbyMsg('Sala não encontrada. Confere o código (e se o dono ainda está nela).');
      setBusy(false);
      return;
    }
    log(`não conectou na sala ${code}: ${r.result}`);
    await explainFailure();
    setBusy(false);
  }

  // ------------------------------------------------------- aviso do firewall
  function showFirewallWarn(state) {
    const box = $('#net-warn');
    if (!box || !api || !api.firewallFix) return;
    box.querySelector('.net-warn-text').textContent = state === 'bloqueado'
      ? 'O Firewall do Windows está bloqueando o Telinha. Amigos podem não conseguir entrar.'
      : 'O Telinha ainda não está liberado no Firewall do Windows.';
    box.classList.remove('hidden');
  }
  async function fixFirewall() {
    const box = $('#net-warn');
    const btn = box && box.querySelector('button');
    if (btn) { btn.disabled = true; btn.textContent = 'Aguardando permissão…'; }
    const st = await api.firewallFix().catch(() => null);
    if (st && st.state === 'ok') {
      box.classList.add('hidden');
      toast('Telinha liberado no Firewall do Windows.');
    } else {
      toast('Não deu pra liberar no Firewall. Clica em "Sim" quando o Windows perguntar.', 'warn');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Liberar no Firewall'; }
  }
  async function checkFirewallOnStart() {
    if (!api || !api.firewallStatus || api.platform !== 'win32') return;
    const st = await api.firewallStatus().catch(() => null);
    if (st && (st.state === 'bloqueado' || st.state === 'sem-regra')) showFirewallWarn(st.state);
  }

  function enterRoom() {
    $('#room-code').textContent = fmtCode(S.code);
    setBusy(false);
    lobbyMsg('');
    showView('room');
    renderMembers();
    renderStage();
    updateShareBtn();
    addSystem(S.isHost ? 'Sala criada. Clica no código lá em cima pra copiar o convite e manda pros amigos!' : 'Você entrou na sala.');
    S.since = Date.now();
    syncTray();
  }

  // ------------------------------------------------------------ convite
  // link https: vira clicável no Discord e no WhatsApp; a página abre o Telinha ou assiste pelo navegador
  const inviteLink = () => `https://anonima21q.github.io/TELINHA/?s=${S.code}`;
  async function copyInvite() {
    if (!S.code) return;
    const text = `Bora no Telinha! Entra na minha sala: ${inviteLink()}  (ou digita o código ${fmtCode(S.code)})`;
    try {
      if (api) await api.copy(text); else await navigator.clipboard.writeText(text);
      toast(`Convite copiado! É só colar pros amigos. Código: ${fmtCode(S.code)}`);
    } catch { toast(`O código é ${fmtCode(S.code)}`); }
  }
  function openLink(code) {
    code = normCode(code || '');
    if (!validCode(code)) return;
    if (S.peer && S.code === code) return;
    if (S.peer) { toast(`Convite pra sala ${fmtCode(code)} — saia desta sala pra entrar nela.`, 'warn'); return; }
    $('#code').value = fmtCode(code);
    if (!$('#name').value.trim()) { lobbyMsg('Coloca seu nome e clica em Entrar.'); $('#name').focus(); return; }
    joinRoom();
  }

  // ------------------------------------------------------------ bandeja
  function syncTray() {
    if (api && api.setTrayState) api.setTrayState({ room: S.code ? fmtCode(S.code) : '', sharing: !!S.stream });
    syncDiscord();
  }
  // Status no Discord: manda só quando muda, no máximo a cada 4 s (limite do Discord).
  const DSC = { last: '', timer: null, at: 0 };
  function syncDiscord() {
    if (!api || !api.discordStatus) return;
    const inRoom = !!(S.peer && S.code);
    const watching = [...document.querySelectorAll('.tile')].some((t) => t.dataset.id !== 'self' && t.querySelector('video') && t.querySelector('video').srcObject);
    const st = {
      on: !(SET.get && SET.get('discordStatus') === false), inRoom, sharing: !!S.stream, watching,
      count: inRoom ? S.members.size + 1 : 0, code: inRoom ? S.code : '',
      join: !(SET.get && SET.get('discordJoin') === false), since: S.since || Date.now(),
    };
    const key = JSON.stringify(st);
    if (key === DSC.last) return;
    clearTimeout(DSC.timer);
    const wait = Math.max(0, DSC.at + 4000 - Date.now());
    DSC.timer = setTimeout(() => { DSC.last = key; DSC.at = Date.now(); api.discordStatus(st); }, wait);
  }
  window.__telinhaDiscordSync = syncDiscord;

  function leaveRoom() {
    if (!S.peer) return;
    if (RC.view) rcViewStop(true);
    S.leaving = true;
    stopShare();
    broadcast({ t: 'bye' });
    for (const id of [...S.inCalls.keys()]) closeIn(id);
    const peer = S.peer;
    setTimeout(() => peer.destroy(), 200); // dá tempo do "tchau" sair
    setTimeout(vpnLeave, 400);
    resetState();
    $('#chat-log').textContent = '';
    document.querySelectorAll('.tile').forEach((t) => t.remove());
    exitCinema();
    if (REC.rec) stopRecording();
    micStop(true);
    showView('lobby');
    setTimeout(syncTray, 400);
  }

  function resetState() {
    S.peer = null; S.code = ''; S.hostId = ''; S.isHost = false; S.owner = ''; S.password = '';
    S.admitted.clear(); S.banned.clear();
    S.members.clear(); S.outCalls.clear(); S.inCalls.clear();
    setTimeout(() => { S.leaving = false; }, 300);
  }

  // ---------------------------------------------------------- membros/dados
  function connectTo(id) {
    const conn = S.peer.connect(id, { reliable: true, metadata: { name: S.name, pw: ($('#room-pass').value || '').trim().slice(0, 40), cid: CLIENT_ID } });
    conn._outgoing = true;
    setupConn(conn);
    return conn;
  }

  function setupConn(conn) {
    conn.on('open', () => {
      // Porteiro: o criador confere senha e expulsão; os outros só aceitam quem o criador liberou.
      if (!conn._outgoing) {
        const meta = conn.metadata || {};
        if (S.isHost) {
          const why = S.banned.has(String(meta.cid || '')) ? 'ban' : (S.password && meta.pw !== S.password ? 'senha' : '');
          if (why) {
            log(`${short(conn.peer)} recusado na porta (${why})`);
            send(conn, { t: 'deny', why });
            setTimeout(() => { try { conn.close(); } catch { /* */ } }, 1500);
            return;
          }
          conn._cid = String(meta.cid || '');
          S.admitted.add(conn.peer);
          broadcast({ t: 'admit', id: conn.peer });
        } else if (conn.peer !== S.hostId && !S.admitted.has(conn.peer)) {
          // pode ser que o "admit" do criador ainda esteja chegando: espera um pouco
          let tries = 0;
          const wait = setInterval(() => {
            if (S.admitted.has(conn.peer)) { clearInterval(wait); openConn(conn); }
            else if (++tries > 25 || !conn.open) { clearInterval(wait); log(`${short(conn.peer)} recusado (o criador não liberou)`); try { conn.close(); } catch { /* */ } }
          }, 200);
          return;
        }
      }
      openConn(conn);
    });
    conn.on('data', (msg) => onData(conn, msg));
    conn.on('close', () => { log(`dados fechados com ${short(conn.peer)}`); dropMember(conn.peer, conn); });
    conn.on('error', (e) => log(`erro nos dados com ${short(conn.peer)}:`, e.type || '', e.message || String(e)));
    conn.on('iceStateChanged', (st) => { if (st === 'failed' || st === 'disconnected') log(`dados com ${short(conn.peer)}: ice=${st}`); });
  }

  function openConn(conn) {
    {
      const prev = S.members.get(conn.peer);
      if (prev && prev.conn && prev.conn !== conn) { try { prev.conn.close(); } catch { /* */ } }
      const m = prev || { id: conn.peer, name: '…', sharing: false };
      m.conn = conn;
      m.lastSeen = Date.now();
      if (!conn._outgoing && conn.metadata && conn.metadata.name) m.name = String(conn.metadata.name).slice(0, 24);
      S.members.set(conn.peer, m);

      send(conn, { t: 'hello', name: S.name, sharing: !!S.stream, prof: SET.profile(), ver: APP_VER, rc: RC.can });
      if (S.isHost && !conn._outgoing) {
        const others = [...S.members.values()].filter((x) => x.id !== conn.peer).map((x) => ({ id: x.id, name: x.name }));
        send(conn, { t: 'welcome', members: others, owner: S.owner });
      }
      if (S.stream) callMember(conn.peer);
      if (VOICE.stream) voiceCall(conn.peer);
      if (!prev && !conn._outgoing) { addSystem(`${m.name} entrou.`); SET.play('join'); }
      log(`dados abertos com ${short(conn.peer)} (${conn._outgoing ? 'eu liguei' : 'ele ligou'})`);
      renderMembers();
    }
  }

  function send(conn, msg) {
    try { if (conn && conn.open) conn.send(msg); } catch (e) { console.warn('envio falhou', e); }
  }
  function broadcast(msg) { for (const m of S.members.values()) send(m.conn, msg); }

  function onData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    const m = S.members.get(conn.peer);
    if (!m) return;
    m.lastSeen = Date.now();
    switch (msg.t) {
      case 'ping':
        break;
      case 'hello':
        m.name = String(msg.name || '?').slice(0, 24);
        m.rc = !!msg.rc;
        m.sharing = !!msg.sharing;
        m.prof = cleanProfile(msg.prof);
        if (WEB || msg.ver === 'web') { m.web = msg.ver === 'web'; /* navegador: sem aviso de versão */ } else if (msg.ver !== undefined && APP_VER && String(msg.ver) !== APP_VER && !m.verWarned) {
          m.verWarned = true;
          const theirs = msg.ver ? String(msg.ver).slice(0, 12) : 'antiga';
          toast(`${m.name} está no Telinha ${theirs} e você no ${APP_VER}. Atualizem os dois pra mesma versão.`, 'warn');
          log(`versão diferente: ${short(conn.peer)} = ${theirs}, eu = ${APP_VER}`);
        } else if (msg.ver === undefined && !m.verWarned) {
          m.verWarned = true;
          toast(`${m.name} está numa versão antiga do Telinha. Peça pra atualizar.`, 'warn');
        }
        updateTileName(m.id);
        renderMembers();
        break;
      case 'admit':
        if (conn.peer === S.hostId && typeof msg.id === 'string') S.admitted.add(msg.id);
        break;
      case 'kick': // o dono expulsou alguém
        if (conn.peer !== S.owner || typeof msg.id !== 'string') break;
        if (msg.id === myId()) { kickedOut(); break; }
        if (S.isHost) { const x = S.members.get(msg.id); if (x && x.conn && x.conn._cid) S.banned.add(x.conn._cid); }
        S.admitted.delete(msg.id);
        { const x = S.members.get(msg.id); if (x) { addSystem(`${x.name} foi removido pelo dono.`); const c = x.conn; dropMember(x.id, c, true); try { c.close(); } catch { /* */ } } }
        break;
      case 'rc-ask': rcAsked(m); break;
      case 'rc-ok': rcViewStart(m); break;
      case 'rc-no': rcRefused(m, String(msg.why || '')); break;
      case 'rc-end': rcEnded(m); break;
      case 'rc-ev': rcEvent(m, msg); break;
      case 'mute': // o dono mutou você
        if (conn.peer !== S.owner) break;
        if (VOICE.stream && !VOICE.muted) toggleMic();
        toast(`${m.name} (dono) mutou seu microfone. Você pode desmutar quando quiser.`, 'warn');
        break;
      case 'owner': // o dono passou a sala pra outra pessoa
        if (conn.peer !== S.owner || typeof msg.id !== 'string') break;
        setOwner(msg.id);
        break;
      case 'welcome': {
        if (conn.peer !== S.hostId || !Array.isArray(msg.members)) return;
        if (typeof msg.owner === 'string') S.owner = msg.owner;
        for (const x of msg.members) if (x && typeof x.id === 'string') S.admitted.add(x.id);
        const roomPrefix = PREFIX + S.code + '-';
        for (const x of msg.members) {
          if (x && typeof x.id === 'string' && x.id.startsWith(roomPrefix) && x.id !== S.peer.id && !S.members.has(x.id)) {
            connectTo(x.id);
          }
        }
        break;
      }
      case 'sharing':
        if (msg.on && !m.sharing) { SET.play('live'); toast(`${m.name} começou a transmitir.`); }
        m.sharing = !!msg.on;
        if (!m.sharing) closeIn(m.id);
        renderMembers();
        break;
      case 'chat':
        if (typeof msg.text === 'string' && msg.text.trim()) {
          addChat(m.name, msg.text.slice(0, 500), false, m.prof && m.prof.col); SET.play('chat'); cinemaChat(m.name, msg.text.slice(0, 500), m.prof && m.prof.col);
          notifyChat(m.name, msg.text.slice(0, 120));
        }
        break;
      case 'file': {
        const f = cleanFile(msg);
        if (!f) break;
        addChatFile(m.name, f, false, m.prof && m.prof.col);
        SET.play('chat');
        cinemaChat(m.name, f.image ? '🖼️ imagem' : `📎 ${f.name}`, m.prof && m.prof.col);
        notifyChat(m.name, f.image ? 'mandou uma imagem' : `mandou o arquivo ${f.name}`);
        break;
      }
      case 'voice':
        m.mic = msg.on ? (msg.muted ? 'muted' : 'on') : '';
        renderMembers();
        break;
      case 'profile':
        m.prof = cleanProfile(msg.prof);
        renderMembers();
        break;
      case 'draw': {
        const d = cleanDraw(msg, m);
        if (!d) break;
        if (S.peer && d.sid === S.peer.id) {
          const t = tileOf('self');
          if (t && t._layer) t._layer.apply(d);
          overlaySend(d);
        } else {
          const t = tileOf(d.sid);
          if (t && t._layer) t._layer.apply(d);
        }
        break;
      }
      case 'react':
        if (REACTIONS.includes(msg.e)) showReaction(msg.e, m.name);
        break;
      case 'recall': {
        // Quem assiste avisou que o vídeo caiu: liga de novo (no máximo a cada 4 s).
        const now = Date.now();
        if (S.stream && now - (m.lastRecall || 0) > 4000) {
          m.lastRecall = now;
          log(`${short(m.id)} pediu pra religar o vídeo`);
          callMember(m.id);
        }
        break;
      }
      case 'bye':
        dropMember(m.id, m.conn);
        break;
    }
  }

  // Batimento: o WebRTC nem sempre avisa quando alguém some (crash, queda de
  // internet). Cada um manda um sinal a cada 3 s; quem fica 12 s calado sai.
  const HEARTBEAT_MS = 3000;
  const TIMEOUT_MS = 12000;
  setInterval(() => {
    if (!S.peer || S.leaving) return;
    broadcast({ t: 'ping' });
    const now = Date.now();
    for (const m of [...S.members.values()]) {
      if (now - (m.lastSeen || now) > TIMEOUT_MS) {
        const conn = m.conn;
        dropMember(m.id, conn);
        try { conn.close(); } catch { /* */ }
      }
    }
  }, HEARTBEAT_MS);

  function dropMember(id, conn, quiet) {
    const m = S.members.get(id);
    if (!m || (conn && m.conn !== conn)) return;
    log(`${short(id)} saiu da sala (${Date.now() - (m.lastSeen || 0)} ms sem sinal)`);
    S.members.delete(id);
    rcOnDrop(id);
    closeIn(id);
    closeOut(id);
    voiceDrop(id);
    renderMembers();
    if (S.leaving) return;
    if (id === S.owner) {
      // o dono saiu: volta pro criador; se ele também saiu, todos escolhem o mesmo (menor id)
      const ids = [myId(), ...S.members.keys()].sort();
      setOwner(S.members.has(S.hostId) || S.isHost ? S.hostId : ids[0], true);
    }
    if (quiet) return;
    addSystem(`${m.name} saiu.`);
    SET.play('leave');
    if (id === S.hostId && !S.isHost) {
      toast('Quem criou a sala saiu. Vocês continuam conectados, mas ninguém novo consegue entrar com esse código.', 'warn');
    }
  }


  // ---- H.264 primeiro: no Windows o Chromium usa o codificador da placa de
  // vídeo (NVENC/AMF/QuickSync) pra H.264; VP8 seria no processador.
  // Reordena os codecs de vídeo no SDP pra o escolhido vir primeiro.
  function preferCodec(sdp, codec) {
    const c = codec || SET.codec();
    if (c === 'h264') return preferH264(sdp);
    const name = c === 'vp9' ? 'VP9' : 'VP8';
    const lines = sdp.split('\r\n');
    const mIdx = lines.findIndex((l) => l.startsWith('m=video'));
    if (mIdx < 0) return sdp;
    let end = lines.findIndex((l, i) => i > mIdx && l.startsWith('m='));
    if (end < 0) end = lines.length;
    const section = lines.slice(mIdx, end);
    const want = [];
    const rtxFor = {};
    for (const l of section) {
      let m = l.match(new RegExp(`^a=rtpmap:(\\d+) ${name}/90000`, 'i'));
      if (m) want.push(m[1]);
      m = l.match(/^a=fmtp:(\d+) apt=(\d+)/);
      if (m) rtxFor[m[2]] = m[1];
    }
    if (!want.length) return sdp;
    const first = [];
    for (const pt of want) { first.push(pt); if (rtxFor[pt]) first.push(rtxFor[pt]); }
    const parts = lines[mIdx].split(' ');
    lines[mIdx] = [...parts.slice(0, 3), ...first, ...parts.slice(3).filter((pt) => !first.includes(pt))].join(' ');
    return lines.join('\r\n');
  }

  function preferH264(sdp) {
    const lines = sdp.split('\r\n');
    const mIdx = lines.findIndex((l) => l.startsWith('m=video'));
    if (mIdx < 0) return sdp;
    let end = lines.findIndex((l, i) => i > mIdx && l.startsWith('m='));
    if (end < 0) end = lines.length;
    const section = lines.slice(mIdx, end);
    const h264 = [];
    const fmtp = {};
    const rtxFor = {};
    for (const l of section) {
      let m = l.match(/^a=rtpmap:(\d+) H264\/90000/i);
      if (m) h264.push(m[1]);
      m = l.match(/^a=fmtp:(\d+) (.*)$/);
      if (m) {
        fmtp[m[1]] = m[2];
        const apt = m[2].match(/apt=(\d+)/);
        if (apt) rtxFor[apt[1]] = m[1];
      }
    }
    if (!h264.length) return sdp;
    // High > Main > Baseline > Constrained Baseline: os codificadores de placa
    // (Media Foundation) aceitam High/Main; o Constrained Baseline costuma cair
    // no OpenH264, que roda no processador.
    const score = (pt) => {
      const f = fmtp[pt] || '';
      const prof = ((f.match(/profile-level-id=([0-9a-f]{2})([0-9a-f]{2})/i) || [])[1] || '').toLowerCase();
      const rank = { '64': 8, '4d': 6, '42': 2 }[prof] || 0;
      const cbp = /profile-level-id=42e0/i.test(f) ? 0 : 1;
      return (/packetization-mode=1/.test(f) ? 20 : 0) + rank + cbp;
    };
    h264.sort((a, b) => score(b) - score(a));
    const first = [];
    for (const pt of h264) { first.push(pt); if (rtxFor[pt]) first.push(rtxFor[pt]); }
    const parts = lines[mIdx].split(' ');
    const head = parts.slice(0, 3);
    const rest = parts.slice(3).filter((pt) => !first.includes(pt));
    lines[mIdx] = [...head, ...first, ...rest].join(' ');
    return lines.join('\r\n');
  }

  // Pausa o capturador quando ninguém está recebendo o vídeo (e a prévia está desligada).
  function updateGdiPause() {
    if (!api || !api.gdiPause || !S.stream || !S.stream._gdi) return;
    api.gdiPause(S.outCalls.size === 0 && !previewOn());
  }

  // ---------------------------------------------------------------- mídia
  // Vigia uma conexão de vídeo: registra no log e avisa quando ela quebra de vez
  // ('failed') ou fica 'disconnected' por mais de 6 s.
  function watchPc(pc, label, onBroken) {
    if (!pc) return;
    let discTimer = null;
    let broken = false;
    const fire = (why) => {
      if (broken) return;
      broken = true;
      log(`${label}: conexão de vídeo quebrou (${why})`);
      onBroken();
    };
    const report = async () => {
      try {
        const stats = await pc.getStats();
        let pair = null;
        stats.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId); });
        if (!pair) stats.forEach((r) => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
        if (pair) {
          const lc = stats.get(pair.localCandidateId) || {};
          const rc = stats.get(pair.remoteCandidateId) || {};
          log(`${label}: caminho ${lc.candidateType}/${lc.protocol} → ${rc.candidateType} (rtt ${Math.round((pair.currentRoundTripTime || 0) * 1000)} ms)`);
        }
      } catch { /* sem estatísticas */ }
    };
    pc.addEventListener('iceconnectionstatechange', () => log(`${label}: ice=${pc.iceConnectionState}`));
    pc.addEventListener('connectionstatechange', () => {
      const st = pc.connectionState;
      log(`${label}: conexão=${st}`);
      clearTimeout(discTimer);
      if (st === 'connected') report();
      else if (st === 'failed') fire('failed');
      else if (st === 'disconnected') discTimer = setTimeout(() => fire('disconnected por 6 s'), 6000);
    });
  }

  // Estatísticas a cada 2 s nos primeiros 30 s e depois a cada 10 s.
  function statsLoop(pc, label, isOut, stillValid) {
    const t0 = Date.now();
    let last = null;
    const tick = async () => {
      if (!stillValid() || pc.connectionState === 'closed') return;
      try {
        const stats = await pc.getStats();
        stats.forEach((r) => {
          if (r.kind !== 'video') return;
          if (isOut && r.type === 'outbound-rtp') {
            const kbps = last ? Math.round(((r.bytesSent - last.b) * 8) / (r.timestamp - last.t)) : 0;
            const codec = (stats.get(r.codecId) || {}).mimeType || '?';
            if (r.encoderImplementation) store.set('telinha.lastEncoder', `${codec.replace('video/', '')} via ${r.encoderImplementation}${r.powerEfficientEncoder ? ' (placa)' : ''}`);
            log(`${label}: enviando ${r.frameWidth || '?'}x${r.frameHeight || '?'} ${r.framesPerSecond || 0} fps, ${kbps} kbps, quadros=${r.framesSent}, limite=${r.qualityLimitationReason}, codec=${codec} via ${r.encoderImplementation || '?'}${r.powerEfficientEncoder ? ' (placa de vídeo)' : ''}`);
            last = { b: r.bytesSent, t: r.timestamp };
          } else if (!isOut && r.type === 'inbound-rtp') {
            const kbps = last ? Math.round(((r.bytesReceived - last.b) * 8) / (r.timestamp - last.t)) : 0;
            const codec = (stats.get(r.codecId) || {}).mimeType || '?';
            log(`${label}: recebendo ${r.frameWidth || '?'}x${r.frameHeight || '?'} ${r.framesPerSecond || 0} fps, ${kbps} kbps, decodificados=${r.framesDecoded}, perdidos=${r.packetsLost}, travadas=${r.freezeCount || 0}, codec=${codec} via ${r.decoderImplementation || '?'}`);
            last = { b: r.bytesReceived, t: r.timestamp };
          }
        });
      } catch { /* */ }
      setTimeout(tick, Date.now() - t0 < 30000 ? 2000 : 10000);
    };
    setTimeout(tick, 2000);
  }

  function onCall(call) {
    if (call.metadata && call.metadata.kind === 'voice') { onVoiceCall(call); return; }
    const from = call.peer;
    const label = `assistindo ${short(from)}`;
    const old = S.inCalls.get(from);
    if (old && old !== call) { try { old.close(); } catch { /* */ } }
    S.inCalls.set(from, call);
    log(`${label}: recebendo chamada de vídeo`);
    const want = (call.metadata && ['h264', 'vp9', 'vp8'].includes(call.metadata.codec)) ? call.metadata.codec : 'h264';
    call.answer(undefined, { sdpTransform: (sdp) => preferCodec(sdp, want) }); // só assiste; segue o codec de quem transmite
    const valid = () => S.inCalls.get(from) === call;
    watchPc(call.peerConnection, label, () => {
      // Pede pra quem transmite ligar de novo.
      const m = S.members.get(from);
      if (valid() && m && m.sharing) { log(`${label}: pedindo pra religar`); send(m.conn, { t: 'recall' }); }
    });
    call.on('stream', (stream) => {
      if (!valid()) return;
      log(`${label}: chegou o vídeo (${stream.getVideoTracks().length} vídeo, ${stream.getAudioTracks().length} áudio)`);
      stream.getTracks().forEach((t) => t.addEventListener('ended', () => log(`${label}: faixa de ${t.kind} encerrou`)));
      showTile(from, stream, false);
      statsLoop(call.peerConnection, label, false, valid);
    });
    call.on('close', () => {
      log(`${label}: chamada fechada`);
      if (valid()) { S.inCalls.delete(from); removeTile(from); }
    });
    call.on('error', (e) => log(`${label}: erro`, e.type || '', e.message || String(e)));
  }

  function closeIn(id) {
    const c = S.inCalls.get(id);
    if (c) { S.inCalls.delete(id); try { c.close(); } catch { /* */ } }
    removeTile(id);
  }
  function closeOut(id) {
    const c = S.outCalls.get(id);
    if (c) { S.outCalls.delete(id); try { c.close(); } catch { /* */ } }
    updateGdiPause();
  }

  function callMember(id) {
    if (!S.stream || !S.peer) return;
    closeOut(id);
    const label = `enviando p/ ${short(id)}`;
    // O codec é decidido por quem transmite (é o PC dele que codifica).
    const codec = SET.codec();
    const call = S.peer.call(id, S.stream, { metadata: { kind: 'screen', codec }, sdpTransform: (sdp) => preferCodec(sdp, codec) });
    if (!call) { log(`${label}: não deu pra ligar`); return; }
    log(`${label}: ligando`);
    S.outCalls.set(id, call);
    updateGdiPause();
    const valid = () => S.outCalls.get(id) === call;
    tuneCall(call);
    watchPc(call.peerConnection, label, () => {
      // Religa sozinho (uma vez a cada 5 s no máximo) se a pessoa ainda estiver na sala.
      setTimeout(() => {
        if (valid() && S.stream && S.members.has(id)) { log(`${label}: religando`); callMember(id); }
      }, 1500);
    });
    statsLoop(call.peerConnection, label, true, valid);
    call.on('close', () => { log(`${label}: chamada fechada`); if (valid()) { S.outCalls.delete(id); updateGdiPause(); } });
    call.on('error', (e) => log(`${label}: erro`, e.type || '', e.message || String(e)));
  }

  // Limita bitrate, resolução e fps por pessoa (cada amigo recebe uma cópia,
  // então isso protege seu upload). Feito no envio em vez de mexer na captura.
  function tuneCall(call) {
    const pc = call.peerConnection;
    if (!pc || !S.shareOpts) return;
    const q = QUALITY[S.shareOpts.quality] || QUALITY.medium;
    const max = q[S.shareOpts.kind];
    const fps = S.shareOpts.fps || 30;
    let done = false;
    const apply = async () => {
      if (done) return;
      done = true;
      for (const sender of pc.getSenders()) {
        if (!sender.track || sender.track.kind !== 'video') continue;
        const set = sender.track.getSettings();
        const scale = Math.max(1, (set.width || q.w) / q.w, (set.height || q.h) / q.h);
        const p = sender.getParameters();
        if (!p.encodings || !p.encodings.length) p.encodings = [{}];
        p.encodings[0].maxBitrate = max;
        p.encodings[0].maxFramerate = fps;
        p.encodings[0].scaleResolutionDownBy = scale;
        p.degradationPreference = S.shareOpts.kind === 'motion' ? 'maintain-framerate' : 'maintain-resolution';
        try {
          await sender.setParameters(p);
          log(`qualidade aplicada: até ${Math.round(max / 1000)} kbps, ${fps} fps, ${Math.round((set.width || 0) / scale)}x${Math.round((set.height || 0) / scale)}`);
        } catch (e) {
          log('não deu pra ajustar a qualidade:', e.message);
        }
      }
    };
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'connected') apply(); });
  }

  // ---- captura: tenta mais de um método, porque em alguns Windows o método
  // padrão é encerrado pelo sistema logo depois de começar.
  const AUDIO_RAW = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 };

  // ---- Plano C: captura pelo GDI. Um programinha nativo manda quadros JPEG,
  // que são desenhados num canvas; o canvas vira a faixa de vídeo transmitida.
  let gdiCleanup = null;
  function gdiRelease() {
    if (gdiCleanup) { const f = gdiCleanup; gdiCleanup = null; f(); }
  }

  async function captureGdi(sel, fps) {
    gdiRelease();
    const q = QUALITY[sel.quality] || QUALITY.medium;
    const f = Math.min(fps, 60); // o capturador usa DXGI (até 60) ou GDI (segura em 30)
    const canvas = document.createElement('canvas');
    canvas.width = q.w; canvas.height = q.h;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let stream = null;
    let gotFirst;
    const first = new Promise((r) => { gotFirst = r; });
    let frames = 0;
    let busy = false;
    let lastDraw = 0;
    // Tela parada = nenhum quadro novo. Redesenha o último a cada ~1 s pra quem
    // acabou de entrar na sala receber a imagem (e o vídeo não "congelar").
    const keepAlive = setInterval(() => {
      if (frames && performance.now() - lastDraw > 900) { ctx.drawImage(canvas, 0, 0); lastDraw = performance.now(); }
    }, 500);
    const offFrame = api.onGdiFrame(async (data) => {
      if (busy) { api.gdiAck(); return; }
      busy = true;
      try {
        const bmp = await createImageBitmap(new Blob([data], { type: 'image/jpeg' }));
        if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
          canvas.width = bmp.width; canvas.height = bmp.height;
        }
        ctx.drawImage(bmp, 0, 0);
        lastDraw = performance.now();
        bmp.close();
        if (++frames === 1) gotFirst(true);
      } catch (e) {
        log('gdi: quadro inválido', e.message);
      } finally {
        busy = false;
        api.gdiAck();
      }
    });
    const offEnded = api.onGdiEnded((code) => {
      log(`gdi: capturador terminou (código ${code})`);
      gotFirst(false);
      if (stream && S.stream === stream) {
        toast('A captura da tela parou. Tenta compartilhar de novo.', 'error');
        stopShare();
      }
    });
    gdiCleanup = () => { clearInterval(keepAlive); offFrame(); offEnded(); api.gdiStop(); };

    const cap = SET.capture();
    const r = await api.gdiStart({ id: sel.id, name: sel.name }, { maxW: q.w, maxH: q.h, fps: f, quality: 72, method: cap === 'gdi' ? 'gdi' : cap === 'dxgi' ? 'dxgi' : 'auto' });
    if (!r || !r.ok) { gdiRelease(); throw new Error('capturador GDI não iniciou: ' + (r && r.erro)); }
    const ok = await Promise.race([first, new Promise((res) => setTimeout(() => res(false), 6000))]);
    if (!ok) { gdiRelease(); throw new Error('o capturador GDI não mandou nenhum quadro'); }

    stream = canvas.captureStream(f);
    stream._gdi = true;
    stream._canvas = canvas; // mantém o canvas vivo

    // Som do PC: o loopback de áudio do Chromium costuma funcionar mesmo quando
    // a imagem não funciona. Pega só a faixa de áudio.
    if (sel.audio) {
      const audio = await grabSystemAudio(sel);
      if (audio) stream.addTrack(audio);
    }
    log(`gdi: captura começou (${canvas.width}x${canvas.height} @ ${f} fps)`);
    return stream;
  }

  async function grabSystemAudio(sel) {
    const tries = [
      ['clássico', () => navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: 'desktop' } },
        video: { mandatory: { chromeMediaSource: 'desktop' } },
      })],
      ['padrão', async () => {
        await api.selectSource({ id: sel.id, name: sel.name, audio: true });
        return navigator.mediaDevices.getDisplayMedia({ video: true, audio: AUDIO_RAW, systemAudio: 'include' });
      }],
    ];
    for (const [name, fn] of tries) {
      try {
        const s = await fn();
        const at = s.getAudioTracks()[0];
        s.getVideoTracks().forEach((t) => { s.removeTrack(t); t.stop(); });
        if (!at) continue;
        await new Promise((r) => setTimeout(r, 1200));
        if (at.readyState === 'live') { log(`gdi: som do PC pelo método ${name} ✔`); return at; }
        log(`gdi: som do PC pelo método ${name} caiu`);
      } catch (e) {
        log(`gdi: som do PC pelo método ${name} falhou: ${e.name} ${e.message}`);
      }
    }
    return null;
  }

  async function captureWith(method, sel, fps) {
    if (method === 'gdi') return captureGdi(sel, fps);
    if (method === 'padrão') {
      if (api) await api.selectSource({ id: sel.id, name: sel.name, audio: sel.audio });
      return navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: fps },
        audio: sel.audio ? AUDIO_RAW : false,
        systemAudio: 'include',
      });
    }
    // 'clássico': caminho antigo do Electron (chromeMediaSource=desktop).
    const id = (api && await api.resolveSource({ id: sel.id, name: sel.name })) || sel.id;
    const video = { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id, maxFrameRate: fps } };
    if (!sel.audio) return navigator.mediaDevices.getUserMedia({ audio: false, video });
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'desktop' } }, video });
    } catch (e) {
      log('clássico: som do PC falhou, tentando só imagem:', e.name, e.message);
      return navigator.mediaDevices.getUserMedia({ audio: false, video });
    }
  }

  // Espera a faixa de vídeo sobreviver por um tempo; o problema relatado
  // derrubava ela em ~40 ms.
  function survives(stream, ms) {
    const vt = stream.getVideoTracks()[0];
    if (!vt || vt.readyState === 'ended') return Promise.resolve(false);
    return new Promise((resolve) => {
      const onEnd = () => { clearTimeout(timer); resolve(false); };
      const timer = setTimeout(() => { vt.removeEventListener('ended', onEnd); resolve(vt.readyState === 'live'); }, ms);
      vt.addEventListener('ended', onEnd, { once: true });
    });
  }

  function describeTracks(stream, method) {
    for (const t of stream.getTracks()) log(`[${method}] faixa de ${t.kind}: "${t.label}" ${JSON.stringify(t.getSettings())}`);
  }

  // Faixa de áudio com o som de um programa só (vem do telinha-som.exe pelo processo principal).
  // o processador fica em renderer/worklets/pcm.js
  async function appAudioTrack(pid, name) {
    if (!api || !api.appAudioStart) return null;
    try {
      const ctx = new AudioContext({ sampleRate: 48000 });
      await ctx.audioWorklet.addModule('worklets/pcm.js');
      const node = new AudioWorkletNode(ctx, 'telinha-pcm', { numberOfInputs: 0, outputChannelCount: [2] });
      const dest = ctx.createMediaStreamDestination();
      node.connect(dest);
      api.onAppAudio((u8) => { const c = u8.slice(); node.port.postMessage(c.buffer, [c.buffer]); });
      api.onAppAudioEnd(() => { if (S.appAudio) toast(`O som de ${name || 'programa'} parou (o programa fechou?). A imagem continua.`, 'warn'); });
      const r = await api.appAudioStart(pid);
      if (!r || !r.ok) { ctx.close(); return null; }
      const track = dest.stream.getAudioTracks()[0];
      return { track, stop: () => { api.appAudioStop(); try { ctx.close(); } catch { /* */ } } };
    } catch (e) {
      log('som do programa falhou:', String(e));
      return null;
    }
  }

  async function startShare(sel) {
    if (S.starting) return;
    S.starting = true;
    try { await startShareInner(sel); } finally { S.starting = false; }
  }

  async function startShareInner(sel) {
    const fps = sel.kind === 'motion' ? 60 : 30;
    sel.fps = fps;
    log(`começando a compartilhar: fonte=${sel.id} "${sel.name}" som=${sel.audio} tipo=${sel.kind} qualidade=${sel.quality}`);

    const capSetting = SET.capture();
    let methods = capSetting === 'chromium' ? ['padrão', 'clássico']
      : (capSetting === 'dxgi' || capSetting === 'gdi') ? ['gdi']
        : ['padrão', 'clássico', 'gdi'];
    const preferred = store.get('telinha.method');
    if (capSetting === 'auto' && preferred && methods.includes(preferred)) methods = [preferred, ...methods.filter((m) => m !== preferred)];
    if (!api) methods = ['padrão'];

    let stream = null;
    let used = '';
    let lastErr = '';
    for (const method of methods) {
      if (!S.peer) return;
      // Tenta no fps escolhido e, se cair, em 30 fps.
      for (const f of fps > 30 && method !== 'gdi' ? [fps, 30] : [fps]) {
        let s;
        const t0 = performance.now();
        try {
          s = window.__testCapture && !api ? await window.__testCapture() : await captureWith(method, sel, f);
        } catch (e) {
          lastErr = `${e.name}: ${e.message}`;
          log(`[${method} ${f}fps] captura recusada: ${lastErr}`);
          continue;
        }
        describeTracks(s, method);
        if (await survives(s, 2500)) {
          stream = s; used = method; sel.fps = f;
          log(`[${method} ${f}fps] captura estável ✔`);
          break;
        }
        lastErr = `encerrada após ${Math.round(performance.now() - t0)} ms`;
        log(`[${method} ${f}fps] faixa de vídeo ${lastErr}`);
        s.getTracks().forEach((t) => t.stop());
        if (s._gdi) gdiRelease();
      }
      if (stream) break;
    }

    if (!S.peer) { if (stream) stream.getTracks().forEach((t) => t.stop()); return; }
    if (!stream) {
      log('nenhum método de captura funcionou. último erro:', lastErr);
      if (api && api.startDiag) {
        const yes = await confirmBox(
          'O Windows está derrubando a captura',
          'Nenhum dos métodos de captura durou mais que meio segundo neste PC. O Telinha pode testar sozinho uns ajustes diferentes (leva uns 2 minutos e ele reinicia algumas vezes) e já deixar ligado o que funcionar. Depois ele volta pra esta sala.',
          'Testar ajustes',
        );
        if (yes) api.startDiag({ code: S.code, host: S.isHost });
      } else {
        toast('Não consegui capturar essa tela.', 'error');
      }
      return;
    }
    store.set('telinha.method', used);

    const t0 = Date.now();
    for (const t of stream.getTracks()) {
      t.addEventListener('mute', () => log(`faixa de ${t.kind} ficou sem dados (mute) após ${Date.now() - t0} ms`));
      t.addEventListener('unmute', () => log(`faixa de ${t.kind} voltou (unmute)`));
      t.addEventListener('ended', () => {
        log(`faixa de ${t.kind} ENCERROU após ${Date.now() - t0} ms (readyState=${t.readyState})`);
        if (S.stream !== stream) return;
        if (t.kind === 'video') {
          toast('A captura da tela foi encerrada pelo Windows. Tenta compartilhar de novo.', 'error');
          stopShare();
        } else {
          toast('O som do PC parou, mas a imagem continua.', 'warn');
        }
      });
    }
    if (sel.appPid) {
      stream.getAudioTracks().forEach((t) => { stream.removeTrack(t); t.stop(); });
      const app = await appAudioTrack(sel.appPid, sel.appName);
      if (app) { stream.addTrack(app.track); S.appAudio = app; log(`som só de "${sel.appName}" (pid ${sel.appPid})`); }
      else toast(`Não deu pra pegar o som só de ${sel.appName}. Precisa do Windows 10 (2004) ou mais novo.`, 'warn');
    }
    const vt = stream.getVideoTracks()[0];
    if (vt) vt.contentHint = sel.kind === 'motion' ? 'motion' : 'detail';
    const at = stream.getAudioTracks()[0];
    if (at) at.contentHint = 'music';
    if (sel.audio && !at) {
      toast('O som do PC não veio junto. Só a imagem está sendo transmitida.', 'warn');
    }

    S.stream = stream;
    S.shareOpts = sel;
    showTile('self', stream, true);
    for (const id of S.members.keys()) callMember(id);
    updateGdiPause();
    broadcast({ t: 'sharing', on: true });
    updateShareBtn();
    renderMembers();
  }

  // Caixa de confirmação simples (sem os diálogos nativos do navegador).
  function confirmBox(title, text, okLabel) {
    return new Promise((resolve) => {
      const wrap = el('div', 'modal');
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      const card = el('div', 'modal-card confirm');
      const actions = el('div', 'modal-actions');
      const no = el('button', 'btn ghost', 'Agora não');
      const yes = el('button', 'btn primary', okLabel);
      actions.append(no, yes);
      card.append(el('h2', null, title), el('p', 'muted', text), actions);
      wrap.append(card);
      document.body.append(wrap);
      const done = (v) => { wrap.remove(); resolve(v); };
      no.onclick = () => done(false);
      yes.onclick = () => done(true);
      yes.focus();
    });
  }

  function stopShare() {
    if (!S.stream) return;
    rcHostStop('parou de transmitir');
    overlayShut();
    log('parou de compartilhar');
    for (const id of [...S.outCalls.keys()]) closeOut(id);
    if (S.stream._gdi) gdiRelease();
    if (S.appAudio) { S.appAudio.stop(); S.appAudio = null; }
    S.stream.getTracks().forEach((t) => t.stop());
    S.stream = null;
    S.shareOpts = null;
    removeTile('self');
    broadcast({ t: 'sharing', on: false });
    updateShareBtn();
    renderMembers();
  }


  // ------------------------------------------------------------ voz
  // Cada pessoa com microfone liga uma chamada só de áudio pra cada outra
  // (kind: 'voice'). Mutar só desliga a faixa — a conexão continua.
  const VOICE = { stream: null, muted: false, gateOpen: false, pttDown: false, out: new Map(), inc: new Map(), audios: new Map(), gains: new Map(), meters: new Map(), ctx: null, loop: null, lastSpeak: 0 };
  S.voice = VOICE; // para depuração/testes
  function micCfg() { return SET.mic ? SET.mic() : { mode: 'vad', device: '', pttKey: 'KeyV', vad: 35, volume: 100 }; }
  function audioCtx() { if (!VOICE.ctx) VOICE.ctx = new AudioContext(); return VOICE.ctx; }
  function meterFor(stream) {
    const ctx = audioCtx();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    return () => { an.getFloatTimeDomainData(buf); let s2 = 0; for (const v of buf) s2 += v * v; return Math.sqrt(s2 / buf.length); };
  }
  function applyGate() {
    if (!VOICE.stream) return;
    const c = micCfg();
    const open = !VOICE.muted && (c.mode === 'open' || (c.mode === 'vad' && VOICE.gateOpen) || (c.mode === 'ptt' && VOICE.pttDown));
    for (const t of VOICE.stream.getAudioTracks()) t.enabled = open;
    return open;
  }
  function speakingTick() {
    const c = micCfg();
    // limiar: sensibilidade 1..100 -> RMS 0.06..0.004
    const thr = 0.06 - (c.vad / 100) * 0.056;
    const now = performance.now();
    if (VOICE.stream && VOICE.meters.has('self')) {
      const lvl = VOICE.meters.get('self')();
      if (lvl > thr) { VOICE.gateOpen = true; VOICE.lastSpeak = now; }
      else if (now - VOICE.lastSpeak > 350) VOICE.gateOpen = false;
      const open = applyGate();
      setSpeaking('self', open && lvl > thr * 0.8);
    }
    for (const [id, meter] of VOICE.meters) {
      if (id === 'self') continue;
      setSpeaking(id, meter() > 0.012);
    }
  }
  function setSpeaking(id, on) {
    const li = document.querySelector(`.member[data-id="${CSS.escape(id)}"]`);
    if (li) li.classList.toggle('speaking', !!on);
    if (id === 'self') $('#mic-btn').classList.toggle('talking', !!on);
  }
  function ensureLoop() { if (!VOICE.loop) VOICE.loop = setInterval(speakingTick, 60); }

  // Filtro de ruído com IA (RNNoise em WebAssembly, roda num AudioWorklet a 48 kHz).
  // Os arquivos vêm pelo processo principal (o Chromium não deixa o fetch ler file://).
  const NOISE = { ctx: null, ready: null };
  async function assetBuffer(rel) {
    if (api && api.readAsset) return api.readAsset(rel);
    return (await fetch(rel)).arrayBuffer();
  }
  function noiseReady() {
    if (NOISE.ready) return NOISE.ready;
    NOISE.ready = (async () => {
      const ctx = new AudioContext({ sampleRate: 48000 });
      await ctx.audioWorklet.addModule('vendor/rnnoise/workletProcessor.js');
      const simd = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
      const wasm = await assetBuffer(simd ? 'vendor/rnnoise/rnnoise_simd.wasm' : 'vendor/rnnoise/rnnoise.wasm');
      NOISE.ctx = ctx;
      return { ctx, wasm };
    })().catch((e) => { log('filtro de ruído indisponível:', String(e)); NOISE.ready = null; return null; });
    return NOISE.ready;
  }
  async function denoise(raw) {
    const n = await noiseReady();
    if (!n) return null;
    if (n.ctx.state === 'suspended') await n.ctx.resume().catch(() => {});
    const source = n.ctx.createMediaStreamSource(raw);
    const node = new AudioWorkletNode(n.ctx, '@sapphi-red/web-noise-suppressor/rnnoise', { processorOptions: { maxChannels: 1, wasmBinary: n.wasm.slice(0) } });
    const dest = n.ctx.createMediaStreamDestination();
    source.connect(node).connect(dest);
    return { stream: dest.stream, stop: () => { try { source.disconnect(); node.disconnect(); node.port.postMessage('destroy'); } catch { /* */ } } };
  }

  async function micStart() {
    if (VOICE.stream) return;
    const c = micCfg();
    try {
      VOICE.raw = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: c.device ? { exact: c.device } : undefined, echoCancellation: true, noiseSuppression: !c.noise, autoGainControl: true, channelCount: 1 },
        video: false,
      });
      VOICE.stream = VOICE.raw;
      VOICE.filter = null;
      if (c.noise) {
        const f = await denoise(VOICE.raw);
        if (f) { VOICE.filter = f; VOICE.stream = f.stream; }
      }
    } catch (e) {
      log('microfone recusado:', e.name, e.message);
      toast(e.name === 'NotFoundError' ? 'Nenhum microfone encontrado.' : 'Não deu pra usar o microfone: ' + (e.message || e.name), 'error');
      return;
    }
    VOICE.muted = false;
    // O detector escuta uma CÓPIA da faixa: a original é desligada quando você
    // não está falando (e faixa desligada só entrega silêncio).
    VOICE.monitor = new MediaStream(VOICE.stream.getAudioTracks().map((t) => t.clone()));
    VOICE.meters.set('self', meterFor(VOICE.monitor));
    applyGate();
    ensureLoop();
    for (const id of S.members.keys()) voiceCall(id);
    broadcast({ t: 'voice', on: true, muted: false });
    updateMicBtn();
    renderMembers();
    log(`microfone ligado (${c.mode}${VOICE.filter ? ', filtro de ruído' : ''})`);
    toast(c.mode === 'ptt' ? `Microfone ligado — segure ${SET.keyName ? SET.keyName(c.pttKey) : c.pttKey} pra falar.` : 'Microfone ligado.');
  }
  function micStop(silent) {
    if (!VOICE.stream) return;
    for (const id of [...VOICE.out.keys()]) { try { VOICE.out.get(id).close(); } catch { /* */ } }
    VOICE.out.clear();
    VOICE.stream.getTracks().forEach((t) => t.stop());
    if (VOICE.raw) VOICE.raw.getTracks().forEach((t) => t.stop());
    if (VOICE.filter) VOICE.filter.stop();
    VOICE.raw = null; VOICE.filter = null;
    if (VOICE.monitor) VOICE.monitor.getTracks().forEach((t) => t.stop());
    VOICE.monitor = null;
    VOICE.stream = null;
    VOICE.meters.delete('self');
    setSpeaking('self', false);
    if (!silent) broadcast({ t: 'voice', on: false });
    updateMicBtn();
    renderMembers();
  }
  function toggleMic() {
    if (!S.peer) { toast('Entre numa sala pra usar o microfone.', 'warn'); return; }
    if (!VOICE.stream) { micStart(); return; }
    VOICE.muted = !VOICE.muted;
    applyGate();
    broadcast({ t: 'voice', on: true, muted: VOICE.muted });
    updateMicBtn();
    renderMembers();
    SET.play(VOICE.muted ? 'leave' : 'join');
  }
  function updateMicBtn() {
    const b = $('#mic-btn');
    if (!b) return;
    const st = !VOICE.stream ? 'off' : VOICE.muted ? 'muted' : 'on';
    b.classList.remove('off', 'muted', 'on');
    b.classList.add(st);
    $('#mic-label').textContent = st === 'off' ? 'Microfone' : st === 'muted' ? 'Mutado' : 'Mic ligado';
    b.title = st === 'off' ? 'Ligar o microfone (Ctrl+Shift+F8)' : st === 'muted' ? 'Desmutar (Ctrl+Shift+F8) · botão direito desliga' : 'Mutar (Ctrl+Shift+F8) · botão direito desliga';
  }
  function voiceCall(id) {
    if (!VOICE.stream || !S.peer) return;
    const old = VOICE.out.get(id);
    if (old) { try { old.close(); } catch { /* */ } }
    const call = S.peer.call(id, VOICE.stream, { metadata: { kind: 'voice' } });
    if (!call) return;
    VOICE.out.set(id, call);
    call.on('close', () => { if (VOICE.out.get(id) === call) VOICE.out.delete(id); });
    call.on('error', (e) => log('voz: erro', e.type || '', e.message || ''));
  }
  function onVoiceCall(call) {
    const from = call.peer;
    const old = VOICE.inc.get(from);
    if (old && old !== call) { try { old.close(); } catch { /* */ } }
    VOICE.inc.set(from, call);
    call.answer();
    call.on('stream', (stream) => {
      if (VOICE.inc.get(from) !== call) return;
      let a = VOICE.audios.get(from);
      if (!a) { a = new Audio(); a.autoplay = true; VOICE.audios.set(from, a); }
      // O elemento só "puxa" o áudio do WebRTC; quem toca é o WebAudio, com
      // ganho (dá pra passar de 100%).
      a.srcObject = stream;
      a.muted = true;
      a.play().catch(() => {});
      try {
        const ctx = audioCtx();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const src = ctx.createMediaStreamSource(stream);
        const g = ctx.createGain();
        g.gain.value = micCfg().volume / 100;
        src.connect(g).connect(ctx.destination);
        const old = VOICE.gains.get(from);
        if (old) old.disconnect();
        VOICE.gains.set(from, g);
        VOICE.meters.set(from, meterFor(stream));
      } catch (e) { a.muted = false; log('voz: sem WebAudio', e.message); }
      ensureLoop();
    });
    call.on('close', () => { if (VOICE.inc.get(from) === call) voiceDrop(from, true); });
  }
  function voiceDrop(id, keepOut) {
    const c = VOICE.inc.get(id);
    if (c) { VOICE.inc.delete(id); try { c.close(); } catch { /* */ } }
    const a = VOICE.audios.get(id);
    if (a) { a.srcObject = null; VOICE.audios.delete(id); }
    const g = VOICE.gains.get(id);
    if (g) { try { g.disconnect(); } catch { /* */ } VOICE.gains.delete(id); }
    VOICE.meters.delete(id);
    if (!keepOut) {
      const o = VOICE.out.get(id);
      if (o) { VOICE.out.delete(id); try { o.close(); } catch { /* */ } }
    }
  }


  // ------------------------------------------------------------ desenho na tela
  const DRAW = { seq: 0 };
  function myColor() {
    return SET.profile().col || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff7a45';
  }
  // Retângulo da imagem dentro do vídeo (object-fit: contain), no espaço do canvas.
  function contentRect(tile, canvas) {
    const v = tile.querySelector('video');
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const vw = (v && v.videoWidth) || 16;
    const vh = (v && v.videoHeight) || 9;
    const k = Math.min(W / vw, H / vh);
    const w = vw * k;
    const h = vh * k;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }
  function cleanDraw(msg, m) {
    if (typeof msg.sid !== 'string' || !['s', 'p', 'c'].includes(msg.k)) return null;
    const d = { t: 'draw', sid: msg.sid, k: msg.k, n: (m && m.name) || '' };
    d.c = typeof msg.c === 'string' && /^#[0-9a-f]{6}$/i.test(msg.c) ? msg.c : '#ff7a45';
    if (msg.k === 'c') { d.by = m ? m.id : ''; return d; }
    if (!Array.isArray(msg.p) || msg.p.length > 400 || msg.p.some((x) => typeof x !== 'number' || x < -0.1 || x > 1.1)) return null;
    d.p = msg.p;
    // o id do rabisco sempre começa com quem desenhou (não dá pra apagar o dos outros)
    d.id = `${m ? m.id : '?'}:${String(msg.id || '').slice(-12)}`;
    return d;
  }
  function toggleDrawing(tile, force) {
    const on = force !== undefined ? force : !tile.classList.contains('drawing');
    document.querySelectorAll('.tile.drawing').forEach((t) => { if (t !== tile) t.classList.remove('drawing'); });
    tile.classList.toggle('drawing', on);
    if (on) toast('Desenhe na tela dele: ele vê os rabiscos por cima do monitor. Laser: só aponta.');
  }
  function setupDrawing(tile, canvas, sid) {
    const tools = el('div', 'draw-tools');
    tools.innerHTML = '<button data-tool="pen" class="active" title="Caneta">✏️</button><button data-tool="laser" title="Laser (só apontar)">🔴</button><button data-act="clear" title="Apagar meus rabiscos">🧹</button><button data-act="close" title="Parar de desenhar">✕</button>';
    tile.append(tools);
    let tool = 'pen';
    tools.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.tool) {
        tool = b.dataset.tool;
        tools.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('active', x === b));
      } else if (b.dataset.act === 'clear') {
        send2all({ t: 'draw', sid, k: 'c' });
        if (tile._layer) tile._layer.apply({ k: 'c', by: S.peer.id });
      } else if (b.dataset.act === 'close') {
        toggleDrawing(tile, false);
      }
    });
    let cur = null;
    let pending = [];
    let flushT = null;
    let lastPtr = 0;
    const norm = (e) => {
      const r = contentRect(tile, canvas);
      const x = Math.round(((e.offsetX - r.x) / r.w) * 1000) / 1000;
      const y = Math.round(((e.offsetY - r.y) / r.h) * 1000) / 1000;
      return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
    };
    const flush = () => {
      flushT = null;
      if (!cur || !pending.length) return;
      const msg = { t: 'draw', sid, k: 's', id: cur, p: pending, c: myColor() };
      pending = [];
      send2all(msg);
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (!tile.classList.contains('drawing') || tool !== 'pen') return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      cur = `${++DRAW.seq}`;
      const pt = norm(e);
      pending.push(...pt);
      if (tile._layer) tile._layer.apply({ k: 's', id: `${S.peer.id}:${cur}`, p: pt, col: myColor() });
      if (!flushT) flushT = setTimeout(flush, 40);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!tile.classList.contains('drawing')) return;
      const pt = norm(e);
      if (tool === 'laser') {
        const now = performance.now();
        if (now - lastPtr < 33) return;
        lastPtr = now;
        const msg = { t: 'draw', sid, k: 'p', p: pt, c: myColor() };
        send2all(msg);
        if (tile._layer) tile._layer.apply({ k: 'p', p: pt, c: myColor(), n: S.name });
        return;
      }
      if (!cur) return;
      pending.push(...pt);
      if (tile._layer) tile._layer.apply({ k: 's', id: `${S.peer.id}:${cur}`, p: pt, col: myColor() });
      if (pending.length > 300) flush();
      else if (!flushT) flushT = setTimeout(flush, 40);
    });
    const end = () => { if (cur) { flush(); cur = null; } };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }
  function send2all(msg) { broadcast(msg); }

  // A camada por cima do seu monitor só abre quando alguém desenha, e fecha
  // sozinha depois de 20 s sem rabisco (não pesa nada quando ninguém usa).
  const OV = { open: false, opening: null, timer: null };
  function overlaySend(d) {
    if (!api || !api.overlayOpen || !S.shareOpts) return;
    if (!OV.open && !OV.opening) {
      OV.opening = api.overlayOpen({ id: S.shareOpts.id, name: S.shareOpts.name })
        .then((ok) => { OV.open = !!ok; OV.opening = null; return ok; })
        .catch(() => { OV.opening = null; return false; });
    }
    api.overlayDraw(d); // o processo principal guarda até a camada carregar
    clearTimeout(OV.timer);
    OV.timer = setTimeout(overlayShut, 20000);
  }
  function overlayShut() {
    clearTimeout(OV.timer);
    if (api && api.overlayClose && (OV.open || OV.opening)) api.overlayClose().catch(() => {});
    OV.open = false;
    OV.opening = null;
  }

  // ------------------------------------------------------------ gravação
  const REC = { rec: null, id: null, tileId: null, start: 0, timer: null, chain: Promise.resolve(), file: '' };
  function pickMime() {
    const opts = [['video/x-matroska;codecs=avc1,opus', 'mkv'], ['video/webm;codecs=vp9,opus', 'webm'], ['video/webm;codecs=vp8,opus', 'webm'], ['video/webm', 'webm']];
    return opts.find(([m]) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || null;
  }
  async function startRecording(tileId) {
    if (!api || !api.recStart) { toast('A gravação funciona só no app do Telinha.', 'warn'); return; }
    if (REC.rec) await stopRecording();
    const tile = tileOf(tileId);
    const stream = tileId === 'self' ? S.stream : tile && tile.querySelector('video').srcObject;
    if (!stream) { toast('Não tem vídeo pra gravar aqui.', 'warn'); return; }
    const mime = pickMime();
    if (!mime) { toast('Este computador não consegue gravar vídeo.', 'error'); return; }
    let rec;
    try { rec = new MediaRecorder(stream, { mimeType: mime[0], videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 }); }
    catch (e) { toast('Não deu pra gravar: ' + e.message, 'error'); return; }
    const { id, file } = await api.recStart(mime[1]);
    Object.assign(REC, { rec, id, tileId, start: Date.now(), file, chain: Promise.resolve() });
    rec.ondataavailable = (ev) => {
      if (!ev.data || !ev.data.size) return;
      REC.chain = REC.chain.then(async () => api.recChunk(id, new Uint8Array(await ev.data.arrayBuffer())));
    };
    rec.start(1000);
    if (tile) tile.classList.add('recording');
    const ind = $('#rec-indicator');
    ind.hidden = false;
    const tick = () => {
      const t = Math.floor((Date.now() - REC.start) / 1000);
      $('#rec-time').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    };
    tick();
    REC.timer = setInterval(tick, 1000);
    log(`gravando ${tileId} em ${file} (${mime[0]})`);
    toast(`Gravando ${tileId === 'self' ? 'sua tela' : 'a tela de ' + nameOf(tileId)}…`);
  }
  async function stopRecording() {
    if (!REC.rec) return;
    const { rec, id, tileId } = REC;
    REC.rec = null;
    clearInterval(REC.timer);
    $('#rec-indicator').hidden = true;
    const t = tileOf(tileId);
    if (t) t.classList.remove('recording');
    await new Promise((res) => { rec.onstop = res; try { rec.stop(); } catch { res(); } });
    await REC.chain;
    const r = await api.recStop(id);
    if (r) toastAction(`Gravação salva em Vídeos\\Telinha (${Math.max(1, Math.round(r.bytes / 1048576))} MB).`, 'Mostrar', () => api.showItem(r.file));
  }
  function toggleRecording() {
    if (REC.rec) { stopRecording(); return; }
    if (!S.peer) { toast('Entre numa sala pra gravar.', 'warn'); return; }
    const remote = document.querySelector('.tile:not(.self)');
    const target = S.stream ? 'self' : remote && remote.dataset.id;
    if (!target) { toast('Não tem nenhuma tela no ar pra gravar.', 'warn'); return; }
    startRecording(target);
  }

  // ------------------------------------------------------------ modo cinema
  function enterCinema(tileId) {
    const tile = tileOf(tileId);
    if (!tile) return;
    document.querySelectorAll('.tile.cinema-main').forEach((t) => t.classList.remove('cinema-main'));
    tile.classList.add('cinema-main');
    document.body.classList.add('cinema');
    $('#cinema-name').textContent = tileId === 'self' ? 'Você' : nameOf(tileId);
    if (api && api.setFullscreen) api.setFullscreen(true);
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  function exitCinema() {
    if (!document.body.classList.contains('cinema')) return;
    document.body.classList.remove('cinema');
    document.querySelectorAll('.tile.cinema-main').forEach((t) => t.classList.remove('cinema-main'));
    if (api && api.setFullscreen) api.setFullscreen(false);
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  function cinemaChat(name, text, color) {
    const box = $('#cinema-msgs');
    if (!box) return;
    const d = el('div', 'cmsg');
    const b = el('b', null, name);
    if (color) b.style.color = color;
    d.append(b, el('span', null, text));
    box.append(d);
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => d.classList.add('old'), 9000);
  }

  // ------------------------------------------------------------ atalhos
  function quickShare() {
    let last = null;
    try { last = JSON.parse(store.get('telinha.lastSel') || 'null'); } catch { /* */ }
    if (last && last.id) { startShare({ ...last }); toast('Transmitindo (Ctrl+Shift+F9 pra parar).'); }
    else openPicker();
  }
  function onHotkey(a) {
    if (a === 'invite') { copyInvite(); return; }
    if (a === 'record') { toggleRecording(); return; }
    if (a === 'mic') { if (typeof toggleMic === 'function') toggleMic(); return; }
    if (a === 'share') {
      if (!S.peer) { toast('Entre numa sala primeiro.', 'warn'); return; }
      if (S.stream) { stopShare(); toast('Transmissão encerrada.'); } else quickShare();
    }
  }

  // ------------------------------------------------------------ reações
  const REACTIONS = ['🔥', '😂', '👏', '😮', '❤️', '💀'];
  let reactTimes = [];
  function sendReaction(e) {
    const now = Date.now();
    reactTimes = reactTimes.filter((t) => now - t < 1500);
    if (reactTimes.length >= 5) return; // sem spam
    reactTimes.push(now);
    broadcast({ t: 'react', e });
    showReaction(e, S.name);
  }
  function showReaction(e, who) {
    if (!SET.reactions()) return;
    const layer = $('#reactions');
    if (!layer) return;
    const r = el('div', 'reaction');
    r.append(el('span', 'reaction-emoji', e), el('span', 'reaction-name', who || ''));
    r.style.left = `${8 + Math.random() * 84}%`;
    r.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 120)}px`);
    r.style.setProperty('--dur', `${2.6 + Math.random() * 1.2}s`);
    layer.append(r);
    SET.play('react');
    setTimeout(() => r.remove(), 4200);
  }

  // ------------------------------------------------------------- vídeos
  const tileOf = (id) => document.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);
  const nameOf = (id) => (S.members.get(id) || {}).name || '…';

  function toggleFs(tile) {
    if (document.fullscreenElement) document.exitFullscreen();
    else tile.requestFullscreen().catch(() => {});
  }

  function showTile(id, stream, isSelf) {
    let tile = tileOf(id);
    if (!tile) {
      tile = el('div', 'tile' + (isSelf ? ' self' : ''));
      tile.dataset.id = id;
      const video = el('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = isSelf; // sua própria prévia fica muda (sem eco)

      const bar = el('div', 'tile-bar');
      bar.append(el('span', 'live', 'AO VIVO'), el('span', 'tile-name', isSelf ? 'Você' : nameOf(id)));

      // Camada de rabiscos (todo vídeo tem; só quem assiste desenha)
      const dl = el('canvas', 'draw-layer');
      tile.append(dl);
      tile._layer = window.TelinhaDraw ? TelinhaDraw.layer(dl, () => contentRect(tile, dl), { labels: true }) : null;
      if (!isSelf) setupDrawing(tile, dl, id);

      const ctrls = el('div', 'tile-ctrls');
      if (!isSelf) {
        const vol = el('button', 'icon-btn');
        vol.title = 'Som';
        vol.innerHTML = ICON.vol;
        vol.onclick = (e) => {
          e.stopPropagation();
          video.muted = !video.muted;
          vol.innerHTML = video.muted ? ICON.mute : ICON.vol;
          vol.classList.toggle('off', video.muted);
        };
        ctrls.append(vol);
      }
      if (isSelf) {
        // Prévia da própria tela: desligada por padrão. Desenhar a própria
        // captura a 60 fps pesa no PC e cria o "túnel infinito" pros amigos.
        const off = el('div', 'self-off');
        off.innerHTML = `<div class="self-off-icon">${ICON.screen}</div>`;
        off.append(
          el('strong', null, 'Você está transmitindo'),
          el('span', 'muted', 'A prévia fica desligada pra não pesar no PC.'),
        );
        const show = el('button', 'btn small', 'Mostrar prévia');
        show.onclick = (e) => { e.stopPropagation(); setPreview(true); };
        off.append(show);
        tile.append(off);
        const eye = el('button', 'icon-btn eye');
        eye.title = 'Esconder prévia';
        eye.innerHTML = ICON.eyeOff;
        eye.onclick = (e) => { e.stopPropagation(); setPreview(false); };
        ctrls.append(eye);
      }
      if (api && api.recStart) {
        const rb = el('button', 'icon-btn rec-btn');
        rb.title = 'Gravar este vídeo (Ctrl+Shift+F10)';
        rb.innerHTML = ICON.rec;
        rb.onclick = (e) => { e.stopPropagation(); if (REC.rec && REC.tileId === id) stopRecording(); else startRecording(id); };
        ctrls.append(rb);
      }
      if (!isSelf) {
        const pb = el('button', 'icon-btn pen-btn');
        pb.title = 'Desenhar na tela dele';
        pb.innerHTML = ICON.pen;
        pb.onclick = (e) => { e.stopPropagation(); toggleDrawing(tile); };
        ctrls.append(pb);
      }
      if (!isSelf) {
        const rb2 = el('button', 'icon-btn rc-btn');
        rb2.title = 'Pedir pra controlar o PC dele (mouse e teclado)';
        rb2.innerHTML = ICON.mouse;
        rb2.onclick = (e) => { e.stopPropagation(); rcAsk(id); };
        ctrls.append(rb2);
      }
      if (!isSelf && document.pictureInPictureEnabled) {
        const pip = el('button', 'icon-btn pip-btn');
        pip.title = 'Janelinha flutuante (fica por cima de tudo)';
        pip.innerHTML = ICON.pip;
        pip.onclick = (e) => { e.stopPropagation(); togglePip(id); };
        ctrls.append(pip);
      }
      const cin = el('button', 'icon-btn');
      cin.title = 'Modo cinema';
      cin.innerHTML = ICON.cinema;
      cin.onclick = (e) => { e.stopPropagation(); enterCinema(id); };
      ctrls.append(cin);
      const fs = el('button', 'icon-btn');
      fs.title = 'Tela cheia (ou dois cliques no vídeo)';
      fs.innerHTML = ICON.full;
      fs.onclick = (e) => { e.stopPropagation(); toggleFs(tile); };
      ctrls.append(fs);

      tile.prepend(video);
      tile.append(bar, ctrls);
      tile.addEventListener('dblclick', () => toggleFs(tile));
      if (isSelf) $('#stage').append(tile);
      else $('#stage').insertBefore(tile, tileOf('self'));
    }
    const video = tile.querySelector('video');
    if (isSelf) {
      tile._stream = stream;
      applyPreview(tile);
    } else {
      if (video.srcObject !== stream) video.srcObject = stream;
      video.play().catch(() => {});
    }
    renderStage();
  }

  // ------------------------------------------------------------ controle remoto
  // Quem assiste pede; quem transmite aceita (ou não). O mouse e o teclado de quem
  // controla vão pelo canal de dados e o Telinha de quem transmite repete no PC dele.
  const RC = { can: false, host: null, view: null, asking: new Set() };
  if (api && api.rcAvailable) api.rcAvailable().then((v) => { RC.can = !!v; }).catch(() => {});
  if (api && api.onRcHotkeyStop) api.onRcHotkeyStop(() => rcHostStop('Ctrl+Shift+F12', true));

  // ---- lado de quem transmite
  async function rcAsked(m) {
    const no = (why) => send(m.conn, { t: 'rc-no', why });
    if (!RC.can || !api || !api.rcStart) return no('indisponivel');
    if (!S.stream || !S.shareOpts) return no('sem-tela');
    if (SET.get && SET.get('remoteAllow') === false) return no('desligado');
    if (RC.host) return no(RC.host.id === m.id ? 'ja' : 'ocupado');
    if (RC.asking.has(m.id)) return;
    RC.asking.add(m.id);
    SET.play && SET.play('join');
    if (api.notify && !document.hasFocus()) api.notify('Controle remoto', `${m.name} quer controlar seu PC`);
    const yes = await confirmBox(`${m.name} quer controlar seu PC`,
      `Ele vai poder mexer no mouse e no teclado da tela que você está transmitindo. Você para quando quiser no botão "Parar" ou com Ctrl+Shift+F12.`,
      'Deixar');
    RC.asking.delete(m.id);
    if (!S.members.has(m.id)) return;
    if (!yes) return no('recusou');
    if (!S.stream || !S.shareOpts) return no('sem-tela');
    if (RC.host) return no('ocupado');
    const r = await api.rcStart({ id: S.shareOpts.id, name: S.shareOpts.name }).catch((e) => ({ error: e.message }));
    if (!r || !r.ok) { toast('Não deu pra ligar o controle remoto' + (r && r.error ? ` (${r.error})` : '') + '.', 'warn'); return no('erro'); }
    RC.host = { id: m.id, name: m.name };
    send(m.conn, { t: 'rc-ok' });
    addSystem(`${m.name} está controlando seu PC.`);
    log('controle remoto: ' + short(m.id) + ' controlando');
    rcBanner();
  }
  function rcHostStop(reason, fromMain) {
    if (!RC.host) return;
    const h = RC.host;
    RC.host = null;
    if (api && api.rcStop && !fromMain) api.rcStop();
    const m = S.members.get(h.id);
    if (m) send(m.conn, { t: 'rc-end' });
    addSystem(`Controle remoto encerrado (${reason}).`);
    rcBanner();
  }
  function rcBanner() {
    let b = $('#rc-banner');
    if (!RC.host) { if (b) b.remove(); return; }
    if (!b) {
      b = el('div', 'rc-banner');
      b.id = 'rc-banner';
      document.body.append(b);
    }
    b.textContent = '';
    b.append(el('span', 'rc-dot'), el('span', null, `${RC.host.name} está controlando seu PC · Ctrl+Shift+F12 para`));
    const stop = el('button', 'btn small danger', 'Parar');
    stop.onclick = () => rcHostStop('você parou');
    b.append(stop);
  }
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
  function rcEvent(m, ev) {
    if (!RC.host || RC.host.id !== m.id || !api || !api.rcInput) return;
    switch (ev.e) {
      case 'm': { const x = num(ev.x, 0, 1), y = num(ev.y, 0, 1); if (x !== null && y !== null) api.rcInput(`m ${x.toFixed(5)} ${y.toFixed(5)}`); break; }
      case 'd': case 'u': { const b = num(ev.b, 0, 2); if (b !== null) api.rcInput(`${ev.e} ${b | 0}`); break; }
      case 'w': case 'h': { const d = num(ev.d, -20, 20); if (d !== null && d !== 0) api.rcInput(`${ev.e} ${(Math.round(d * 100) / 100)}`); break; }
      case 'k': { const sc = num(ev.sc, 1, 127); if (sc !== null) api.rcInput(`k ${sc | 0} ${ev.x ? 1 : 0} ${ev.dn ? 1 : 0}`); break; }
      case 'r': api.rcInput('r'); break;
      default: break;
    }
  }

  // ---- lado de quem assiste
  function rcAsk(id) {
    const m = S.members.get(id);
    if (!m) return;
    if (RC.view && RC.view.id === id) { rcViewStop(false); return; }
    if (!m.rc) { toast(`O Telinha de ${m.name} não tem controle remoto (precisa do Telinha 4.1 no Windows).`, 'warn'); return; }
    if (RC.view) rcViewStop(false);
    RC.view = { id, on: false };
    send(m.conn, { t: 'rc-ask' });
    toast(`Pedido enviado. Esperando ${m.name} aceitar…`);
    rcPaint();
  }
  function rcRefused(m, why) {
    if (!RC.view || RC.view.id !== m.id) return;
    RC.view = null;
    rcPaint();
    const txt = {
      recusou: `${m.name} não deixou agora.`, ocupado: `Outra pessoa já está controlando o PC de ${m.name}.`,
      desligado: `${m.name} desligou o controle remoto nas configurações.`, 'sem-tela': `${m.name} não está transmitindo a tela.`,
      indisponivel: `O Telinha de ${m.name} não tem controle remoto.`, erro: `Não deu pra ligar o controle remoto no PC de ${m.name}.`,
    }[why] || `${m.name} não deixou.`;
    toast(txt, 'warn');
  }
  function rcViewStart(m) {
    if (!RC.view || RC.view.id !== m.id) return;
    RC.view.on = true;
    RC.view.keys = new Set();
    RC.view.btns = new Set();
    rcPaint();
    toast(`Você está controlando o PC de ${m.name}. Pra soltar: botão "Soltar" ou Ctrl+Shift+F12.`);
  }
  function rcEnded(m) {
    if (RC.host && RC.host.id === m.id) { rcHostStop(`${m.name} soltou`); return; }
    if (RC.view && RC.view.id === m.id) { RC.view = null; rcPaint(); toast(`${m.name} parou o controle remoto.`); }
  }
  function rcViewStop(quiet) {
    if (!RC.view) return;
    const v = RC.view;
    RC.view = null;
    const m = S.members.get(v.id);
    if (m) { if (v.on) send(m.conn, { t: 'rc-ev', e: 'r' }); send(m.conn, { t: 'rc-end' }); }
    rcPaint();
    if (!quiet) toast('Você soltou o controle.');
  }
  function rcOnDrop(id) {
    if (RC.host && RC.host.id === id) rcHostStop('a pessoa saiu');
    if (RC.view && RC.view.id === id) { RC.view = null; rcPaint(); }
  }
  function rcSend(ev) {
    if (!RC.view || !RC.view.on) return;
    const m = S.members.get(RC.view.id);
    if (m) send(m.conn, { t: 'rc-ev', ...ev });
  }
  function rcPaint() {
    document.querySelectorAll('.tile.rc-on, .tile.rc-wait').forEach((t) => { t.classList.remove('rc-on', 'rc-wait'); const b = t.querySelector('.rc-bar'); if (b) b.remove(); });
    if (!RC.view) return;
    const tile = tileOf(RC.view.id);
    if (!tile) return;
    tile.classList.add(RC.view.on ? 'rc-on' : 'rc-wait');
    if (RC.view.on) {
      const bar = el('div', 'rc-bar');
      bar.append(el('span', null, `🖱️ Controlando o PC de ${nameOf(RC.view.id)}`));
      const rel = el('button', 'btn small', 'Soltar');
      rel.onclick = (e) => { e.stopPropagation(); rcViewStop(false); };
      bar.append(rel);
      tile.append(bar);
    }
  }
  // posição do mouse dentro da imagem (o vídeo fica "contain": pode ter faixas pretas)
  function rcPoint(video, e) {
    const r = video.getBoundingClientRect();
    const vw = video.videoWidth || r.width, vh = video.videoHeight || r.height;
    const sc = Math.min(r.width / vw, r.height / vh);
    const w = vw * sc, h = vh * sc;
    const ox = r.left + (r.width - w) / 2, oy = r.top + (r.height - h) / 2;
    const x = (e.clientX - ox) / w, y = (e.clientY - oy) / h;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: Math.round(x * 1e5) / 1e5, y: Math.round(y * 1e5) / 1e5 };
  }
  const rcVideo = (e) => {
    if (!RC.view || !RC.view.on) return null;
    const tile = e.target.closest && e.target.closest('.tile');
    if (!tile || tile.dataset.id !== RC.view.id) return null;
    if (e.target.closest('.tile-ctrls, .rc-bar, .tile-bar, button')) return null;
    return tile.querySelector('video');
  };
  let rcMove = null;
  document.addEventListener('pointermove', (e) => {
    const v = rcVideo(e);
    if (!v) return;
    const p = rcPoint(v, e);
    if (!p) return;
    if (!rcMove) requestAnimationFrame(() => { if (rcMove) rcSend({ e: 'm', ...rcMove }); rcMove = null; });
    rcMove = p;
  }, true);
  document.addEventListener('pointerdown', (e) => {
    const v = rcVideo(e);
    if (!v) return;
    const p = rcPoint(v, e);
    if (!p) return;
    e.preventDefault(); e.stopPropagation();
    const b = e.button === 2 ? 1 : e.button === 1 ? 2 : 0;
    rcSend({ e: 'm', ...p });
    rcSend({ e: 'd', b });
    RC.view.btns.add(b);
    try { e.target.setPointerCapture(e.pointerId); } catch { /* */ }
  }, true);
  document.addEventListener('pointerup', (e) => {
    if (!RC.view || !RC.view.on || !RC.view.btns) return;
    const b = e.button === 2 ? 1 : e.button === 1 ? 2 : 0;
    if (!RC.view.btns.has(b)) return;
    RC.view.btns.delete(b);
    rcSend({ e: 'u', b });
  }, true);
  for (const t of ['dblclick', 'click', 'mousedown']) document.addEventListener(t, (e) => { if (rcVideo(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener('contextmenu', (e) => { if (rcVideo(e)) e.preventDefault(); }, true);
  document.addEventListener('wheel', (e) => {
    const v = rcVideo(e);
    if (!v) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 1 / 3 : e.deltaMode === 2 ? 3 : 1 / 100;
    if (e.deltaY) rcSend({ e: 'w', d: Math.max(-20, Math.min(20, -e.deltaY * unit)) });
    if (e.deltaX) rcSend({ e: 'h', d: Math.max(-20, Math.min(20, e.deltaX * unit)) });
  }, { capture: true, passive: false });
  // teclado: vai pelo scancode (a posição da tecla), então funciona em qualquer layout (ABNT2 também)
  const SCAN = {
    Escape: 1, Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6, Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10, Digit0: 11, Minus: 12, Equal: 13, Backspace: 14,
    Tab: 15, KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19, KeyT: 20, KeyY: 21, KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25, BracketLeft: 26, BracketRight: 27, Enter: 28,
    ControlLeft: 29, KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34, KeyH: 35, KeyJ: 36, KeyK: 37, KeyL: 38, Semicolon: 39, Quote: 40, Backquote: 41,
    ShiftLeft: 42, Backslash: 43, KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47, KeyB: 48, KeyN: 49, KeyM: 50, Comma: 51, Period: 52, Slash: 53, ShiftRight: 54,
    NumpadMultiply: 55, AltLeft: 56, Space: 57, CapsLock: 58, F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66, F9: 67, F10: 68,
    NumLock: 69, ScrollLock: 70, Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74, Numpad4: 75, Numpad5: 76, Numpad6: 77, NumpadAdd: 78,
    Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad0: 82, NumpadDecimal: 83, IntlBackslash: 86, F11: 87, F12: 88, IntlRo: 115, NumpadComma: 126,
  };
  const SCAN_EXT = {
    NumpadEnter: 28, ControlRight: 29, NumpadDivide: 53, PrintScreen: 55, AltRight: 56, Home: 71, ArrowUp: 72, PageUp: 73, ArrowLeft: 75,
    ArrowRight: 77, End: 79, ArrowDown: 80, PageDown: 81, Insert: 82, Delete: 83, MetaLeft: 91, MetaRight: 92, ContextMenu: 93,
  };
  function rcKey(e, dn) {
    if (!RC.view || !RC.view.on) return;
    if (dn && e.ctrlKey && e.shiftKey && e.code === 'F12') { e.preventDefault(); rcViewStop(false); return; }
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return; // digitando no chat
    const sc = SCAN[e.code] || SCAN_EXT[e.code];
    if (!sc) return;
    e.preventDefault(); e.stopPropagation();
    const id = e.code;
    if (dn) RC.view.keys.add(id); else if (!RC.view.keys.delete(id)) return;
    rcSend({ e: 'k', sc, x: SCAN_EXT[e.code] ? 1 : 0, dn: dn ? 1 : 0 });
  }
  window.addEventListener('keydown', (e) => rcKey(e, true), true);
  window.addEventListener('keyup', (e) => rcKey(e, false), true);
  // trocou de janela no meio: solta o que estava apertado
  window.addEventListener('blur', () => {
    if (!RC.view || !RC.view.on) return;
    for (const code of RC.view.keys) rcSend({ e: 'k', sc: SCAN[code] || SCAN_EXT[code], x: SCAN_EXT[code] ? 1 : 0, dn: 0 });
    RC.view.keys.clear();
    for (const b of RC.view.btns) rcSend({ e: 'u', b });
    RC.view.btns.clear();
  });

  // ------------------------------------------------------------ janelinha flutuante
  // Usa o picture-in-picture do Chromium: janela pequena, redimensionável e sempre por cima.
  async function togglePip(id) {
    const tile = tileOf(id);
    const video = tile && tile.querySelector('video');
    if (!video) return;
    try {
      if (document.pictureInPictureElement === video) { await document.exitPictureInPicture(); return; }
      if (!video.srcObject) return;
      await video.play().catch(() => {});
      await video.requestPictureInPicture();
      log('janelinha flutuante: ' + nameOf(id));
    } catch (e) { toast('Não deu pra abrir a janelinha: ' + e.message, 'warn'); }
  }
  // o processo principal chama isto (com "gesto do usuário") quando a janela é minimizada
  window.__telinhaAutoPip = async () => {
    if ((SET.get && SET.get('pipOnMinimize') === false) || document.pictureInPictureElement) return false;
    const tiles = [...document.querySelectorAll('.tile')].filter((t) => t.dataset.id !== 'self' && t.querySelector('video') && t.querySelector('video').srcObject);
    const main = tiles.find((t) => t.classList.contains('cinema-main')) || tiles[0];
    if (!main) return false;
    try { await main.querySelector('video').requestPictureInPicture(); S.autoPip = true; return true; } catch { return false; }
  };
  window.__telinhaAutoPipEnd = async () => {
    if (!S.autoPip) return;
    S.autoPip = false;
    if (document.pictureInPictureElement) await document.exitPictureInPicture().catch(() => {});
  };

  function previewOn() { return store.get('telinha.preview') === '1'; }
  function applyPreview(tile) {
    const on = previewOn();
    const video = tile.querySelector('video');
    tile.classList.toggle('preview-off', !on);
    if (on) {
      if (video.srcObject !== tile._stream) video.srcObject = tile._stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null; // não desenha nada: zero custo
    }
  }
  function setPreview(on) {
    store.set('telinha.preview', on ? '1' : '0');
    const t = tileOf('self');
    if (t) applyPreview(t);
    updateGdiPause();
  }

  function removeTile(id) {
    const tile = tileOf(id);
    if (!tile) return;
    if (REC.rec && REC.tileId === id) stopRecording();
    if (RC.view && RC.view.id === id) rcViewStop(true);
    if (tile.classList.contains('cinema-main')) exitCinema();
    if (document.fullscreenElement === tile) document.exitFullscreen().catch(() => {});
    const v = tile.querySelector('video');
    if (v && document.pictureInPictureElement === v) document.exitPictureInPicture().catch(() => {});
    if (v) v.srcObject = null;
    tile.remove();
    renderStage();
  }

  function updateTileName(id) {
    const t = tileOf(id);
    if (t) t.querySelector('.tile-name').textContent = nameOf(id);
  }

  function renderStage() {
    syncDiscord();
    const n = document.querySelectorAll('#stage .tile').length;
    $('#stage').dataset.count = String(Math.min(n, 6));
    $('#empty').classList.toggle('hidden', n > 0);
  }

  // --------------------------------------------------------------- lateral
  // ------------------------------------------------------- como cada pessoa está conectada
  // Lê o par de caminhos que o WebRTC escolheu na ligação de dados com cada um:
  //   VPN = pelo ZeroTier/Radmin · Rede local = mesma casa · Direto = internet · Repasse = TURN
  const ipv4 = (a) => (/^\d+\.\d+\.\d+\.\d+$/.test(a || '') ? a : '');
  function isVpnIp(a) {
    if (!a) return false;
    if (VPN.ip && a === VPN.ip) return true;
    if (VPN.ip && a.split('.').slice(0, 3).join('.') === VPN.ip.split('.').slice(0, 3).join('.')) return true;
    return /^26\./.test(a); // Radmin VPN
  }
  async function linkInfo(m) {
    const pc = m.conn && m.conn.peerConnection;
    if (!pc || !pc.getStats) return null;
    let stats;
    try { stats = await pc.getStats(); } catch { return null; }
    let pair = null;
    stats.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId) || pair; });
    if (!pair) stats.forEach((r) => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || !pair)) pair = r; });
    if (!pair) return null;
    const lc = stats.get(pair.localCandidateId) || {};
    const rc = stats.get(pair.remoteCandidateId) || {};
    const types = [lc.candidateType, rc.candidateType];
    const la = ipv4(lc.address || lc.ip), ra = ipv4(rc.address || rc.ip);
    let kind = 'Direto';
    if (types.includes('relay')) kind = 'Repasse';
    else if (isVpnIp(la) || isVpnIp(ra)) kind = 'VPN';
    else if (lc.candidateType === 'host' && rc.candidateType === 'host') kind = 'Rede local';
    const ping = typeof pair.currentRoundTripTime === 'number' ? Math.round(pair.currentRoundTripTime * 1000) : null;
    return { kind, ping, detail: `${lc.candidateType || '?'} ${la || ''} ⇄ ${rc.candidateType || '?'} ${ra || ''}`.trim() };
  }
  async function refreshLinks() {
    if (!S.peer) return;
    for (const m of S.members.values()) {
      const info = await linkInfo(m);
      if (info && (!m.link || m.link.kind !== info.kind)) log(`ligação com ${short(m.id)}: ${info.kind} (${info.detail})`);
      m.link = info;
      const chip = document.querySelector(`.member[data-id="${CSS.escape(m.id)}"] .link-chip`);
      if (chip) paintLink(chip, info);
    }
  }
  function paintLink(chip, info) {
    if (!info) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.textContent = info.kind + (info.ping != null ? ` · ${info.ping} ms` : '');
    chip.className = 'link-chip ' + (info.ping == null ? '' : info.ping < 70 ? 'good' : info.ping < 160 ? 'mid' : 'bad');
    chip.title = { VPN: 'Conectado pela VPN do Telinha', 'Rede local': 'Na mesma rede (mesma casa)', Direto: 'Ligação direta pela internet', Repasse: 'Passando pelo servidor de repasse (pode ficar mais lento)' }[info.kind] + `\n${info.detail}`;
  }
  setInterval(refreshLinks, 3000);

  // ------------------------------------------------------- controles do dono
  function setOwner(id, silent) {
    if (!id || id === S.owner) return;
    S.owner = id;
    const name = id === myId() ? 'Você' : ((S.members.get(id) || {}).name || 'Alguém');
    if (!silent || id === myId()) addSystem(id === myId() ? 'Agora você é o dono da sala.' : `${name} agora é o dono da sala.`);
    renderMembers();
  }
  function kickedOut() {
    toast('Você foi removido da sala pelo dono.', 'error');
    leaveRoom();
    lobbyMsg('Você foi removido da sala pelo dono.');
  }
  function ownerAction(kind, id) {
    const m = S.members.get(id);
    if (!m || !iAmOwner()) return;
    if (kind === 'mute') { send(m.conn, { t: 'mute' }); toast(`Pedi pro microfone de ${m.name} mutar.`); }
    if (kind === 'owner') { broadcast({ t: 'owner', id }); setOwner(id); }
    if (kind === 'kick') {
      broadcast({ t: 'kick', id });
      if (S.isHost && m.conn && m.conn._cid) S.banned.add(m.conn._cid);
      S.admitted.delete(id);
      addSystem(`${m.name} foi removido.`);
      const c = m.conn;
      setTimeout(() => { dropMember(id, c, true); try { c.close(); } catch { /* */ } }, 300);
    }
  }
  function memberMenu(btn, id) {
    document.querySelectorAll('.member-menu').forEach((x) => x.remove());
    const m = S.members.get(id);
    if (!m) return;
    const menu = el('div', 'member-menu');
    const item = (label, kind, danger) => {
      const b = el('button', danger ? 'danger' : '', label);
      b.type = 'button';
      b.onclick = (e) => {
        e.stopPropagation();
        menu.remove();
        if (kind === 'kick' && !confirmInline(b, `Expulsar ${m.name}?`)) return;
        ownerAction(kind, id);
      };
      menu.append(b);
    };
    item(`🔇 Mutar ${m.name}`, 'mute');
    item('👑 Passar o dono', 'owner');
    item('🚪 Expulsar', 'kick', true);
    btn.closest('.member').append(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
  }
  function confirmInline() { return true; } // o clique no menu já é a confirmação

  function renderMembers() {
    syncDiscord();
    const ul = $('#members');
    ul.textContent = '';
    const list = [
      { id: 'self', name: S.name, me: true, sharing: !!S.stream, host: iAmOwner(), prof: SET.profile(), mic: VOICE.stream ? (VOICE.muted ? 'muted' : 'on') : '' },
      ...[...S.members.values()].map((m) => ({ id: m.id, name: m.name, sharing: m.sharing, host: m.id === S.owner, prof: m.prof, mic: m.mic || '' })),
    ];
    for (const m of list) {
      const li = el('li', 'member');
      li.dataset.id = m.id;
      const av = SET.avatarEl ? SET.avatarEl(m.name, m.prof) : el('span', 'avatar', (m.name || '?').charAt(0).toUpperCase());
      if (!av.classList.contains('photo') && !av.classList.contains('emoji')) av.style.background = (m.prof && m.prof.col) || colorFor(m.name);
      const nm = el('span', 'member-name', m.name + (m.me ? ' (você)' : ''));
      if (m.prof && m.prof.col) nm.style.color = m.prof.col;
      li.append(av, nm);
      if (!m.me) {
        const chip = el('span', 'link-chip');
        const mm = S.members.get(m.id);
        paintLink(chip, mm && mm.link);
        li.append(chip);
      }
      if (m.mic) {
        const mi = el('span', 'mic-badge ' + m.mic);
        mi.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>' + (m.mic === 'muted' ? '<path d="M3 3l18 18"/>' : '') + '</svg>';
        mi.title = m.mic === 'muted' ? 'Microfone mutado' : 'Microfone ligado';
        li.append(mi);
      }
      if (m.sharing) li.append(el('span', 'badge live', 'ao vivo'));
      if (m.host) li.append(el('span', 'badge', 'dono'));
      if (!m.me && iAmOwner()) {
        const mb = el('button', 'member-more', '⋯');
        mb.type = 'button'; mb.title = 'Opções do dono';
        mb.onclick = (e) => { e.stopPropagation(); memberMenu(mb, m.id); };
        li.append(mb);
      }
      ul.append(li);
    }
    $('#count').textContent = String(list.length);
  }

  function updateShareBtn() {
    const btn = $('#share');
    btn.classList.toggle('primary', !S.stream);
    btn.classList.toggle('danger', !!S.stream);
    $('#share-label').textContent = S.stream ? 'Parar de compartilhar' : 'Compartilhar tela';
    syncTray();
  }

  function addChat(name, text, mine, color) {
    const log = $('#chat-log');
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const div = el('div', 'msg' + (mine ? ' mine' : ''));
    const b = el('b', null, name);
    if (color) b.style.color = color;
    div.append(b, el('span', null, text));
    log.append(div);
    if (atBottom || mine) log.scrollTop = log.scrollHeight;
  }
  // ------------------------------------------------------- arquivos e imagens no chat
  const FILE_MAX = 15 * 1024 * 1024;
  const IMG_TYPES = /^image\/(png|jpe?g|gif|webp|bmp)$/;
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function cleanFile(msg) {
    let data = msg.data;
    if (data instanceof Uint8Array) data = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    if (!(data instanceof ArrayBuffer) || !data.byteLength || data.byteLength > FILE_MAX) return null;
    const name = String(msg.name || 'arquivo').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'arquivo';
    const mime = String(msg.mime || '').slice(0, 60);
    return { name, mime, size: data.byteLength, data, image: IMG_TYPES.test(mime) };
  }
  async function sendFiles(files) {
    if (!S.peer) return;
    for (const file of files) {
      if (!file) continue;
      if (file.size > FILE_MAX) { toast(`"${file.name}" é maior que 15 MB. Manda por outro lugar.`, 'warn'); continue; }
      const data = await file.arrayBuffer();
      const name = file.name || (IMG_TYPES.test(file.type) ? 'print.png' : 'arquivo');
      broadcast({ t: 'file', name, mime: file.type || '', data });
      addChatFile(S.name, { name, mime: file.type || '', size: data.byteLength, data, image: IMG_TYPES.test(file.type || '') }, true, SET.profile().col);
    }
  }
  function openImage(url) {
    const box = el('div', 'lightbox');
    const img = el('img');
    img.src = url;
    box.append(img);
    box.onclick = () => box.remove();
    document.body.append(box);
  }
  function addChatFile(name, f, mine, color) {
    const log = $('#chat-log');
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const div = el('div', 'msg' + (mine ? ' mine' : ''));
    const b = el('b', null, name);
    if (color) b.style.color = color;
    const url = URL.createObjectURL(new Blob([f.data], { type: f.mime || 'application/octet-stream' }));
    div.append(b);
    if (f.image) {
      const img = el('img', 'chat-img');
      img.src = url; img.alt = f.name; img.title = 'Clique pra ampliar';
      img.onclick = () => openImage(url);
      img.onload = () => { if (atBottom || mine) log.scrollTop = log.scrollHeight; };
      const save = el('a', 'chat-file-save', 'salvar');
      save.href = url; save.download = f.name;
      div.append(img, save);
    } else {
      const a = el('a', 'chat-file', `📎 ${f.name} · ${fmtSize(f.size)}`);
      a.href = url; a.download = f.name; a.title = 'Clique pra salvar';
      div.append(a);
    }
    log.append(div);
    if (atBottom || mine) log.scrollTop = log.scrollHeight;
  }
  // aviso do Windows quando chega mensagem com o Telinha em segundo plano
  function notifyChat(from, text) {
    if (document.hasFocus()) return;
    if (api && api.notify) api.notify(`${from} no Telinha`, text);
  }

  function addSystem(text) {
    const log = $('#chat-log');
    log.append(el('div', 'msg sys', text));
    log.scrollTop = log.scrollHeight;
  }

  // ------------------------------------------------------- seletor de tela
  const picker = { tab: 'screen', sources: [], selected: null };

  // Opções de som: PC todo, sem som, ou só um programa (os que estão tocando aparecem primeiro).
  async function fillSoundOptions(audioOk) {
    const sel = $('#opt-sound');
    sel.disabled = !audioOk;
    sel.textContent = '';
    const add = (v, t) => { const o = el('option', null, t); o.value = v; sel.append(o); return o; };
    add('pc', 'Som do PC todo');
    add('none', 'Sem som');
    sel.value = audioOk ? (store.get('telinha.sound') === 'none' ? 'none' : 'pc') : 'none';
    picker.apps = [];
    if (!audioOk || !api || !api.audioApps) return;
    const apps = await api.audioApps().catch(() => []);
    picker.apps = Array.isArray(apps) ? apps : [];
    if (!picker.apps.length) return;
    const grp = el('optgroup');
    grp.label = 'Só o som de um programa';
    for (const a of picker.apps.sort((x, y) => (y.active - x.active) || String(x.title || x.exe).localeCompare(String(y.title || y.exe)))) {
      const name = (a.title || a.exe.replace(/\.exe$/i, '')).slice(0, 40);
      const o = el('option', null, `Só: ${name}${a.active ? ' 🔊' : ''}`);
      o.value = 'app:' + a.pid;
      o.title = a.exe;
      grp.append(o);
    }
    sel.append(grp);
  }
  // escolheu uma janela? se o programa dela tem som, já sugere "Só o som dele"
  async function matchWindowSound(id) {
    if (!api || !api.windowPid || !/^window:/.test(id)) return;
    const pid = await api.windowPid(id.split(':')[1]).catch(() => 0);
    const opt = pid && $(`#opt-sound option[value="app:${pid}"]`);
    if (opt) { $('#opt-sound').value = opt.value; toast(`Som: só ${opt.textContent.replace(/^Só: /, '').replace(' 🔊', '')} (dá pra trocar em "Som").`); }
  }

  async function openPicker() {
    picker.selected = null;
    picker.tab = 'screen';
    $('#picker-go').disabled = true;
    $('#picker').classList.remove('hidden');

    const audioOk = !api || api.platform === 'win32' || api.somTest;
    fillSoundOptions(audioOk);
    $('#audio-note').hidden = audioOk;
    $('#opt-kind').value = store.get('telinha.kind') || 'detail';
    $('#opt-quality').value = store.get('telinha.quality') || 'medium';

    if (api) {
      $('#sources').innerHTML = '<p class="note">Carregando telas e janelas…</p>';
      try { picker.sources = await api.getSources(); }
      catch (e) { picker.sources = []; toast('Não consegui listar as telas: ' + e.message, 'error'); }
    } else {
      picker.sources = [{ id: 'browser', name: 'Escolher na próxima janela', type: 'screen', thumb: '' }];
    }
    const firstScreen = picker.sources.find((s) => s.type === 'screen');
    if (firstScreen) picker.selected = firstScreen.id;
    renderSources();
  }

  function renderSources() {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === picker.tab));
    const box = $('#sources');
    box.textContent = '';
    const items = picker.sources.filter((s) => s.type === picker.tab);
    if (!items.length) {
      box.append(el('p', 'note', picker.tab === 'screen' ? 'Nenhuma tela encontrada.' : 'Nenhuma janela aberta pra mostrar.'));
    }
    for (const s of items) {
      const b = el('button', 'source' + (picker.selected === s.id ? ' selected' : ''));
      b.type = 'button';
      b.title = s.name;
      const thumb = el('div', 'thumb');
      if (s.thumb) thumb.style.backgroundImage = `url("${s.thumb}")`;
      else thumb.innerHTML = ICON.screen;
      b.append(thumb, el('span', 'label', s.name));
      b.onclick = () => { picker.selected = s.id; renderSources(); matchWindowSound(s.id); };
      b.ondblclick = () => { picker.selected = s.id; goPicker(); };
      box.append(b);
    }
    $('#picker-go').disabled = !picker.selected;
  }

  function closePicker() { $('#picker').classList.add('hidden'); }

  function goPicker() {
    if (!picker.selected) return;
    const src = picker.sources.find((s) => s.id === picker.selected);
    const sel = {
      id: picker.selected,
      name: src ? src.name : '',
      audio: $('#opt-sound').value === 'pc' && !$('#opt-sound').disabled,
      appPid: $('#opt-sound').value.startsWith('app:') ? Number($('#opt-sound').value.slice(4)) : 0,
      appName: $('#opt-sound').selectedOptions[0] ? $('#opt-sound').selectedOptions[0].textContent.replace(/^Só: /, '') : '',
      kind: $('#opt-kind').value,
      quality: $('#opt-quality').value,
    };
    store.set('telinha.sound', sel.appPid ? 'pc' : $('#opt-sound').value);
    store.set('telinha.kind', sel.kind);
    store.set('telinha.quality', sel.quality);
    store.set('telinha.lastSel', JSON.stringify(sel));
    closePicker();
    startShare(sel);
  }

  // ------------------------------------------------------------- eventos
  function init() {
    $('#name').value = store.get('telinha.name') || '';
    $('#name').addEventListener('input', () => {
      const v = $('#name').value.trim().slice(0, 24);
      if (v) store.set('telinha.name', v);
    });
    (($('#name').value ? $('#code') : $('#name'))).focus();

    if (api && api.openLogFolder) $('#open-log').onclick = () => api.openLogFolder();
    else $('#open-log').hidden = true;
    $('#create').onclick = () => createRoom();
    $('#join').onclick = () => joinRoom();
    const fwBtn = $('#net-warn button');
    if (fwBtn) fwBtn.onclick = fixFirewall;
    checkFirewallOnStart();
    if (WEB) {
      document.body.classList.add('web');
      const s0 = normCode(qs.get('s') || qs.get('sala') || '');
      if (validCode(s0)) setTimeout(() => openLink(s0), 300);
    }
    const vpnBtn = $('#vpn-warn button');
    if (vpnBtn) vpnBtn.onclick = setupVpn;
    checkVpnOnStart();
    setTimeout(() => checkUpdate(false), 3000);
    setTimeout(() => showWhatsNew(false), 2200); // depois da abertura animada

    // Ajuste de captura + diagnóstico + volta automática pra sala depois de reiniciar.
    if (api && api.getStartup) {
      api.getStartup().then((st) => {
        S.startup = st || {};
        if (S.startup.diagRunning) return; // o processo principal conduz o teste
        if (S.startup.compat) {
          $('#compat-label').textContent = S.startup.profileName;
          $('#compat-row').hidden = false;
          $('#compat-off').onclick = () => api.setCompat(false);
        }
        const r = S.startup.diagResult;
        if (r) {
          if (r.ok) toast(`Achei um ajuste que funciona: "${r.nome}"${r.comSom ? '' : ' (o som do PC não funcionou nele)'}. Pode compartilhar!`);
          else toast('Nenhum ajuste fez a captura funcionar neste PC. Me manda o log (botão "Abrir pasta do log").', 'error');
        }
        if (S.startup.link) setTimeout(() => openLink(S.startup.link), 300);
        if (S.startup.rejoin && $('#name').value.trim()) {
          if (S.startup.wasHost) createRoom(S.startup.rejoin);
          else { $('#code').value = fmtCode(S.startup.rejoin); joinRoom(); }
        }
      }).catch(() => { S.startup = {}; });
      $('#run-diag').onclick = () => api.startDiag(null);
    } else {
      $('#run-diag').hidden = true;
      document.querySelectorAll('.help-row > .muted').forEach((e) => { e.hidden = true; });
    }
    $('#name').addEventListener('keydown', (e) => { if (e.key === 'Enter') ($('#code').value ? joinRoom() : createRoom()); });
    $('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
    $('#code').addEventListener('input', () => {
      const c = normCode($('#code').value).slice(0, 12);
      $('#code').value = c.length > 3 ? fmtCode(c) : c;
    });

    $('#copy-code').onclick = copyInvite;
    store.set('telinha.recent', ''); // salas recentes saíram na 4.0
    document.addEventListener('telinha-profile', () => { if (S.peer) { broadcast({ t: 'profile', prof: SET.profile() }); renderMembers(); } });
    if (api && api.onOpenLink) api.onOpenLink(openLink);
    if (api && api.onHotkey) api.onHotkey(onHotkey);
    $('#rec-indicator').onclick = () => stopRecording();
    $('#mic-btn').onclick = toggleMic;
    $('#mic-btn').addEventListener('contextmenu', (e) => { e.preventDefault(); if (VOICE.stream) { micStop(); toast('Microfone desligado.'); } });
    const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
    document.addEventListener('keydown', (e) => {
      if (!VOICE.stream || micCfg().mode !== 'ptt' || e.code !== micCfg().pttKey || typing() || e.repeat) return;
      VOICE.pttDown = true; applyGate(); setSpeaking('self', true);
    });
    document.addEventListener('keyup', (e) => {
      if (e.code !== micCfg().pttKey) return;
      VOICE.pttDown = false; applyGate(); setSpeaking('self', false);
    });
    window.addEventListener('blur', () => { if (VOICE.pttDown) { VOICE.pttDown = false; applyGate(); } });
    document.addEventListener('telinha-voice-settings', () => { for (const g of VOICE.gains.values()) g.gain.value = micCfg().volume / 100; });
    document.addEventListener('telinha-mic-device', async () => { if (VOICE.stream) { micStop(true); await micStart(); } });
    $('#cinema-exit').onclick = exitCinema;
    $('#cinema-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const i = $('#cinema-input');
      const text = i.value.trim();
      if (!text) return;
      broadcast({ t: 'chat', text: text.slice(0, 500) });
      addChat(S.name, text.slice(0, 500), true, SET.profile().col);
      cinemaChat(S.name, text.slice(0, 500), SET.profile().col);
      i.value = '';
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('cinema')) exitCinema(); });
    $('#share').onclick = () => (S.stream ? stopShare() : openPicker());
    document.querySelectorAll('#react-bar button').forEach((b) => { b.onclick = () => sendReaction(b.dataset.emoji); });
    $('#leave').onclick = leaveRoom;

    // anexos: botão 📎, colar print (Ctrl+V) e arrastar arquivo pro chat
    const fileInp = $('#chat-file');
    $('#chat-attach').onclick = () => fileInp.click();
    fileInp.onchange = () => { sendFiles([...fileInp.files]); fileInp.value = ''; };
    $('#chat-input').addEventListener('paste', (e) => {
      const files = [...((e.clipboardData && e.clipboardData.files) || [])];
      if (files.length) { e.preventDefault(); sendFiles(files); }
    });
    const chatPanel = $('#chat-log').closest('.chat');
    chatPanel.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); chatPanel.classList.add('drop'); } });
    chatPanel.addEventListener('dragleave', () => chatPanel.classList.remove('drop'));
    chatPanel.addEventListener('drop', (e) => { e.preventDefault(); chatPanel.classList.remove('drop'); sendFiles([...e.dataTransfer.files]); });

    $('#chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = $('#chat-input').value.trim();
      if (!text) return;
      broadcast({ t: 'chat', text: text.slice(0, 500) });
      addChat(S.name, text.slice(0, 500), true, SET.profile().col);
      $('#chat-input').value = '';
    });

    document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => { picker.tab = t.dataset.tab; renderSources(); }; });
    $('#picker-cancel').onclick = closePicker;
    $('#picker-go').onclick = goPicker;
    $('#picker').addEventListener('mousedown', (e) => { if (e.target.id === 'picker') closePicker(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#picker').classList.contains('hidden')) closePicker(); });

    window.addEventListener('beforeunload', () => { if (S.peer) broadcast({ t: 'bye' }); });
  }

  init();
})();
