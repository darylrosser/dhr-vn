// Zero-dependency static build for dhr.vn (terminal edition).
//
//   node build.mjs           build into dist/
//   node build.mjs --serve   build, serve on http://127.0.0.1:4321, rebuild on change
//
// Content lives in content/pages and content/posts as HTML fragments that start
// with a JSON front-matter comment. Templates are the functions below.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const SITE = {
  name: 'dhr.vn',
  url: 'https://dhr.vn',
  author: 'Daryl Hensman-Rosser',
  // The three.js reading shelf (public/reading, carried over from the old site).
  readingUrl: '/reading/',
};

// ---------------------------------------------------------------- content

function readFragment(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^<!--\s*([\s\S]*?)\s*-->\s*/);
  if (!m) throw new Error(`${file}: missing JSON front-matter comment`);
  const meta = JSON.parse(m[1]);
  const body = raw.slice(m[0].length).trim();
  return { ...meta, slug: path.basename(file, '.html'), body };
}

function loadDir(dir) {
  const full = path.join(ROOT, 'content', dir);
  return fs.readdirSync(full).filter((f) => f.endsWith('.html')).map((f) => readFragment(path.join(full, f)));
}

const wordCount = (html) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const readMinutes = (html) => Math.max(1, Math.round(wordCount(html) / 230));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (s) => s.replace(/<[^>]+>/g, '');
const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---------------------------------------------------------------- templates

let assetVersion = '';
const asset = (p) => `/assets/${p}?v=${assetVersion}`;

const NAV = [
  { key: 'home', href: '/', label: '~' },
  { key: 'blog', href: '/blog/', label: 'blog' },
  { key: 'about', href: '/about/', label: 'about' },
  { key: 'reading', href: SITE.readingUrl, label: 'reading' },
  { key: 'contact', href: '/contact/', label: 'contact' },
];

// Inline so the saved theme applies before first paint (no flash).
const THEME_SNIPPET = `<script>try{var t=localStorage.getItem('dhr-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>`;

// Boot animation once per tab session, never with reduced motion. Hides the
// content before first paint; the timeout un-hides it if terminal.js never runs.
// three.js for world mode, pinned. Only the home page loads it, and only on demand.
const THREE_VERSION = '0.170.0';
const IMPORT_MAP = `<script type="importmap">${JSON.stringify({ imports: {
  three: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`,
  'three/addons/': `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/`,
} })}</script>`;

const BOOT_SNIPPET = `<script>(function(){var d=document.documentElement;try{if(matchMedia('(prefers-reduced-motion: reduce)').matches||sessionStorage.getItem('dhr-booted'))return}catch(e){return}d.classList.add('is-booting');setTimeout(function(){if(!window.__termBooted)d.classList.remove('is-booting')},8000)})()</script>`;

// The way out of a page into the warehouse is part of the screen itself: a
// close ✕ in its chrome (with an uplink LED), and the bezel around the edge,
// which pulls back on hover to show the room. uplink.js shows them on capable devices.
const screenX = (cls = '') => `<button type="button" class="screen-x${cls ? ` ${cls}` : ''}" data-jack hidden aria-label="Close this screen and step into the warehouse" title="Exit to the warehouse"><span class="screen-x-led" aria-hidden="true"></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg><span class="jack-state visually-hidden">Uplink: offline</span></button>`;

const BEZEL = `<div class="bezel" aria-hidden="true">
  <div class="bezel-edge" data-edge="top" data-jack-edge></div>
  <div class="bezel-edge" data-edge="right" data-jack-edge></div>
  <div class="bezel-edge" data-edge="bottom" data-jack-edge><span class="bezel-hint">▸ exit to warehouse</span></div>
  <div class="bezel-edge" data-edge="left" data-jack-edge></div>
</div>`;

// `place` = where the page lives in the warehouse (world.js PLACES); none = no world mode.
function head({ title, description, canonical, kind, place = '' }) {
  const fullTitle = title ? `${title} | ${SITE.name}` : SITE.name;
  return `<!DOCTYPE html>
