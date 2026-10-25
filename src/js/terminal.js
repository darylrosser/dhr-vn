// Terminal home: boot animation + interactive prompt. The page is complete
// without this file; everything here is an enhancement.
(function () {
  const root = document.documentElement;
  const manifest = JSON.parse(document.getElementById('site-manifest').textContent);
  const screen = document.getElementById('screen');
  const log = document.getElementById('log');
  const form = document.getElementById('prompt');
  const input = document.getElementById('prompt-input');
  const syslogEl = document.getElementById('syslog');
  const chips = document.getElementById('chips');
  const term = document.getElementById('term');
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const PS1 = '>';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const history = [];
  let historyIndex = 0;

  // ------------------------------------------------------------ boot

  // Wrap each "$ command" text so it can be typed out.
  document.querySelectorAll('.cmd').forEach((cmd) => {
    const text = cmd.lastChild;
    if (text && text.nodeType === Node.TEXT_NODE) {
      const span = document.createElement('span');
      span.className = 'cmd-text';
      span.textContent = text.textContent.trim();
      cmd.replaceChild(span, text);
    }
  });

  const steps = Array.from(document.querySelectorAll('[data-step]'));
  let skipped = false;

  const wait = (ms) => new Promise((r) => setTimeout(r, skipped ? 0 : ms));

  async function typeInto(el, text) {
    el.textContent = '';
    for (const ch of text) {
      if (skipped) break;
      el.textContent += ch;
      await wait(28 + Math.random() * 30);
    }
    el.textContent = text;
  }

  async function boot() {
    const onSkip = () => { skipped = true; };
    window.addEventListener('keydown', onSkip, { once: true });
    window.addEventListener('pointerdown', onSkip, { once: true });
    window.addEventListener('wheel', onSkip, { once: true, passive: true });

    for (const step of steps) {
      if (skipped) break;
      const cmdText = step.querySelector('.cmd-text');
      if (cmdText) {
        const full = cmdText.textContent;
        cmdText.textContent = '';
        step.classList.add('is-shown');
        // hide the output until the command is "entered"
        const outputs = Array.from(step.children).filter((c) => !c.classList.contains('cmd'));
        outputs.forEach((o) => { o.hidden = true; });
        await wait(250);
        await typeInto(cmdText, full);
        await wait(120);
        outputs.forEach((o) => { o.hidden = false; });
      } else {
        step.classList.add('is-shown');
      }
      await wait(step.classList.contains('boot') ? 350 : 200);
    }
    finishBoot();
  }

  function finishBoot() {
    steps.forEach((s) => {
      s.classList.add('is-shown');
      Array.from(s.children).forEach((c) => { c.hidden = false; });
    });
    steps.forEach((s) => s.querySelectorAll('.cmd-text').forEach((c) => { c.textContent = c.dataset.full || c.textContent; }));
    root.classList.remove('is-booting');
    window.__termBooted = true;
    try { sessionStorage.setItem('dhr-booted', '1'); } catch (e) { /* fine */ }
    showPrompt();
  }

  // Keep the original command text around in case boot is skipped mid-type.
  document.querySelectorAll('.cmd-text').forEach((c) => { c.dataset.full = c.textContent; });

  function showPrompt() {
    form.hidden = false;
    chips.hidden = false;
    syslog('Baseline complete.');
    syslog('Waiting for input…', 't-dim');
    // Load the 3D world quietly once the terminal is usable.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
    setTimeout(() => idle(uplink.start, { timeout: 3000 }), location.hash === '#world' ? 0 : 1200);
    if (finePointer) input.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ output helpers

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children.flat()) node.append(c instanceof Node ? c : document.createTextNode(c));
    return node;
  }

  const line = (...children) => el('p', { class: 'line' }, ...children);
  const dim = (t) => el('span', { class: 't-dim' }, t);
  const cmdButton = (cmd, label) => el('button', { type: 'button', class: 'linkish', onclick: () => run(cmd) }, label || cmd);

  function echo(cmd) {
    log.append(el('p', { class: 'cmd' }, el('span', { class: 'ps1' }, PS1), cmd));
  }

  function print(...nodes) {
    const block = el('div', {}, ...nodes);
    log.append(block);
    return block;
  }

  // Side panel log: decorative mirror of what the terminal is doing.
  function syslog(text, cls) {
    const p = el('p', { class: `is-new${cls ? ` ${cls}` : ''}` }, text);
    syslogEl.append(p);
    while (syslogEl.children.length > 16) syslogEl.firstElementChild.remove();
  }

  const AMBIENT = [
    'Spinner 7 departing sector 4.', 'Rain probability: 98%.', 'Off-world colonies: a new life awaits.',
    'Book budget: exceeded.', 'Chihuahua status: defective (adorable).', 'Coffee reserves: 61%.',
    'Owl in lobby: artificial.', 'Noodle bar, level 3: open.', 'Moratorium on book purchases: ignored.',
  ];
  if (!reducedMotion) setInterval(() => {
    if (!document.hidden) syslog(AMBIENT[Math.floor(Math.random() * AMBIENT.length)], 't-dim');
  }, 14000);

  function scrollToPrompt() {
    if (screen.scrollHeight > screen.clientHeight + 2) screen.scrollTo({ top: screen.scrollHeight, behavior: 'smooth' });
    else form.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  // ------------------------------------------------------------ world mode (uplink)
  // The terminal is a monitor in a 3D warehouse; uplink.js loads the world and
  // handles every "jack out" control. Here we just narrate it.

  const uplink = window.DHRUplink;

  function offlineMessage() {
    term.classList.remove('is-glitching');
    void term.offsetWidth;
    term.classList.add('is-glitching');
    syslog('Uplink: offline.', 't-warn');
    print(
      line(el('span', { class: 't-err' }, 'Uplink offline: this device can\'t run the warehouse.')),
      line(dim('Everything is still here in the terminal. Stay a while.')),
    );
  }

  uplink.on((type, d) => {
    if (type === 'state') {
      if (d.state === 'syncing' && d.text === 'syncing…') syslog('Establishing uplink…', 't-dim');
      else if (d.state === 'ready') syslog('Uplink ready.', 't-ok');
      else if (d.state === 'failed') syslog('Uplink lost.', 't-warn');
    } else if (type === 'jackout') syslog('Link severed.', 't-warn');
    else if (type === 'pending') print(line(el('span', { class: 't-warn' }, 'Establishing uplink… hold on.')));
    else if (type === 'unavailable') offlineMessage();
    else if (type === 'return') {
      syslog('Link established.', 't-ok');
      term.classList.remove('crt-on'); // its power-on already played in 3D
      if (finePointer) input.focus({ preventScroll: true });
    }
  });

  const jackOut = () => uplink.jackOut();

  // ------------------------------------------------------------ routing

  const DIRS = {
    '': '/', '~': '/', '..': '/', '/': '/', home: '/',
    blog: '/blog/', about: '/about/', contact: '/contact/',
    reading: manifest.readingUrl,
  };

  function resolve(target) {
    const t = (target || '').trim().replace(/^~?\//, '').replace(/\/$/, '').replace(/\.md$/, '').toLowerCase();
    if (t in DIRS) return { href: DIRS[t], label: t || '~' };
    const slug = t.replace(/^blog\//, '');
    const post = manifest.posts.find((p) => p.slug === slug) || manifest.posts.find((p) => p.slug.startsWith(slug) && slug.length >= 3);
    if (post) return { href: `/blog/${post.slug}/`, label: `blog/${post.slug}` };
    return null;
  }

  function go(target) {
    const r = resolve(target);
    if (!r) {
      print(line(el('span', { class: 't-err' }, `cd: no such file or directory: ${target}`)));
      return;
    }
    syslog(`Opening file: ${r.label}`);
    // on the monitor in world mode: walk over to that place instead of reloading
    if (uplink.world && uplink.world.active) { uplink.world.visit(r.href); return; }
    if (reducedMotion) { window.location.href = r.href; return; }
    // a beat of fiction before the calm reader page
    const bar = el('span', {}, '');
    print(line(el('span', { class: 'decrypt' }, `Decrypting ${r.label} `), bar));
    let i = 0;
    const tick = setInterval(() => {
      i += 1;
      bar.textContent = `[${'█'.repeat(i)}${'░'.repeat(10 - i)}] ${i * 10}%`;
      scrollToPrompt();
      if (i === 10) { clearInterval(tick); window.location.href = r.href; }
    }, 45);
  }

  function listing(target) {
    const t = (target || '').replace(/\/$/, '');
    if (t === 'blog' || t === '~/blog') {
      if (!manifest.posts.length) return print(line(dim('(empty)')));
      print(el('ul', { class: 't-list' }, manifest.posts.map((p) =>
        el('li', {}, dim(`${p.date}  ${String(p.minutes).padStart(2)}m  `), el('a', { href: `/blog/${p.slug}/` }, p.title)))));
      return;
    }
    if (t && t !== '~' && t !== '.') {
      print(line(el('span', { class: 't-err' }, `ls: ${target}: not a directory`)));
      return;
    }
    print(el('ul', { class: 't-ls' }, ['blog', 'about', 'reading', 'contact'].map((d) =>
      el('li', {}, el('a', { href: DIRS[d] }, `${d}/`)))));
  }

  // ------------------------------------------------------------ commands

  const COMMANDS = {
    help: {
      about: 'list commands',
      run() {
        const rows = Object.entries(COMMANDS).filter(([, c]) => c.about).map(([name, c]) =>
          el('div', { class: 'help-row' }, cmdButton(c.example || name, name), dim(c.about)));
        print(...rows, line(dim('everything here is also a normal link. you never have to type.')));
      },
    },
    ls: { about: 'list directories (try: ls blog)', example: 'ls blog', run: (args) => listing(args[0]) },
    cd: { about: 'open a page (cd blog, cd about …)', example: 'cd blog', run: (args) => go(args[0] || '~') },
    cat: { run: (args) => go(args[0] || '') },
    open: { run: (args) => go(args[0] || '') },
    whoami: {
      about: 'who is this guy',
      run() {
        const s = document.querySelector('[aria-labelledby="whoami-h"]');
        s.hidden = false;
        s.scrollIntoView({ behavior: 'smooth', block: 'start' });
        print(line('Daryl. SEO, books, two small dogs. Saigon.'));
      },
    },
    reading: { about: 'the bookshelf (3D)', run: () => go('reading') },
    clear: {
      about: 'clear the screen',
      run() {
        steps.forEach((s) => { s.hidden = true; });
        log.replaceChildren();
      },
    },
    date: { run: () => print(line(new Date().toString())) },
    echo: { run: (args) => print(line(args.join(' '))) },
    history: { run: () => print(...history.map((h, i) => line(dim(String(i + 1).padStart(3) + '  '), h))) },
    sudo: { run: () => print(line(el('span', { class: 't-err' }, 'daryl is not in the sudoers file. this incident will be reported (to his fiancée).'))) },
    rm: { run: () => print(line(el('span', { class: 't-warn' }, 'nice try. the books stay.'))) },
    exit: {
      about: 'jack out into the warehouse',
      run: () => jackOut(),
    },
  };
  // aliases: no `about`, so help doesn't list them
  COMMANDS.logout = { run: COMMANDS.exit.run };
  COMMANDS.jack = { run: COMMANDS.exit.run }; // "jack out"
  COMMANDS.dir = { run: COMMANDS.ls.run };
  COMMANDS.blog = { run: () => listing('blog') };
  COMMANDS.about = { run: () => go('about') };
  COMMANDS.contact = { run: () => go('contact') };

  function run(raw) {
    const cmdline = raw.trim();
    if (!cmdline) { echo(''); return; }
    history.push(cmdline);
    historyIndex = history.length;
    const [name, ...args] = cmdline.split(/\s+/);
    const cmd = COMMANDS[name.toLowerCase()];
    echo(cmdline);
    syslog(`Cmd: ${cmdline}`);
    if (cmd) cmd.run(args);
    else if (resolve(name)) go(name);
    else print(line(el('span', { class: 't-err' }, `command not found: ${name}`), dim('  (try '), cmdButton('help'), dim(')')));
    scrollToPrompt();
  }

  // ------------------------------------------------------------ input

  function completions(value) {
    const parts = value.split(/\s+/);
    if (parts.length <= 1) return Object.keys(COMMANDS).filter((c) => c.startsWith(parts[0]));
    const word = parts[parts.length - 1].toLowerCase();
    const targets = ['blog/', 'about/', 'reading/', 'contact/', ...manifest.posts.map((p) => `blog/${p.slug}`)];
    return targets.filter((t) => t.startsWith(word)).map((t) => [...parts.slice(0, -1), t].join(' '));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    run(value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex];
    } else if (e.key === 'ArrowDown' && history.length) {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
    } else if (e.key === 'Tab' && input.value) {
      const options = completions(input.value);
      if (options.length) {
        e.preventDefault();
        if (options.length === 1) input.value = options[0] + (options[0].includes(' ') ? '' : ' ');
        else print(line(dim(options.join('   '))));
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      COMMANDS.clear.run();
    }
  });

  chips.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cmd]');
    if (b) run(b.dataset.cmd);
  });

  // Typing anywhere on the page goes to the prompt (but never steals from links / buttons).
  window.addEventListener('keydown', (e) => {
    if (form.hidden || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    const a = document.activeElement;
    if (a === input || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    input.focus({ preventScroll: true });
  });

  // ------------------------------------------------------------ go

  if (root.classList.contains('is-booting')) boot();
  else finishBoot();
})();
