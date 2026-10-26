// Procedural ASCII eye for the "VK-7 subject scan" panel (a nod to the
// Voight-Kampff close-ups). Follows the pointer, blinks, pupil breathes.
// Purely decorative: the panel is aria-hidden.
(function () {
  // Mounts on every .eye at load; world mode calls DHRmountEye() for eyes in
  // pages it loads onto the desk monitor.
  window.DHRmountEye = function (pre, status) {
  if (!pre || pre.dataset.mounted) return;
  pre.dataset.mounted = '1';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLS = 46;
  const ROWS = 22;
  const RAMP = ' .,:;-=+*#%@';

  // Character cells are taller than wide; measure the glyph so the eye stays
  // round. Canvas metrics, so page transforms (the CRT power-on) can't skew it,
  // and again once the webfont has loaded.
  let W = COLS * 0.55; // eye width in "row heights"
  let half = W / 2;
  function measureCells() {
    const cs = getComputedStyle(pre);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontSize} ${cs.fontFamily}`;
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
    const aspect = ctx.measureText('M').width / lineH;
    W = COLS * (aspect > 0.2 && aspect < 1.2 ? aspect : 0.55);
    half = W / 2;
  }
  measureCells();
  if (document.fonts) document.fonts.ready.then(measureCells);

  let gazeX = 0, gazeY = 0;       // current (smoothed)
  let targetX = 0, targetY = 0;   // where it wants to look
  let lastPointer = 0;
  let nextBlink = performance.now() + 2500;
  let blinkStart = -1;
  let nextSaccade = 0;

  window.addEventListener('pointermove', (e) => {
    const r = pre.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
    const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
    targetX = Math.max(-1, Math.min(1, dx * 2.4));
    targetY = Math.max(-1, Math.min(1, dy * 2.4));
    lastPointer = performance.now();
  }, { passive: true });

  function openness(now) {
    if (blinkStart < 0 && now > nextBlink) blinkStart = now;
    if (blinkStart < 0) return 1;
    const t = (now - blinkStart) / 220;
    if (t >= 1) {
      blinkStart = -1;
      nextBlink = now + 3000 + Math.random() * 4500;
      if (Math.random() < .2) nextBlink = now + 260; // occasional double blink
      return 1;
    }
    return Math.abs(Math.cos(t * Math.PI)); // 1 → 0 → 1
  }

  function frame(now) {
    // idle: little saccades when the pointer has been still
    if (now - lastPointer > 2500 && now > nextSaccade) {
      targetX = (Math.random() * 2 - 1) * .7;
      targetY = (Math.random() * 2 - 1) * .4;
      nextSaccade = now + 900 + Math.random() * 1800;
    }
    gazeX += (targetX - gazeX) * .25;
    gazeY += (targetY - gazeY) * .25;

    const open = reducedMotion ? 1 : openness(now);
    const irisR = .40;
    const pupilR = .14 + .025 * Math.sin(now / 1700) + .02 * (1 - open);
    const cx = gazeX * .30;
    const cy = gazeY * .12;

    let html = '';
    for (let r = 0; r < ROWS; r++) {
      let run = '';
      let runClass = '';
      const flush = () => {
        if (!run) return;
        html += runClass ? `<span class="${runClass}">${run}</span>` : run;
        run = '';
      };
      for (let c = 0; c < COLS; c++) {
        const u = ((c + .5) * (W / COLS) - half) / half;          // -1..1 across
        const v = ((r + .5) - ROWS / 2) / half;                    // same scale down
        const edge = Math.max(0, 1 - u * u);
        const top = -.58 * Math.pow(edge, .85) * open;
        const bot = .44 * Math.pow(edge, .95) * (.35 + .65 * open);
        let b = 0;
        let cls = '';

        if (v > top && v < bot) {
          const dx = u - cx;
          const dy = v - cy;
          const d = Math.hypot(dx, dy);
          const lidDist = Math.min(v - top, bot - v);
          if (d < pupilR) {
            // pupil, with a specular highlight
            const hd = Math.hypot(dx + .06, dy + .06);
            if (hd < .045) { b = 1; cls = 'h'; } else b = 0;
          } else if (d < irisR) {
            const a = Math.atan2(dy, dx);
            const t = (d - pupilR) / (irisR - pupilR);
            const fibres = .5 + .5 * Math.sin(a * 21 + Math.sin(a * 5 + now / 4000) * 2.2 + t * 4);
            b = t > .86 ? .85 : .3 + .55 * fibres * (1 - t * .35);
            cls = 'i';
          } else {
            // sclera: dim, darker toward the corners and lids
            b = .1 + .14 * (1 - Math.abs(u)) * Math.min(1, lidDist * 6);
          }
          if (lidDist < .045) { b = Math.max(b, .55); cls = ''; }    // lid line
        } else {
          // crease above the eye and a few lashes
          const crease = Math.abs(v - (top - .16 * edge - .04));
          if (crease < .035 && edge > .15) b = .3;
          else if (v < top && v > top - .07 && edge > .25 && (c % 3 === 0)) b = .45;
        }

        const ch = RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(b * (RAMP.length - 1))))];
        if (cls !== runClass) { flush(); runClass = cls; }
        run += ch;
      }
      flush();
      html += '\n';
    }
    pre.innerHTML = html;
  }

  if (reducedMotion) { frame(performance.now()); return; }

  const STATUS = ['Pupil response: nominal', 'Iris dilation: 0.6 mm', 'Empathy response: human. Mostly.', 'Capillary flush: detected', 'Subject: probably not a replicant'];
  let statusIndex = 0;
  setInterval(() => {
    if (document.hidden || !status || !pre.isConnected) return;
    statusIndex = (statusIndex + 1) % STATUS.length;
    status.textContent = STATUS[statusIndex];
  }, 5000);

  let last = 0;
  function loop(now) {
    if (!pre.isConnected) { requestAnimationFrame(loop); return; } // parked off the monitor
    if (now - last > 66) { last = now; frame(now); } // ~15 fps is plenty for a CRT
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  };

  for (const pre of document.querySelectorAll('.eye')) {
    window.DHRmountEye(pre, pre.parentElement.querySelector('#eye-status, figcaption, .panel-label--foot span'));
  }
})();
