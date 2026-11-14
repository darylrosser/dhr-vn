// The reading shelf: a bookcase of covers in plain HTML/CSS. Each cover is a
// small CSS "book": back board, a stack of page edges, the cover with a hinge
// crease near the spine. Hover (or a tap, on touch) swings the cover open;
// on touch the notes appear just after, so you see it open first.
import {
  CURRENT_YEAR, booksForYear, bookMatchesGenreFilter, updateGenreFilterLabels,
  setBookCounter, coverUrl, escapeHtml, modalEl, fillModal, initModal,
  drawWoodGrain, rotateCanvas90
} from './books.js';

const OPEN_DELAY_MS = 260;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let sortKey = 'oldest';
let genreKey = 'all';
let openCell = null;
let openBookId = null;

const bookcase = document.getElementById('bookcase');
const grid = document.getElementById('book-grid');

const cells = new Map(); // book id -> button

// The wood (drawn in books.js), as repeating tiles.
// Drawn at 512px and shown at half size so the grain stays crisp on retina.
function woodTiles() {
  const set = (name, canvas) => canvas.toBlob(blob => {
    if (blob) bookcase.style.setProperty(name, 'url(' + URL.createObjectURL(blob) + ')');
  });
  const frame = drawWoodGrain(512, 'frame');
  set('--wood-frame', frame);
  set('--wood-board', rotateCanvas90(frame));
  set('--wood-back', drawWoodGrain(512, 'back'));
}
(window.requestIdleCallback || setTimeout)(woodTiles);

// Thicker books show more page edge when the cover swings open (80–700 pages).
function pageDepth(book) {
  const p = book.numberOfPages || 300;
  return Math.min(1, Math.max(0, (p - 80) / 620)).toFixed(2);
}

function buildCell(book) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gbook' + (book.type === 'audio' ? ' is-audio' : '');
  btn.dataset.id = book.id;
  btn.setAttribute('aria-label', 'Open notes for ' + book.title + (book.author ? ' by ' + book.author : ''));
  btn.style.setProperty('--depth', pageDepth(book));
  if (book.type === 'audio') btn.style.setProperty('--ar', '1'); // square covers; right size before the image loads
  btn.style.viewTransitionName = 'gbook-' + String(book.id).replace(/[^\w-]/g, '');

  const url = coverUrl(book.isbn);
  btn.innerHTML =
    '<span class="gbook-3d" aria-hidden="true">' +
      '<span class="gb-back"></span>' +
      '<span class="gb-pages"><span></span><span></span><span></span></span>' +
      '<span class="gb-cover">' +
        (url
          ? '<img src="' + url + '" alt="" loading="lazy" decoding="async" draggable="false">'
          : '<span class="gb-fallback"><b>' + escapeHtml(book.title) + '</b>' + escapeHtml(book.author || '') + '</span>') +
      '</span>' +
      '<span class="gb-spine"></span>' +
      '<span class="gb-light"></span>' +
    '</span>';

  const img = btn.querySelector('img');
  if (img) {
    const setAspect = () => {
      if (img.naturalWidth && img.naturalHeight) {
        btn.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4));
        scheduleLayout(); // row heights change as covers arrive
      }
    };
    if (img.complete) setAspect(); else img.addEventListener('load', setAspect, { once: true });
    img.addEventListener('error', () => {
      img.replaceWith(Object.assign(document.createElement('span'), {
        className: 'gb-fallback',
        innerHTML: '<b>' + escapeHtml(book.title) + '</b>' + escapeHtml(book.author || '')
      }));
    }, { once: true });
  }

  btn.addEventListener('click', () => openBook(book, btn));
  return btn;
}

function visibleBooks() {
  return booksForYear(CURRENT_YEAR, sortKey).filter(b => bookMatchesGenreFilter(b, genreKey));
}

function render() {
  const books = booksForYear(CURRENT_YEAR, sortKey);
  books.forEach(book => {
    let cell = cells.get(book.id);
    if (!cell) { cell = buildCell(book); cells.set(book.id, cell); }
    cell.hidden = !bookMatchesGenreFilter(book, genreKey);
    grid.appendChild(cell); // re-append = reorder
  });
  layout();
}

// Empty cubbies to fill out the case, so the bottom shelf runs the full width.
const fillers = [];

// Some empty cubbies get decorations, as on the old 3D shelf: a few plain
// books, sometimes with a plant, a jar candle or a desk lamp. Random per load,
// with the old shelf's odds and caps.
const DECO_LAYOUTS = [
  'full_books', 'full_books', 'full_books', 'full_books', 'full_books',
  'few_books', 'few_books', 'few_books', 'few_books',
  'books_plant', 'books_candle', 'books_lamp',
  'plant_only', 'candle_only', 'lamp_only'
];
const DECO_MAX = { plant: 4, candle: 2, lamp: 2 };
const decoUsed = { plant: 0, candle: 0, lamp: 0 };
const decoFillRate = 0.28 + Math.random() * 0.24;
const rand = (a, b) => a + Math.random() * (b - a);

