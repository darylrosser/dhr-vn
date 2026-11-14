// Book data helpers, the book modal and the bookcase wood, for grid.js.

// Parse YYYY-MM-DD as local date (no US/locale confusion, no UTC midnight shift).
export function parseReadDate(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const date = new Date(y, m, d);
  if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return null;
  return date;
}

export function getBooks() {
  return (typeof window.booksData !== 'undefined' && Array.isArray(window.booksData)) ? window.booksData : [];
}

export const SORT_MODES = {
  oldest: {
    label: 'Oldest first',
    compare(a, b) {
      return parseReadDate(a.readDate) - parseReadDate(b.readDate);
    }
  },
  rating: {
    label: 'Highest rated',
    compare(a, b) {
      const ra = a.rating != null ? a.rating : -1;
      const rb = b.rating != null ? b.rating : -1;
      if (rb !== ra) return rb - ra;
      return parseReadDate(a.readDate) - parseReadDate(b.readDate);
    }
  }
};

export const CURRENT_YEAR = 2026;

export const GENRE_FILTER_MAP = {
  all: null,
  business: 'Business',
  biography: 'Biography',
  finance: 'Finance',
  history: 'History',
  science: 'Science',
  scifi: 'Science Fiction'
};

export const GENRE_FILTER_LABELS = {
  all: 'All',
  business: 'Business',
  biography: 'Biography',
  finance: 'Finance',
  history: 'History',
  science: 'Science',
  scifi: 'Sci-Fi'
};

export function booksForYear(year, sortKey) {
  const yearNum = parseInt(year, 10);
  const mode = SORT_MODES[sortKey] || SORT_MODES.oldest;
  return getBooks()
    .filter(b => {
      const d = parseReadDate(b.readDate);
      return d && d.getFullYear() === yearNum;
    })
    .sort(mode.compare);
}

export function bookMatchesGenreFilter(bookData, filterKey) {
  if (!filterKey || filterKey === 'all') return true;
  const target = GENRE_FILTER_MAP[filterKey];
  if (!target) return true;
  const genres = bookData && bookData.genres ? bookData.genres : [];
  return genres.indexOf(target) !== -1;
}

export function updateGenreFilterLabels(year = CURRENT_YEAR) {
  const nav = document.getElementById('shelf-genre-filter');
  if (!nav) return;
  const books = booksForYear(year, 'oldest');
  nav.querySelectorAll('.shelf-chip-btn[data-genre]').forEach(btn => {
    const key = btn.dataset.genre;
    const label = GENRE_FILTER_LABELS[key] || key;
    const n = books.filter(b => bookMatchesGenreFilter(b, key)).length;
    btn.textContent = label + ' (' + n + ')';
  });
}

export function setBookCounter(books, year = CURRENT_YEAR) {
  const readCount = books.filter(b => b.type !== 'audio').length;
  const listenedCount = books.filter(b => b.type === 'audio').length;
  const total = books.length;
  const bookWord = total === 1 ? 'book' : 'books';
  // long version for desktop, a short one that fits small phones on one line
  document.getElementById('book-counter').innerHTML =
    '<span class="counter-long">' + total + ' ' + bookWord + ' read so far in ' + year + ' (' + readCount + ' print, ' + listenedCount + ' audio)</span>' +
    '<span class="counter-short">' + total + ' ' + bookWord + ' in ' + year + ' · ' + readCount + ' print · ' + listenedCount + ' audio</span>';
}

