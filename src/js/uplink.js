// Uplink: world mode for every page. Loads world.js (three.js) in the background
// on capable devices and wires the ways out of the page: the close ✕ in the
// screen's chrome ([data-jack]), and resting on the page's edge, which shrinks
// the page into its monitor so a click on the room steps out (see "peeking").
// The flat page never depends on it: no capability,
// no bezel and no ✕ (the terminal's `exit` command prints a message instead).
(function () {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const kind = root.dataset.kind;           // 'terminal' | 'reader' | 'app' (the reading shelf)
  const place = root.dataset.place || '';   // where this page lives in the warehouse
  const listeners = [];
  const up = { state: 'offline', world: null, pending: false };

  const emit = (type, detail) => { for (const fn of listeners) fn(type, detail || {}); };

  function capable() {
    if (!place) return false;
    // Desktop only, on every page: phones and tablets never download three.js
    // and the workshop (~7 MB), and get no bezel or edge exits. Same size the
    // reading shelf's desktop layout starts at.
    if (!window.matchMedia('(min-width: 1024px) and (min-height: 560px)').matches) return false;
    try {
      if (!document.createElement('canvas').getContext('webgl2')) return false;
    } catch (e) { return false; }
    if (navigator.connection && navigator.connection.saveData) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    return true;
  }

  // ------------------------------------------------------- the saved peek
  // The room round the monitor is rendered once (world.js) and kept, so the
  // next page can show the bezel and peek straight away instead of waiting
  // for the whole room to load and render again. Keyed to this build of
  // world.js, so a deploy that changes the room renders it afresh.
  const PEEK_KEY = 'dhr-peek';
  let hasPeek = false;

  function usePeek(img, scale) {
    root.style.setProperty('--world-peek', `url("${img}")`);
    if (scale) root.style.setProperty('--peek-scale', scale);
    hasPeek = true;
  }

  function loadSavedPeek() {
    try {
      const saved = JSON.parse(localStorage.getItem(PEEK_KEY) || 'null');
      if (!saved || saved.v !== window.__dhrAssets.world) return;
      // the image is stretched to the window, so it has to be the same shape
      if (Math.abs(saved.w / saved.h - innerWidth / innerHeight) > 0.02) return;
      usePeek(saved.img, saved.scale);
    } catch (e) { /* no storage: wait for the room as before */ }
  }

  // Shrink the render to the window's own size first: a retina canvas as a
  // JPEG is too big to keep, and the room only shows round the edges.
  function savePeek(src, scale) {
    const img = new Image();
    img.onload = () => {
      try {
        const w = Math.min(innerWidth, 1920);
        const h = Math.round(w * img.height / img.width);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        localStorage.setItem(PEEK_KEY, JSON.stringify({
          v: window.__dhrAssets.world, w: innerWidth, h: innerHeight, scale,
          img: c.toDataURL('image/jpeg', 0.8),
        }));
      } catch (e) { /* full or blocked: the next page just waits */ }
    };
    img.src = src;
  }

  function setState(state, text) {
    up.state = state;
    // the bezel appears once there's a room to show behind it: the saved
    // one at once, or this page's once it has loaded
    root.classList.toggle('uplink-ready', state === 'ready' || (hasPeek && state !== 'failed'));
    if (state === 'ready' || state === 'failed') root.classList.remove('uplink-waiting');
    for (const b of document.querySelectorAll('[data-jack]')) {
      b.dataset.state = state;
      const label = b.querySelector('.jack-state');
      if (label) label.textContent = `Uplink: ${text}`;
    }
    emit('state', { state, text });
  }

  const surface = () => (kind === 'app' ? document.body : document.getElementById(kind === 'terminal' ? 'term' : 'main'));

  function start() {
    if (up.state !== 'offline' || !capable()) return;
    setState('syncing', 'syncing…');
    import(window.__dhrAssets.world)
      .then((m) => m.createWorld({
        kind,
        place,
        surface: surface(),
        reducedMotion,
        onStatus: (text) => setState('syncing', text),
        onReturn: () => emit('return'),
      }))
      .then((world) => {
        up.world = world;
        // what the bezel reveals: the room round this monitor, rendered once
        if (world.peek) {
          usePeek(world.peek, world.peekScale);
          savePeek(world.peek, world.peekScale);
        }
        setState('ready', 'ready');
        if (up.pending || location.hash === '#world') { up.pending = false; jackOut(); }
      })
      .catch((err) => {
        console.warn('world mode failed to load', err);
        setState('failed', 'lost');
        if (up.pending) { up.pending = false; emit('unavailable'); }
      });
  }

  function jackOut() {
    if (up.state === 'ready') {
      if (up.world.active) return;
      setPeek(false, true);
      emit('jackout');
      const s = surface();
      if (reducedMotion) { up.world.exit(); return; }
      // a split-second of signal tear on the flat page, then the world takes over
      s.classList.remove('is-unplugging');
      void s.offsetWidth;
      s.classList.add('is-unplugging');
      setTimeout(() => { s.classList.remove('is-unplugging'); up.world.exit(); }, 260);
    } else if (up.state === 'syncing' || (up.state === 'offline' && capable())) {
      up.pending = true;
      root.classList.add('uplink-waiting'); // clicked the saved room before the real one loaded
      emit('pending');
      start();
    } else {
      emit('unavailable');
    }
  }

  // ---------------------------------------------------------------- peeking
  // Rest the pointer on the page's edge and the page shrinks back into the
  // monitor it's on, with the room round it (world.js renders that view once:
  // --world-peek, the screen filling --peek-scale of it). Done with the
  // pointer rather than the bezel elements: those sit in <body>, which is
  // what shrinks.
  const EDGE = 8;           // px from the window edge that starts a peek
  const DWELL = 120;        // ms on the edge first, so crossing it to the tabs doesn't
  let peeking = false;
  let peekedAt = 0;
  let dwell = 0;
  const SETTLE = 500;       // ms: the page must have finished shrinking before a click steps out

  const peekScale = () => parseFloat(getComputedStyle(root).getPropertyValue('--peek-scale')) || 0.8;
  const nearEdge = (x, y) => x <= EDGE || y <= EDGE || x >= root.clientWidth - EDGE || y >= innerHeight - EDGE;
  // outside the shrunken page, i.e. over the room
  function overRoom(x, y) {
    const mx = (innerWidth * (1 - peekScale())) / 2;
    const my = (innerHeight * (1 - peekScale())) / 2;
    return x < mx || x > innerWidth - mx || y < my || y > innerHeight - my;
  }

  function setPeek(on, instant) {
    clearTimeout(dwell);
    if (on === peeking) return;
    if (on && (!hasPeek || up.state === 'failed' || (up.world && up.world.active))) return;
    peeking = on;
    if (on) {
      // shrink round the middle of the window, showing only what's on screen
      const r = document.body.getBoundingClientRect();
      root.style.setProperty('--peek-origin', `${innerWidth / 2 - r.left}px ${innerHeight / 2 - r.top}px`);
      root.style.setProperty('--peek-clip', `inset(${Math.max(0, -r.top)}px 0 ${Math.max(0, r.bottom - innerHeight)}px 0)`);
      root.classList.add('is-peek-clip', 'is-peeking');
      peekedAt = performance.now();
      start(); // someone's looking: load the real room now rather than after the idle wait
    } else {
      root.classList.remove('is-peeking');
      if (instant || reducedMotion) root.classList.remove('is-peek-clip');
    }
  }

  function watchEdges() {
    document.body.addEventListener('transitionend', (e) => {
      if (e.target === document.body && e.propertyName === 'transform' && !peeking) root.classList.remove('is-peek-clip');
    });
    window.addEventListener('mousemove', (e) => {
      const edge = nearEdge(e.clientX, e.clientY);
      if (!peeking) {
        clearTimeout(dwell);
        if (edge) dwell = setTimeout(() => setPeek(true), DWELL);
        return;
      }
      if (!edge && !overRoom(e.clientX, e.clientY)) setPeek(false);
    });
    root.addEventListener('mouseleave', () => setPeek(false));
    window.addEventListener('scroll', () => { if (peeking) setPeek(false, true); }, { passive: true });
    // The edge itself never takes a click: only once the page has shrunk and
    // the room is showing does clicking the room step out into it.
    window.addEventListener('click', (e) => {
      if (!peeking || !overRoom(e.clientX, e.clientY)) return;
      // a click that lands as the peek starts is someone reaching for the edge, not choosing to leave
      if (!reducedMotion && performance.now() - peekedAt < SETTLE) { e.preventDefault(); e.stopPropagation(); return; }
      e.preventDefault();
      e.stopPropagation();
      jackOut();
    }, true);
  }

  window.DHRUplink = {
    get state() { return up.state; },
    get world() { return up.world; },
    capable,
    start,
    jackOut,
    on(fn) { listeners.push(fn); },
  };

  function init() {
    for (const b of document.querySelectorAll('[data-jack]')) b.addEventListener('click', jackOut);
    if (!capable()) return;
    root.classList.add('has-uplink');
    loadSavedPeek();
    if (hasPeek) root.classList.add('uplink-ready');
    for (const b of document.querySelectorAll('[data-jack]')) b.hidden = false;
    watchEdges();
    if (kind === 'terminal') return; // terminal.js starts the uplink after its boot
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
    setTimeout(() => idle(start, { timeout: 3000 }), location.hash === '#world' ? 0 : 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