function spine() {
  // plain neutrals, as the old shelf's looked under its lights: cream, tan, grey-beige
  const el = document.createElement('span');
  el.className = 'deco-spine';
  el.style.setProperty('--w', rand(0.3, 0.6).toFixed(2));
  el.style.setProperty('--h', rand(0.63, 0.92).toFixed(2));
  el.style.setProperty('--c', 'hsl(' + rand(28, 44).toFixed(0) + ' ' + rand(10, 24).toFixed(0) + '% ' + rand(60, 78).toFixed(0) + '%)');
  return el;
}

function decoItem(kind) {
  const el = document.createElement('span');
  if (kind === 'plant') {
    el.className = 'deco-item deco-plant ' + (Math.random() < 0.5 ? 'is-succulent' : 'is-leafy');
    el.innerHTML = '<span class="deco-leaves"></span><span class="deco-pot"></span>';
  } else if (kind === 'candle') {
    el.className = 'deco-item deco-candle';
    el.innerHTML = '<span class="deco-flame"></span><span class="deco-jar"></span>';
  } else {
    el.className = 'deco-item deco-lamp';
    el.innerHTML = '<span class="deco-shade"></span><span class="deco-stem"></span><span class="deco-base"></span>';
  }
  el.style.setProperty('--tilt', rand(-3, 3).toFixed(1) + 'deg');
  return el;
}

function decorate(cell) {
  if (Math.random() >= decoFillRate) return;
  const allowed = DECO_LAYOUTS.filter(l => {
    const kind = l.includes('plant') ? 'plant' : l.includes('candle') ? 'candle' : l.includes('lamp') ? 'lamp' : null;
    return !kind || decoUsed[kind] < DECO_MAX[kind];
  });
  const layout = allowed[Math.floor(Math.random() * allowed.length)];
  const kind = layout.includes('plant') ? 'plant' : layout.includes('candle') ? 'candle' : layout.includes('lamp') ? 'lamp' : null;
  if (kind) decoUsed[kind]++;

  const deco = document.createElement('span');
  deco.className = 'deco' + (Math.random() < 0.5 ? ' is-right' : '');
  let books = 0;
  if (layout === 'full_books') books = Math.round(rand(6, 10));
  else if (layout === 'few_books') books = 2 + Math.floor(Math.random() * 3);
  else if (kind && !layout.endsWith('_only')) books = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < books; i++) deco.appendChild(spine());
  if (kind) deco.appendChild(decoItem(kind));
  cell.appendChild(deco);
}

// The wood is one continuous sheet across the whole bookcase: each cubby's
// shelf board and divider take their grain from where they sit in the case
// (--bx/--by), not from their own corner, so the grain doesn't restart per cubby.
function layout() {
  let shown = 0;
  cells.forEach(c => { if (!c.hidden) shown++; });
  const slots = fitToScreen(shown);
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length || 1;
  const need = slots ? Math.max(0, slots - shown) : shown ? (cols - (shown % cols)) % cols : 0;
  while (fillers.length < need) {
    const f = document.createElement('div');
    f.className = 'gbook is-empty';
    f.setAttribute('aria-hidden', 'true');
    decorate(f);
    fillers.push(f);
  }
  fillers.forEach((f, i) => { if (i < need) grid.appendChild(f); else f.remove(); });

  const origin = bookcase.getBoundingClientRect();
  grid.querySelectorAll('.gbook:not([hidden])').forEach((el, i) => {
    // the last cubby in a row meets the side post, so it has no divider of its own
    el.classList.toggle('is-row-end', (i + 1) % cols === 0);
    const r = el.getBoundingClientRect();
    el.style.setProperty('--bx', (origin.left - r.left).toFixed(1) + 'px');
    el.style.setProperty('--by', (origin.top - r.top).toFixed(1) + 'px');
    el.style.setProperty('--cw', r.width.toFixed(1) + 'px');
    el.style.setProperty('--ch', r.height.toFixed(1) + 'px');
  });
}

// Desktop: laid out like the old 3D shelf. A fixed 9-wide case of near-square
// cubbies (at least 6 rows, more as the year fills up), sized so the whole case
// fits the window, books filling most of each cubby, empty cubbies left for
// decorations. Phones and tablets keep the normal scrolling grid.
const FIT_MIN_WIDTH = 1024;
const FIT_MIN_HEIGHT = 560;
const FIT_COLS = 9;
const FIT_MIN_ROWS = 6;
const MIN_BOOK_H = 80;
const COVER_AR = 0.66;     // a typical cover, for sizing
const FIT_PAD_X = 24;      // a cubby's side padding, both sides (matches .is-fit .gbook)
const BOOK_FILL = 0.92;    // books stand about this much of the space above the shelf

