// Uplink: world mode for every page. Loads world.js (three.js) in the background
// on capable devices and wires the ways out of the page: the close ✕ in the
// screen's chrome ([data-jack]) and the bezel edges ([data-jack-edge]), which
// peek at the room on hover. The flat page never depends on it: no capability,
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
    try {
      if (!document.createElement('canvas').getContext('webgl2')) return false;
    } catch (e) { return false; }
    if (navigator.connection && navigator.connection.saveData) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    return true;
  }

  function setState(state, text) {
    up.state = state;
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
        // what the bezel reveals: this page's place, rendered once
        if (world.peek) root.style.setProperty('--world-peek', `url("${world.peek}")`);
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
      root.classList.remove('is-peeking');
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
      emit('pending');
      start();
    } else {
      emit('unavailable');
    }
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
    for (const b of document.querySelectorAll('[data-jack]')) b.hidden = false;
    for (const edge of document.querySelectorAll('[data-jack-edge]')) {
      edge.addEventListener('click', jackOut);
      edge.addEventListener('pointerenter', () => root.classList.add('is-peeking'));
      edge.addEventListener('pointerleave', () => root.classList.remove('is-peeking'));
    }
    if (kind === 'terminal') return; // terminal.js starts the uplink after its boot
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
    setTimeout(() => idle(start, { timeout: 3000 }), location.hash === '#world' ? 0 : 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