<html lang="en" data-kind="${kind}"${place ? ` data-place="${place}"` : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || '')}">
<link rel="canonical" href="${SITE.url}${canonical}">
<link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,600;0,700;1,400&family=Share+Tech+Mono&family=Orbitron:wght@700;900&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
${kind === 'terminal' ? BOOT_SNIPPET : ''}${THEME_SNIPPET}
${IMPORT_MAP}
<script>window.__dhrAssets = ${JSON.stringify({ world: asset('js/world.js') })};</script>
<link rel="stylesheet" href="${asset('css/base.css')}">
<link rel="stylesheet" href="${asset('css/reader.css')}">
<link rel="stylesheet" href="${asset('css/world.css')}">
${kind === 'terminal' ? `<link rel="stylesheet" href="${asset('css/terminal.css')}">` : ''}
</head>`;
}

// Breadcrumb prompt for the reader header: dhr.vn:~/blog/slug $
function promptPath(crumbs) {
  let href = '';
  const parts = crumbs.map((c) => {
    href += `${c}/`;
    return `<a href="/${href}">${esc(c)}</a>`;
  });
  return `<a href="/" class="prompt-host">${SITE.name}</a><span class="prompt-sep">:</span><a href="/" class="prompt-home">~</a>${parts.map((p) => `<span class="prompt-slash">/</span>${p}`).join('')}<span class="prompt-dollar"> $</span>`;
}

function readerShell({ title, description, canonical, active, crumbs, body, place = '' }) {
  const nav = NAV.map((n) => `<a href="${n.href}"${n.key === active ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
  return `${head({ title, description, canonical, kind: 'reader', place })}
<body>
${place ? BEZEL : ''}
<a class="skip-link" href="#main">Skip to content</a>
<header class="bar">
  <div class="bar-inner">
    <p class="bar-prompt">${promptPath(crumbs)}<span class="bar-cursor" aria-hidden="true"></span></p>
    <nav class="bar-nav" aria-label="Main">${nav}</nav>
    <button type="button" class="theme-toggle" aria-label="Change colour theme"><span class="theme-toggle-label">auto</span></button>
    ${place ? screenX('screen-x--bar') : ''}
  </div>
</header>
<main id="main" class="reader">
${body}
</main>
${footer()}
<script src="${asset('js/theme.js')}" defer></script>
<script src="${asset('js/eye.js')}" defer></script>
<script src="${asset('js/uplink.js')}" defer></script>
</body>
</html>
`;
}

function footer() {
  return `<footer class="foot">
  <div class="foot-marquee" aria-hidden="true"><div class="foot-marquee-track">${'<span>YOU ARE BUGS.</span>'.repeat(12)}</div></div>
  <div class="foot-inner">
    <nav class="foot-nav" aria-label="Footer">${NAV.map((n) => `<a href="${n.href}">${n.key === 'home' ? 'home' : n.label}</a>`).join('')}</nav>
    <p class="foot-meta">© ${new Date().getFullYear()} ${SITE.name} <span class="foot-dim">// end of transmission</span></p>
    <div class="foot-badges">
      <img src="/images/badges/aol-sucks.gif" alt="AOL Sucks" width="88" height="31">
      <a href="/mac"><img src="/images/badges/mac-made.gif" alt="Made on a Mac" width="88" height="31"></a>
      <img src="/images/badges/valid-xhtml.gif" alt="Valid XHTML" width="88" height="31">
      <img src="/images/badges/claude-powered.gif" alt="Claude Powered" width="88" height="31">
    </div>
  </div>
</footer>`;
}

