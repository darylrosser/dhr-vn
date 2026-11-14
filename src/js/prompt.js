// The command line in the site header: `dhr.vn:~/blog $ ▮` takes commands on
// every page. Output drops down in a panel under the bar. Everything it does
// is also a normal link, so the site never needs it.
//   typing   goes straight to the prompt (keyboard + mouse devices)
//   /        focus the prompt (from anywhere on the page)
//   Esc      close the output and leave the prompt
(function () {
  const form = document.getElementById('bar-form');
  const input = document.getElementById('bar-input');
  const out = document.getElementById('bar-out');
  if (!form || !input || !out) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const history = [];
  let historyIndex = 0;
  let manifest = null;

  // a one-space placeholder, so CSS can tell "empty" (:placeholder-shown) and keep the block cursor
  input.hidden = false;
  input.placeholder = ' ';

  // posts for `ls blog` / `cd <post>`, fetched the first time they're needed
  async function site() {
    if (manifest) return manifest;
    try { manifest = await (await fetch('/site.json')).json(); } catch (e) { manifest = { posts: [], readingUrl: '/reading/' }; }
    return manifest;
  }

  // ------------------------------------------------------------ output

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
  const err = (t) => el('span', { class: 't-err' }, t);
  const cmdButton = (cmd, label) => el('button', { type: 'button', class: 'linkish', onclick: () => run(cmd) }, label || cmd);

  function open() { out.hidden = false; }
  function close() { out.hidden = true; }
  function print(...nodes) {
    open();
    out.append(el('div', { class: 'out' }, ...nodes));
    out.scrollTop = out.scrollHeight;
  }
  const echo = (cmd) => print(line(el('span', { class: 'ps1' }, '$'), ` ${cmd}`));

  // ------------------------------------------------------------ routing

  const uplink = () => window.DHRUplink;

  async function resolve(target) {
    const m = await site();
    const dirs = {
      '': '/', '~': '/', '..': '/', '/': '/', home: '/',
      blog: '/blog/', about: '/about/', contact: '/contact/', reading: m.readingUrl, stats: '/reading/stats',
    };
    const t = (target || '').trim().replace(/^~?\//, '').replace(/\/$/, '').replace(/\.md$/, '').toLowerCase();
    if (t in dirs) return { href: dirs[t], label: t || '~' };
    const slug = t.replace(/^blog\//, '');
    const post = m.posts.find((p) => p.slug === slug) || m.posts.find((p) => p.slug.startsWith(slug) && slug.length >= 3);
    if (post) return { href: `/blog/${post.slug}/`, label: `blog/${post.slug}` };
    return null;
  }

  async function go(target) {
    const r = await resolve(target);
    if (!r) { print(line(err(`cd: no such file or directory: ${target}`))); return; }
    const u = uplink();
    if (u && u.world && u.world.active) { u.world.visit(r.href); return; }
    if (reducedMotion) { window.location.href = r.href; return; }
    const bar = el('span', {}, '');
    print(line(dim(`opening ${r.label} `), bar));
    let i = 0;
    const tick = setInterval(() => {
      i += 1;
      bar.textContent = `[${'█'.repeat(i)}${'░'.repeat(10 - i)}]`;
      if (i === 10) { clearInterval(tick); window.location.href = r.href; }
    }, 35);
  }

  async function listing(target) {
    const t = (target || '').replace(/\/$/, '');
    if (t === 'blog' || t === '~/blog') {
      const m = await site();
      if (!m.posts.length) { print(line(dim('(empty)'))); return; }
      print(...m.posts.map((p) => line(dim(`${p.date}  ${String(p.minutes).padStart(2)}m  `), el('a', { href: `/blog/${p.slug}/` }, p.title))));
      return;
    }
    if (t && t !== '~' && t !== '.') { print(line(err(`ls: ${target}: not a directory`))); return; }
    const m = await site();
    const dirs = { blog: '/blog/', about: '/about/', reading: m.readingUrl, contact: '/contact/' };
    print(line(...Object.entries(dirs).flatMap(([d, href], i) => [i ? '   ' : '', el('a', { href }, `${d}/`)])));
  }

  // ------------------------------------------------------------ commands

  const COMMANDS = {
    help: {
      about: 'list commands',
      run() {
        print(...Object.entries(COMMANDS).filter(([, c]) => c.about).map(([name, c]) =>
          line(cmdButton(c.example || name, name), dim(`  ${c.about}`))));
        print(line(dim('everything here is also a normal link. / to type, esc to close.')));
      },
    },
    ls: { about: 'list directories (try: ls blog)', example: 'ls blog', run: (args) => listing(args[0]) },
    cd: { about: 'open a page (cd blog, cd about …)', example: 'cd blog', run: (args) => go(args[0] || '~') },
    cat: { run: (args) => go(args[0] || '') },
    open: { run: (args) => go(args[0] || '') },
    whoami: { about: 'who is this guy', run: () => print(line('Daryl. SEO, books, two small dogs. Saigon.')) },
    reading: { about: 'the bookshelf', run: () => go('reading') },
    clear: { about: 'clear this', run: () => { out.replaceChildren(); close(); } },
    date: { run: () => print(line(new Date().toString())) },
    echo: { run: (args) => print(line(args.join(' '))) },
    history: { run: () => print(...history.map((h, i) => line(dim(`${String(i + 1).padStart(3)}  `), h))) },
    sudo: { run: () => print(line(err('daryl is not in the sudoers file. this incident will be reported (to his wife).'))) },
    rm: { run: () => print(line(el('span', { class: 't-warn' }, 'nice try. the books stay.'))) },
    exit: {
      about: 'jack out into the warehouse',
      run() {
        const u = uplink();
        if (u) u.jackOut();
        else print(line(err('uplink offline: no warehouse on this page.')));
      },
    },
  };
  COMMANDS.logout = { run: COMMANDS.exit.run };
  COMMANDS.jack = { run: COMMANDS.exit.run };
  COMMANDS.dir = { run: COMMANDS.ls.run };
  COMMANDS.blog = { run: () => listing('blog') };
  COMMANDS.about = { run: () => go('about') };
  COMMANDS.contact = { run: () => go('contact') };

  // world mode narrates itself here too
  window.addEventListener('DOMContentLoaded', () => {
    const u = uplink();
    if (u) u.on((type) => {
      if (type === 'pending') print(line(el('span', { class: 't-warn' }, 'establishing uplink… hold on.')));
      else if (type === 'unavailable') print(line(err('uplink offline: this device can\'t run the warehouse.')));
    });
  });

  async function run(raw) {
    const cmdline = raw.trim();
    if (!cmdline) return;
    history.push(cmdline);
    historyIndex = history.length;
    const [name, ...args] = cmdline.split(/\s+/);
    const cmd = COMMANDS[name.toLowerCase()];
    echo(cmdline);
    if (cmd) await cmd.run(args);
    else if (await resolve(name)) go(name);
    else print(line(err(`command not found: ${name}`), dim('  (try '), cmdButton('help'), dim(')')));
  }

  // ------------------------------------------------------------ input

  async function completions(value) {
    const parts = value.split(/\s+/);
    if (parts.length <= 1) return Object.keys(COMMANDS).filter((c) => c.startsWith(parts[0]));
    const m = await site();
    const word = parts[parts.length - 1].toLowerCase();
    const targets = ['blog/', 'about/', 'reading/', 'contact/', ...m.posts.map((p) => `blog/${p.slug}`)];
    return targets.filter((t) => t.startsWith(word)).map((t) => [...parts.slice(0, -1), t].join(' '));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    run(value);
  });

  input.addEventListener('focus', () => { input.placeholder = 'type help'; });
  input.addEventListener('blur', () => { input.placeholder = ' '; });

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      input.blur();
    } else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex];
    } else if (e.key === 'ArrowDown' && history.length) {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
    } else if (e.key === 'Tab' && input.value) {
      e.preventDefault();
      const options = await completions(input.value);
      if (options.length === 1) input.value = options[0] + (options[0].includes(' ') ? '' : ' ');
      else if (options.length) print(line(dim(options.join('   '))));
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      COMMANDS.clear.run();
    }
  });

  // Typing anywhere goes to the prompt, as if it were already focused (on
  // devices with a keyboard and mouse). Not Space (it scrolls the page), not
  // from another field or the book notes, and never with modifier keys.
  // `/` also just focuses it.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || e.key === ' ') return;
    const a = document.activeElement;
    if (a === input) return;
    if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable || a.closest('[role="dialog"], .modal:not([hidden])'))) return;
    if (document.querySelector('.modal:not([hidden])')) return;
    if (e.key === '/') { e.preventDefault(); input.focus(); return; }
    if (!finePointer) return;
    input.focus(); // the key that triggered this lands in the input
  });

  // clicking elsewhere closes the output
  document.addEventListener('pointerdown', (e) => {
    if (!out.hidden && !e.target.closest('.bar')) close();
  });
})();