// Returns how many cubbies the case should have (fit mode), or 0 (normal grid).
function fitToScreen(count) {
  const fit = innerWidth >= FIT_MIN_WIDTH && innerHeight >= FIT_MIN_HEIGHT && count > 0;
  bookcase.classList.toggle('is-fit', fit);
  document.body.classList.toggle('shelf-fit', fit);
  if (!fit) {
    grid.style.gridTemplateColumns = '';
    grid.style.gridAutoRows = '';
    bookcase.style.width = '';
    bookcase.style.removeProperty('--book-h');
    return 0;
  }
  const cs = getComputedStyle(bookcase);
  const post = parseFloat(cs.getPropertyValue('--post')) || 0;
  const plank = parseFloat(cs.getPropertyValue('--plank')) || 0;
  const floor = parseFloat(cs.getPropertyValue('--fit-floor')) || 0;
  const bottomGap = parseFloat(cs.marginBottom) || 0;
  const sideGap = Math.max(40, Math.min(96, innerWidth * 0.05)); // the case is centred; keep at least this either side
  const top = bookcase.getBoundingClientRect().top + scrollY;

  const rows = Math.max(FIT_MIN_ROWS, Math.ceil(count / FIT_COLS));
  const availH = innerHeight - top - plank - bottomGap; // under the top board
  const availW = innerWidth - sideGap * 2 - post * 2;
  const cellH = Math.floor(availH / rows);
  const cellW = Math.floor(Math.min(availW / FIT_COLS, cellH * 1.1)); // near-square cubbies
  const bookH = Math.max(MIN_BOOK_H, Math.floor(Math.min(
    (cellH - plank - floor) * BOOK_FILL,
    (cellW - FIT_PAD_X) / COVER_AR
  )));

  grid.style.gridTemplateColumns = 'repeat(' + FIT_COLS + ', ' + cellW + 'px)';
  grid.style.gridAutoRows = cellH + 'px';
  bookcase.style.width = (cellW * FIT_COLS + post * 2) + 'px';
  bookcase.style.setProperty('--book-h', bookH + 'px');
  return rows * FIT_COLS;
}

addEventListener('resize', () => scheduleLayout());

let layoutFrame = 0;
function scheduleLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(layout);
}
new ResizeObserver(scheduleLayout).observe(grid);

function withTransition(update) {
  if (document.startViewTransition && !reduceMotion.matches) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

function openBook(book, cell) {
  if (openCell) return;
  openCell = cell;
  openBookId = book.id;
  cell.classList.add('is-open');
  setTimeout(() => {
    if (openCell === cell) fillModal(book);
  }, reduceMotion.matches ? 0 : OPEN_DELAY_MS);
}

function showInModal(book) {
  if (openCell) openCell.classList.remove('is-open');
  openCell = cells.get(book.id) || null;
  openBookId = book.id;
  if (openCell) openCell.classList.add('is-open');
  fillModal(book);
}

function closeModal() {
  modalEl.hidden = true;
  const cell = openCell;
  openCell = null;
  openBookId = null;
  if (cell) {
    cell.classList.remove('is-open');
    cell.focus({ preventScroll: true });
  }
}

function cycle(direction) {
  if (modalEl.hidden || openBookId == null) return;
  const books = visibleBooks();
  const idx = books.findIndex(b => b.id === openBookId);
  if (idx < 0 || books.length < 2) return;
  const next = books[(idx + (direction === 'prev' ? -1 : 1) + books.length) % books.length];
  showInModal(next);
}

initModal({ onClose: closeModal, onPrev: () => cycle('prev'), onNext: () => cycle('next') });

// Swipe left/right inside the modal to step through books.
(function initModalSwipe() {
  let x0 = null, y0 = null;
  modalEl.addEventListener('touchstart', e => {
    const t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY;
  }, { passive: true });
  modalEl.addEventListener('touchend', e => {
    if (x0 == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = y0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) cycle(dx < 0 ? 'next' : 'prev');
  }, { passive: true });
})();

function syncToolbar() {
  document.querySelectorAll('#shelf-sort .shelf-chip-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.sort === sortKey);
  });
  document.querySelectorAll('#shelf-genre-filter .shelf-chip-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.genre === genreKey);
  });
}

document.getElementById('shelf-sort').addEventListener('click', e => {
  const btn = e.target.closest('.shelf-chip-btn');
  if (!btn || !btn.dataset.sort || btn.dataset.sort === sortKey) return;
  sortKey = btn.dataset.sort;
  syncToolbar();
  withTransition(render);
});

document.getElementById('shelf-genre-filter').addEventListener('click', e => {
  const btn = e.target.closest('.shelf-chip-btn');
  if (!btn || !btn.dataset.genre || btn.dataset.genre === genreKey) return;
  genreKey = btn.dataset.genre;
  syncToolbar();
  withTransition(render);
});

setBookCounter(booksForYear(CURRENT_YEAR, 'oldest'));
updateGenreFilterLabels();
render();
syncToolbar();