export function formatReadDate(isoString) {
  if (!isoString) return '';
  const d = parseReadDate(isoString);
  if (!d) return isoString;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDuration(durationHours, durationMinutes) {
  const h = durationHours != null && durationHours !== '' ? Number(durationHours) : null;
  if (h == null || isNaN(h)) return '';
  const mins = durationMinutes != null && durationMinutes !== '' ? Math.round(Number(durationMinutes)) : null;
  if (mins != null && !isNaN(mins)) {
    const hours = Math.floor(h);
    return hours + 'h ' + mins + 'm';
  }
  if (h % 1 !== 0) {
    const hours = Math.floor(h);
    const m = Math.round((h - hours) * 60);
    return m > 0 ? hours + 'h ' + m + 'm' : hours + 'h';
  }
  return h + ' hours';
}

function readingPath(path) {
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    const base = location.href.replace(/[#?].*$/, '').replace(/\/[^/]*$/, '/');
    return base + path;
  }
  return path;
}

// Full-size cover (the notes modal).
export function coverUrl(isbn) {
  return isbn ? readingPath('covers/' + isbn + '.jpg') : null;
}

// Small cover for the shelf: 360px wide WebP, ~25 KB instead of up to ~500 KB.
// Made by tools/cover-thumbs.sh; grid.js falls back to the full cover if one is missing.
export function thumbUrl(isbn) {
  return isbn ? readingPath('covers/thumbs/' + isbn + '.webp') : null;
}

export function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ----- Modal -----
export const modalEl = document.getElementById('book-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalAuthor = document.getElementById('modal-author');
const modalReadDate = document.getElementById('modal-read-date');
const modalPages = document.getElementById('modal-pages');
const modalFormat = document.getElementById('modal-format');
const modalGenres = document.getElementById('modal-genres');
const modalRating = document.getElementById('modal-rating');
const modalReviewLabel = document.getElementById('modal-review-label');
const modalReview = document.getElementById('modal-review');
const modalDescriptionLabel = document.getElementById('modal-description-label');
const modalDescription = document.getElementById('modal-description');
const modalCover = document.getElementById('modal-cover');

function renderModalCover(container, book) {
  container.innerHTML = '';
  const url = coverUrl(book.isbn);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = book.title;
    img.onerror = () => {
      const ph = document.createElement('div');
      ph.className = 'book-placeholder';
      ph.innerHTML = '<span class="book-placeholder-title">' + escapeHtml(book.title) + '</span><span class="book-placeholder-author">' + escapeHtml(book.author || '') + '</span>';
      container.appendChild(ph);
    };
    container.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'book-placeholder';
    ph.innerHTML = '📖<span class="book-placeholder-title">' + escapeHtml(book.title) + '</span><span class="book-placeholder-author">' + escapeHtml(book.author || '') + '</span>';
    container.appendChild(ph);
  }
}

// Fill the modal with a book and show it. Returns false if there was nothing to show.
export function fillModal(book) {
  if (!book || !book.title) return false;
  modalTitle.textContent = book.title;
  modalAuthor.textContent = book.author || '';
  modalReadDate.textContent = 'Read: ' + formatReadDate(book.readDate);
  if (book.type === 'audio') {
    const durationStr = formatDuration(book.durationHours, book.durationMinutes);
    modalPages.textContent = durationStr ? ' · ' + durationStr : '';
  } else {
    modalPages.textContent = book.numberOfPages ? ' · ' + book.numberOfPages + ' pages' : '';
  }
  const formatLabel = book.type === 'audio' ? 'Audiobook' : book.type === 'digital' ? 'Digital' : book.type === 'print' ? 'Print' : '';
  modalFormat.textContent = formatLabel ? ' · ' + formatLabel : '';
  modalFormat.style.display = formatLabel ? '' : 'none';
  modalGenres.textContent = (book.genres && book.genres.length) ? book.genres.join(', ') : '';
  modalGenres.style.display = (book.genres && book.genres.length) ? '' : 'none';
  if (book.rating != null && book.rating !== '') {
    const num = Math.min(5, Math.max(0, Number(book.rating)));
    const pct = (num / 5) * 100;
    const exactLabel = 'Rated ' + (Number.isInteger(num) ? num : num.toFixed(1)) + ' out of 5';
    modalRating.innerHTML = '<span class="modal-rating-stars" title="' + escapeHtml(exactLabel) + '" aria-label="' + escapeHtml(exactLabel) + '"><span class="stars-bg">☆☆☆☆☆</span><span class="stars-fill" style="width:' + pct + '%">★★★★★</span></span>';
    document.getElementById('modal-rating-wrap').style.display = '';
  } else {
    modalRating.innerHTML = '';
    document.getElementById('modal-rating-wrap').style.display = 'none';
  }
  modalReviewLabel.style.display = book.review ? '' : 'none';
  modalReview.textContent = book.review || '';
  modalReview.style.display = book.review ? '' : 'none';
  // Prefer the personal review over the publisher synopsis when both exist.
  const showDescription = !book.review;
  modalDescriptionLabel.style.display = showDescription ? '' : 'none';
  modalDescription.style.display = showDescription ? '' : 'none';
  modalDescription.textContent = showDescription ? (book.description || 'No description.') : '';
  renderModalCover(modalCover, book);
  modalEl.hidden = false;
  modalClose.focus();
  return true;
}

// Wire the modal's close / keyboard / rating-info controls once.
export function initModal({ onClose, onPrev, onNext }) {
  modalBackdrop.addEventListener('click', onClose);
  modalClose.addEventListener('click', onClose);

  const ratingInfoWrap = document.getElementById('modal-rating-info-wrap');
  const ratingInfo = document.getElementById('modal-rating-info');
  ratingInfo.addEventListener('click', e => {
    e.stopPropagation();
    ratingInfoWrap.classList.toggle('is-open');
  });
  ratingInfo.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ratingInfoWrap.classList.toggle('is-open');
    }
  });
  document.addEventListener('click', () => ratingInfoWrap.classList.remove('is-open'));
  modalEl.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ratingInfoWrap.classList.remove('is-open');
      onClose();
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); onNext(); }
  });
}