// Blade Runner-style case file shown above a page's prose (front-matter `dossier`).
function dossierPanel(d) {
  const rows = d.fields.map(([k, v]) => `<div class="dossier-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n      ');
  return `<section class="dossier" aria-label="Case file">
  <header class="dossier-head">
    <span>${esc(d.file)}</span>
    <span class="dossier-stamp">${esc(d.stamp)}</span>
  </header>
  <div class="dossier-body">
    <dl class="dossier-fields">
      ${rows}
    </dl>
    <figure class="dossier-scan" aria-hidden="true">
      <pre class="eye" id="eye"></pre>
      <figcaption id="eye-status">Pupil response: nominal</figcaption>
    </figure>
  </div>
  <p class="dossier-verdict">${d.verdict}</p>
</section>`;
}

function pageView(page) {
  return readerShell({
    title: page.title,
    description: page.description,
    canonical: `/${page.slug}/`,
    active: page.nav,
    crumbs: [page.slug],
    place: page.slug,
    body: `${page.dossier ? dossierPanel(page.dossier) : ''}
<article class="prose">
  <p class="kicker"><span class="kicker-cmd">cat</span> ${esc(page.dossier ? page.dossier.statement : `${page.slug}.md`)}</p>
  <h1>${page.title}</h1>
  ${page.body}
</article>`,
  });
}

function postView(post) {
  return readerShell({
    title: stripTags(post.title),
    description: post.description,
    canonical: `/blog/${post.slug}/`,
    active: 'blog',
    crumbs: ['blog', post.slug],
    place: 'blog',
    body: `<article class="prose">
  <p class="kicker"><span class="kicker-cmd">cat</span> ${esc(post.slug)}.md <span class="kicker-dim">·</span> <time datetime="${post.date}">${fmtDate(post.date)}</time> <span class="kicker-dim">·</span> ${readMinutes(post.body)} min read</p>
  <h1>${post.title}</h1>
  ${post.body}
  <p class="post-end"><a href="/blog/">← cd ../blog</a></p>
</article>`,
  });
}

function blogIndexView(posts) {
  const items = posts.map((p) => `<li class="post-card">
    <a class="post-card-link" href="/blog/${p.slug}/">
      ${p.cover ? `<img class="post-card-cover" src="${p.cover}" alt="" loading="lazy">` : ''}
      <span class="post-card-meta"><time datetime="${p.date}">${p.date}</time> · ${readMinutes(p.body)} min</span>
      <span class="post-card-title">${p.title}</span>
      <span class="post-card-excerpt">${p.excerpt || ''}</span>
    </a>
  </li>`).join('\n');
  return readerShell({
    title: 'Blog',
    description: 'Writing from Saigon: books, business, and things that seem important at 2am.',
    canonical: '/blog/',
    active: 'blog',
    crumbs: ['blog'],
    place: 'blog',
    body: `<section class="prose">
  <p class="kicker"><span class="kicker-cmd">ls</span> -lt blog/ <span class="kicker-dim">·</span> ${posts.length} ${posts.length === 1 ? 'entry' : 'entries'}</p>
  <h1>The Blog</h1>
  <ul class="post-list">
${items}
  </ul>
</section>`,
  });
}

function homeView(posts, pages) {
  // Everything here is real HTML so the page works with no JS; terminal.js
  // adds the boot animation and the interactive prompt, eye.js the scanner.
  const manifest = {
    posts: posts.map((p) => ({ slug: p.slug, title: stripTags(p.title), date: p.date, minutes: readMinutes(p.body) })),
    pages: pages.map((p) => ({ slug: p.slug, title: stripTags(p.title) })),
    readingUrl: SITE.readingUrl,
  };
  const recent = posts.slice(0, 5).map((p) => `<li><span class="t-dim">${p.date}</span>  <a href="/blog/${p.slug}/">${p.title}</a></li>`).join('');
  return `${head({ title: '', description: 'Daryl Hensman-Rosser: marketing, digital business, and the occasional ramble. Based in Saigon.', canonical: '/', kind: 'terminal', place: 'home' })}
<body>
${BEZEL}
<a class="skip-link" href="#prompt-input">Skip to command line</a>
<div class="crt" aria-hidden="true"></div>
<main class="rig" id="term">
  <section class="panel panel-main" aria-label="Terminal">
    ${screenX('screen-x--panel')}
    <div class="screen" id="screen" tabindex="-1">
      <h1 class="wordmark"><span>DHR</span><span>.VN</span></h1>
      <p class="t-quote">=== "I've seen things you people wouldn't believe. Mostly bookshops." ===</p>

      <div class="boot" data-step>
        <p class="t-dim">DHR-OS 4.0.0 (TTY1) // ${new Date().toISOString().slice(0, 10)} // SAIGON SECTOR 1</p>
        <p class="t-dim">[<span class="t-ok"> OK </span>] Mounting /home/daryl … 400-odd books detected</p>
        <p class="t-dim">[<span class="t-ok"> OK </span>] Coffee subsystem online</p>
        <p class="t-dim">[<span class="t-warn">WARN</span>] Fiancée has requested a moratorium on book purchases</p>
      </div>

      <section class="block" data-step aria-labelledby="whoami-h">
        <p class="cmd" id="whoami-h"><span class="ps1">&gt;</span> whoami</p>
        <p class="t-headline">In a world where one man's journey is nothing short of ordinary.</p>
        <div class="t-out">
          <p>The statistics are quite clear: there are approximately 8 billion<sup><a href="#fn1" id="ref1">1</a></sup> people on Earth, and <mark>I am definitely one of them.</mark></p>
          <p>My name is Daryl. I live in Saigon, which is in Vietnam, which is on Earth, which is as far as we<sup><a href="#fn2" id="ref2">2</a></sup> can tell is orbiting its Sun at approximately 67,000 miles per hour. None of this is my fault. Well, the Saigon part is.</p>
          <p>I run a marketing agency that occasionally convinces businesses to give us money<sup><a href="#fn3" id="ref3">3</a></sup> in exchange for making them slightly more money. I also write code, though "write" is perhaps generous given that I mostly ask an AI very politely and it does the actual work. <mark>The AI has not yet demanded equity.</mark><sup><a href="#fn4" id="ref4">4</a></sup></p>
          <p>I read books. Many books. <mark>Too many books</mark>, if you ask my fiancée, who has requested I stop buying books until I finish the ones currently occupying three bookshelves, two nightstands, and what used to be the dining room table.</p>
          <p>This is where I write about some of this, and occasionally other things that seem important at 2am.</p>
        </div>
      </section>

      <section class="block" data-step aria-labelledby="ls-h">
        <p class="cmd" id="ls-h"><span class="ps1">&gt;</span> ls</p>
        <nav aria-label="Main">
          <ul class="t-ls">
            <li><a href="/blog/">blog/</a></li>
            <li><a href="/about/">about/</a></li>
            <li><a href="${SITE.readingUrl}">reading/</a></li>
            <li><a href="/contact/">contact/</a></li>
          </ul>
        </nav>
      </section>

      <section class="block" data-step aria-labelledby="recent-h">
        <p class="cmd" id="recent-h"><span class="ps1">&gt;</span> ls -lt blog | head</p>
        <ul class="t-list">${recent}</ul>
      </section>

      <section class="block t-notes" data-step aria-label="Footnotes">
        <p class="cmd"><span class="ps1">&gt;</span> cat footnotes.txt</p>
        <ol>
          <li id="fn1"># I have not personally verified this number. <a href="#ref1" aria-label="Back to reference 1">↩</a></li>
          <li id="fn2"># The royal "we." As in "we landed on the moon" and "we invented the internet." Though, I'm happy to accept credit on humanity's behalf. <a href="#ref2" aria-label="Back to reference 2">↩</a></li>
          <li id="fn3"># Currency. A peculiar system where Earth inhabitants exchange actual goods and services for either decorative paper or numerical adjustments to electronic databases. Both parties in these transactions treat this as entirely reasonable. <a href="#ref3" aria-label="Back to reference 3">↩</a></li>
          <li id="fn4"># As of this writing. Future updates may reflect changes to this arrangement. <a href="#ref4" aria-label="Back to reference 4">↩</a></li>
        </ol>
      </section>

      <div id="log" class="log" aria-live="polite"></div>
    </div>

    <nav class="chips" id="chips" aria-label="Quick commands" hidden>
      <button type="button" data-cmd="help">help</button>
      <button type="button" data-cmd="ls blog">ls blog</button>
      <button type="button" data-cmd="cd about">about</button>
      <button type="button" data-cmd="cd reading">reading</button>
      <button type="button" data-cmd="cd contact">contact</button>
      <button type="button" data-cmd="exit" class="chip-exit">exit ▸</button>
    </nav>
    <form class="prompt" id="prompt" autocomplete="off" hidden>
      <label class="ps1" for="prompt-input"><span aria-hidden="true">›</span><span class="visually-hidden">Command</span></label>
      <input id="prompt-input" name="cmd" type="text" placeholder="Enter command…" spellcheck="false" autocapitalize="off" autocorrect="off" enterkeyhint="go">
      <span class="prompt-block" aria-hidden="true"></span>
    </form>
  </section>

  <section class="panel panel-eye" aria-hidden="true">
    <p class="panel-label">VK-7 // Subject scan</p>
    <pre class="eye" id="eye"></pre>
    <p class="panel-label panel-label--foot"><span id="eye-status">Pupil response: nominal</span></p>
  </section>

  <section class="panel panel-log" aria-hidden="true">
    <div class="syslog" id="syslog">
      <p>System ready.</p>
      <p>Initiating VK baseline…</p>
    </div>
  </section>
</main>
<script id="site-manifest" type="application/json">${JSON.stringify(manifest).replace(/</g, '\\u003c')}</script>
<script src="${asset('js/eye.js')}" defer></script>
<script src="${asset('js/uplink.js')}" defer></script>
<script src="${asset('js/terminal.js')}" defer></script>
</body>
</html>
`;
}

function notFoundView() {
  return readerShell({
    title: 'Not found',
    description: '',
    canonical: '/404/',
    active: '',
    crumbs: ['404'],
    body: `<article class="prose">
  <p class="kicker"><span class="kicker-cmd">cd</span> ???</p>
  <h1>No such file or directory.</h1>
  <p>Whatever you were looking for isn't here. It may never have been. <a href="/">Back to the terminal</a>.</p>
</article>`,
  });
}

// ---------------------------------------------------------------- build

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    entry.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
}

function hashDir(dir) {
  const h = crypto.createHash('sha1');
  for (const f of fs.readdirSync(dir, { recursive: true }).sort()) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isFile()) h.update(f).update(fs.readFileSync(full));
  }
  return h.digest('hex').slice(0, 8);
}

function out(rel, html) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

export function build() {
  const t0 = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'public'), DIST);
  copyDir(path.join(ROOT, 'src'), path.join(DIST, 'assets'));
  assetVersion = hashDir(path.join(ROOT, 'src'));

  const pages = loadDir('pages');
  const posts = loadDir('posts').filter((p) => !p.draft).sort((a, b) => b.date.localeCompare(a.date));

  out('index.html', homeView(posts, pages));
  out('blog/index.html', blogIndexView(posts));
  for (const p of posts) out(`blog/${p.slug}/index.html`, postView(p));
  for (const p of pages) out(`${p.slug}/index.html`, pageView(p));
  out('404.html', notFoundView());

  console.log(`built ${posts.length} posts, ${pages.length} pages in ${Date.now() - t0} ms`);
}

// ---------------------------------------------------------------- dev server

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.avif': 'image/avif', '.woff2': 'font/woff2' };

function serve(port = 4321) {
  http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(DIST, p);
    if (!file.startsWith(DIST)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    else if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`; // like Netlify's pretty URLs
    else if (!fs.existsSync(file) && fs.existsSync(path.join(DIST, p, 'index.html'))) {
      return res.writeHead(301, { Location: `${p}/` }).end();
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(fs.readFileSync(path.join(DIST, '404.html')));
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1', () => console.log(`serving http://127.0.0.1:${port}`));

  let timer;
  for (const dir of ['content', 'src', 'public']) {
    fs.watch(path.join(ROOT, dir), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 80);
    });
  }
  fs.watch(path.join(ROOT, 'build.mjs'), () => console.log('build.mjs changed: restart the server to pick it up'));
}

build();
if (process.argv.includes('--serve')) serve(Number(process.env.PORT) || 4321);