// ----- Shelf wood grain -----
// Procedural grain (carried over from the old three.js shelf), drawn once per
// load and used by grid.js as repeating CSS background tiles. The wave repeats exactly over the canvas height and lines near
// the edges are drawn on both sides, so the tile repeats without seams.
//   'frame' – darker grain for boards, sides and dividers (fixed pattern)
//   'back'  – lighter, more varied grain for the back wall (random per load)
export function drawWoodGrain(size, variant = 'frame') {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d4a470';
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const back = variant === 'back';
  const seedOffset = back ? Math.floor(Math.random() * 1000000) : 0;
  const rnd = (seed) => (((seed + seedOffset) * 1103515245 + 12345) >>> 0) / 0xffffffff;
  const numLines = Math.round(2400 * size / 2048);
  const cycles = Math.max(1, Math.round(0.006 * size / (2 * Math.PI)));
  const freq = (2 * Math.PI * cycles) / size;

  for (let i = 0; i < numLines; i++) {
    let x, w, waveAmp, wavePhase, noise;
    if (back) {
      x = (i / numLines) * size + (rnd(i * 7) - 0.5) * 6 + (rnd(i * 31) - 0.5) * 2;
      w = 0.14 + rnd(i * 13) * 0.32;
      const darkOpacity = 0.24 + rnd(i * 5) * 0.32;
      const lightOpacity = 0.2 + rnd(i * 11 + 100) * 0.28;
      const isDark = rnd(i * 19) > (0.42 + rnd(i * 47) * 0.2);
      const darkR = 58 + Math.floor(rnd(i * 53) * 16);
      const darkG = 44 + Math.floor(rnd(i * 61) * 14);
      const darkB = 30 + Math.floor(rnd(i * 71) * 14);
      const lightR = 218 + Math.floor(rnd(i * 41) * 20);
      const lightG = 198 + Math.floor(rnd(i * 43) * 22);
      const lightB = 168 + Math.floor(rnd(i * 59) * 20);
      ctx.strokeStyle = isDark ? `rgba(${darkR},${darkG},${darkB},${darkOpacity})` : `rgba(${lightR},${lightG},${lightB},${lightOpacity})`;
      waveAmp = 1.2 + rnd(i * 29) * 1.4;
      wavePhase = rnd(i * 37) * 6;
      noise = 1.8;
    } else {
      x = (i / numLines) * size + (rnd(i * 7) - 0.5) * 3;
      w = 0.28 + rnd(i * 13) * 0.38;
      const darkOpacity = 0.58 + rnd(i) * 0.26;
      const lightOpacity = 0.34 + rnd(i * 11) * 0.2;
      ctx.strokeStyle = rnd(i * 19) > 0.5 ? `rgba(62,48,34,${darkOpacity})` : `rgba(220,200,172,${lightOpacity})`;
      waveAmp = 1.5;
      wavePhase = 0;
      noise = 1.5;
    }
    ctx.lineWidth = w;
    // edge lines are drawn again one tile over so the pattern wraps sideways
    const xs = x < 8 ? [x, x + size] : x > size - 8 ? [x, x - size] : [x];
    for (const x0 of xs) {
      ctx.beginPath();
      ctx.moveTo(x0, -2);
      for (let y = 0; y <= size + 4; y += 1) {
        const yy = ((y % size) + size) % size;
        const wave = Math.sin(yy * freq + i * 0.25 + wavePhase) * waveAmp + (rnd(i * 17 + Math.floor(yy / 4)) - 0.5) * noise;
        ctx.lineTo(x0 + wave, y - 2);
      }
      ctx.stroke();
    }
  }
  return canvas;
}

// The same canvas turned 90°, for boards where the grain runs left–right.
export function rotateCanvas90(src) {
  const c = document.createElement('canvas');
  c.width = src.height;
  c.height = src.width;
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return c;
}
