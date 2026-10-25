import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ----- Book data from data.js (sets window.booksData) -----
// Parse YYYY-MM-DD as local date (no US/locale confusion, no UTC midnight shift).
function parseReadDate(str) {
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

function getBooks() {
  return (typeof window.booksData !== 'undefined' && Array.isArray(window.booksData)) ? window.booksData : [];
}
const SORT_MODES = {
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

const CURRENT_YEAR = 2026;
let currentSortKey = 'oldest';
let currentGenreFilter = 'all';
let genreFilterAnimating = false;
let shelfSortState = null;
let lastAnimTime = performance.now();

const GENRE_FILTER_MAP = {
  all: null,
  business: 'Business',
  biography: 'Biography',
  finance: 'Finance',
  history: 'History',
  science: 'Science',
  scifi: 'Science Fiction'
};

const GENRE_FILTER_LABELS = {
  all: 'All',
  business: 'Business',
  biography: 'Biography',
  finance: 'Finance',
  history: 'History',
  science: 'Science',
  scifi: 'Sci-Fi'
};

function getReadBooksForYear(year, sortKey = currentSortKey) {
  const yearNum = parseInt(year, 10);
  const mode = SORT_MODES[sortKey] || SORT_MODES.oldest;
  return getBooks()
    .filter(b => {
      const d = parseReadDate(b.readDate);
      return d && d.getFullYear() === yearNum;
    })
    .sort(mode.compare);
}

function formatReadDate(isoString) {
  if (!isoString) return '';
  const d = parseReadDate(isoString);
  if (!d) return isoString;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDuration(durationHours, durationMinutes) {
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

function coverUrl(isbn) {
  if (!isbn) return null;
  const path = 'covers/' + isbn + '.jpg';
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    const base = location.href.replace(/[#?].*$/, '').replace(/\/[^/]*$/, '/');
    return base + path;
  }
  return path;
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ----- Modal -----
const modalEl = document.getElementById('book-modal');
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

function openModal(book) {
  if (!book || !book.title) return;
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
  updateShelfToolbarUI();
  document.getElementById('canvas-container').style.pointerEvents = 'none';
  modalClose.focus();
}

let modalBookMesh = null;

function closeModal() {
  modalBookMesh = null;
  modalEl.hidden = true;
  updateShelfToolbarUI();
  document.getElementById('canvas-container').style.pointerEvents = '';
}

function cycleModalBook(direction) {
  if (modalEl.hidden || !modalBookMesh || !modalBookMesh.userData.bookData) return;
  const books = getReadBooksForYear(CURRENT_YEAR);
  if (books.length === 0) return;
  const currentBook = modalBookMesh.userData.bookData;
  const idx = books.findIndex(b => b.id === currentBook.id);
  if (idx < 0) return;
  const nextIdx = direction === 'prev' ? (idx - 1 + books.length) % books.length : (idx + 1) % books.length;
  const nextBook = books[nextIdx];
  const nextMesh = bookMeshes.find(m => m.userData.bookData && m.userData.bookData.id === nextBook.id);
  if (nextMesh) modalBookMesh = nextMesh;
  openModal(nextBook);
}

modalBackdrop.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);

var modalRatingInfoWrap = document.getElementById('modal-rating-info-wrap');
var modalRatingInfo = document.getElementById('modal-rating-info');
modalRatingInfo.addEventListener('click', function(e) {
  e.stopPropagation();
  modalRatingInfoWrap.classList.toggle('is-open');
});
modalRatingInfo.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    modalRatingInfoWrap.classList.toggle('is-open');
  }
});
document.addEventListener('click', function() {
  modalRatingInfoWrap.classList.remove('is-open');
});
modalEl.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    modalRatingInfoWrap.classList.remove('is-open');
    closeModal();
  } else if (e.key === 'ArrowLeft') { e.preventDefault(); cycleModalBook('prev'); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); cycleModalBook('next'); }
});

// ----- Three.js: head-on shelf only, dark wood grid, 1 book per cubby -----
const BOOKS_PER_CUBBY = 1;
const CUBBY_COLS = 9;
const MAX_ROWS = 7;
const CUBBY_WIDTH = 5.5;
const ROW_SPACING = 5.5;
const SHELF_WIDTH = CUBBY_COLS * CUBBY_WIDTH;
const SHELF_DEPTH = 3.4;
const SHELF_BACK_HEIGHT = 38;
const BOOK_INSET = 0.22;       // push regular books deeper into the shelf
const BOOK_INSET_AUDIO = 0.42; // audiobooks (thin) get pushed even deeper
const CUBBY_MAX_WIDTH = 5.2;
const CUBBY_MAX_HEIGHT = 5;
const BOOK_DEPTH = 0.42;
const BOOK_DEPTH_MIN = 0.28;
const BOOK_DEPTH_MAX = 0.56;
const BOOK_DEPTH_AUDIO = 0.06; // CD-case thin; no spine text
const BOOK_GAP = 0.5;

function getBookDepthFromPages(numberOfPages, type) {
  if (type === 'audio') return BOOK_DEPTH_AUDIO;
  const p = numberOfPages || 300;
  const t = Math.min(1, Math.max(0, (p - 80) / 620));
  return BOOK_DEPTH_MIN + t * (BOOK_DEPTH_MAX - BOOK_DEPTH_MIN);
}
const DEFAULT_COVER_ASPECT = 1650 / 2550;
const BOOK_SCALE = 0.94;
// Audiobooks (and square covers like 3000x3000) are scaled down so they're visually distinct from print/digital
const AUDIO_BOOK_SCALE = 0.78;
const SQUARE_ASPECT_MIN = 0.92;
const SQUARE_ASPECT_MAX = 1.08;

function fitBookDimensionsInCubby(imgWidth, imgHeight, options) {
  const aspect = imgWidth / imgHeight;
  let w, h;
  if (aspect >= CUBBY_MAX_WIDTH / CUBBY_MAX_HEIGHT) {
    w = CUBBY_MAX_WIDTH;
    h = CUBBY_MAX_WIDTH / aspect;
  } else {
    w = CUBBY_MAX_HEIGHT * aspect;
    h = CUBBY_MAX_HEIGHT;
  }
  let dim = { w: w * BOOK_SCALE, h: h * BOOK_SCALE };
  const isSquare = aspect >= SQUARE_ASPECT_MIN && aspect <= SQUARE_ASPECT_MAX;
  const treatAsAudio = (options && options.treatAsAudio) || isSquare;
  if (treatAsAudio) {
    dim.w *= AUDIO_BOOK_SCALE;
    dim.h *= AUDIO_BOOK_SCALE;
  }
  return dim;
}

const totalShelfHeight = (MAX_ROWS - 1) * ROW_SPACING + 0.5;

// Scene – soft radial background (lighter center, darker edges) + very faint texture
const scene = new THREE.Scene();
const bgSize = 512;
const bgCanvas = document.createElement('canvas');
bgCanvas.width = bgSize;
bgCanvas.height = bgSize;
const bgCtx = bgCanvas.getContext('2d');
const cx = bgSize / 2;
const cy = bgSize / 2;
const r = Math.sqrt(cx * cx + cy * cy);
const bgGrad = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
// Welcoming reading space: warm cream center, soft tan edges
bgGrad.addColorStop(0, '#e2d9ce');
bgGrad.addColorStop(0.35, '#d8cdc0');
bgGrad.addColorStop(0.7, '#c9bcaa');
bgGrad.addColorStop(1, '#b8a898');
bgCtx.fillStyle = bgGrad;
bgCtx.fillRect(0, 0, bgSize, bgSize);
// Very faint texture overlay (subtle grain)
const imageData = bgCtx.getImageData(0, 0, bgSize, bgSize);
const data = imageData.data;
for (let i = 0; i < data.length; i += 4) {
  const n = (Math.random() - 0.5) * 3;
  data[i] = Math.max(0, Math.min(255, data[i] + n));
  data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
  data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
}
bgCtx.putImageData(imageData, 0, 0);
const bgTexture = new THREE.CanvasTexture(bgCanvas);
bgTexture.colorSpace = THREE.SRGBColorSpace;
scene.background = bgTexture;
scene.fog = new THREE.Fog(0xc4b5a4, 55, 120);

const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1000);
// Default view: aim higher so the top of the shelf is visible (shelf top ~ y=0)
const viewCenterY = -15;

// Responsive zoom: default to most zoomed out so full shelf is visible; mobile can zoom out a bit further
function getZoomForViewport() {
  const w = window.innerWidth;
  if (w < 768) return { defaultDistance: 78, minDistance: 18, maxDistance: 78 };   // mobile: furthest out by default, allow slightly more zoom-out
  if (w < 1200) return { defaultDistance: 58, minDistance: 18, maxDistance: 58 };  // smaller devices: most zoomed out by default
  return { defaultDistance: 55, minDistance: 18, maxDistance: 55 };                 // desktop: most zoomed out by default
}

const zoom = getZoomForViewport();
// Centered but slight downward tilt: top of shelf feels closer than bottom
const defaultAzimuth = 0;
const defaultPolar = Math.PI * 0.44; // ~79° from vertical – camera slightly above, looking down
const d = zoom.defaultDistance;
camera.position.set(
  d * Math.sin(defaultPolar) * Math.sin(defaultAzimuth),
  viewCenterY + d * Math.cos(defaultPolar),
  d * Math.sin(defaultPolar) * Math.cos(defaultAzimuth)
);
camera.lookAt(0, viewCenterY, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const canvasContainer = document.getElementById('canvas-container');
canvasContainer.appendChild(renderer.domElement);
canvasContainer.style.opacity = '0';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableRotate = true;
// Limit vertical: can't go below horizon, and can't rotate fully over the top
controls.minPolarAngle = Math.PI * 0.28; // ~50° – almost above but not quite looking straight down
controls.maxPolarAngle = Math.PI / 2;
// Limit horizontal rotation: almost to the side but not quite (no back, not full 90°)
const maxAzimuth = Math.PI * 0.42; // ~76° – stops just short of full side view
controls.minAzimuthAngle = -maxAzimuth;
controls.maxAzimuthAngle = maxAzimuth;
controls.target.set(0, viewCenterY, 0);

function updateZoomLimits() {
  const { minDistance, maxDistance } = getZoomForViewport();
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
}
updateZoomLimits();

// Lights – iBooks style: soft overhead-from-front, even on book fronts, gentle falloff inside
const ambientLight = new THREE.AmbientLight(0xfffaf5, 0.8);
scene.add(ambientLight);
const mainLight = new THREE.DirectionalLight(0xffffff, 0.2);
mainLight.position.set(0, 24, 40);
mainLight.target.position.set(0, 0, 0.6);
scene.add(mainLight.target);
scene.add(mainLight);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 60;
mainLight.shadow.camera.left = -28;
mainLight.shadow.camera.right = 28;
mainLight.shadow.camera.top = 14;
mainLight.shadow.camera.bottom = -38;
mainLight.shadow.bias = -0.0002;
mainLight.shadow.radius = 30;
const fillLight = new THREE.DirectionalLight(0xfff4e8, 0.4);
fillLight.position.set(0, 16, 28);
fillLight.castShadow = false;
scene.add(fillLight);
// Soft side fill so vertical dividers are visible (they face left/right, not the main light)
const sideFillLeft = new THREE.DirectionalLight(0xfff8f0, 0.4);
sideFillLeft.position.set(14, 10, 24);
sideFillLeft.target.position.set(0, 0, 0);
scene.add(sideFillLeft.target);
scene.add(sideFillLeft);
const sideFillRight = new THREE.DirectionalLight(0xfff8f0, 0.4);
sideFillRight.position.set(-14, 10, 24);
sideFillRight.target.position.set(0, 0, 0);
scene.add(sideFillRight.target);
scene.add(sideFillRight);
// Soft overhead glow – library ceiling light feel
const overheadGlow = new THREE.DirectionalLight(0xfff0e0, 0.22);
overheadGlow.position.set(0, 28, 18);
overheadGlow.target.position.set(0, viewCenterY, 0);
scene.add(overheadGlow.target);
scene.add(overheadGlow);
// iBooks-style: clear bright highlight on front edge, even bright lighting overall
const shelfGlow = new THREE.PointLight(0xffeed8, 0.58, 42, 1.1);
shelfGlow.position.set(0, viewCenterY + 5, 8);
scene.add(shelfGlow);
const shelfGlowBack = new THREE.PointLight(0xffe4c8, 0.32, 32, 1.25);
shelfGlowBack.position.set(0, viewCenterY, -8);
scene.add(shelfGlowBack);

// Wood texture for decorations – iBooks-style rich golden oak/maple
function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 512, 0);
  gradient.addColorStop(0, '#e0d0a8');
  gradient.addColorStop(0.5, '#d0b078');
  gradient.addColorStop(1, '#e0d0a8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(120, 90, 58, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 512; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(230, 205, 165, 0.28)';
  for (let i = 0; i < 512; i += 48) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const woodTexture = createWoodTexture();

// Shelf wood grain (back wall): randomised per load, more mixed/varied pattern
function createShelfWoodTexture() {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d4a470';
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const seedOffset = Math.floor(Math.random() * 1000000);
  const rnd = (seed) => (((seed + seedOffset) * 1103515245 + 12345) >>> 0) / 0xffffffff;
  const numLines = 2400;
  for (let i = 0; i < numLines; i++) {
    const x = (i / numLines) * size + (rnd(i * 7) - 0.5) * 6 + (rnd(i * 31) - 0.5) * 2;
    const w = 0.14 + rnd(i * 13) * 0.32;
    const darkOpacity = 0.24 + rnd(i * 5) * 0.32;
    const lightOpacity = 0.2 + rnd(i * 11 + 100) * 0.28;
    const isDark = rnd(i * 19) > (0.42 + rnd(i * 47) * 0.2);
    // Same grain colour range as frame so back wall matches rest of shelf (lightened)
    const darkR = 58 + Math.floor(rnd(i * 53) * 16);
    const darkG = 44 + Math.floor(rnd(i * 61) * 14);
    const darkB = 30 + Math.floor(rnd(i * 71) * 14);
    const lightR = 218 + Math.floor(rnd(i * 41) * 20);
    const lightG = 198 + Math.floor(rnd(i * 43) * 22);
    const lightB = 168 + Math.floor(rnd(i * 59) * 20);
    ctx.strokeStyle = isDark ? `rgba(${darkR},${darkG},${darkB},${darkOpacity})` : `rgba(${lightR},${lightG},${lightB},${lightOpacity})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, -2);
    const waveAmp = 1.2 + rnd(i * 29) * 1.4;
    const wavePhase = rnd(i * 37) * 6;
    for (let y = 0; y <= size + 4; y += 1) {
      const wave = Math.sin(y * 0.006 + i * 0.25 + wavePhase) * waveAmp + (rnd(i * 17 + Math.floor(y / 4)) - 0.5) * 1.8;
      ctx.lineTo(x + wave, y - 2);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const shelfWoodGrainTexBack = createShelfWoodTexture();

// Frame texture: darker grain for dividers/sides/shelves (back wall keeps lighter grain)
function createShelfWoodTextureFrame() {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d4a470';
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const rnd = (seed) => ((seed * 1103515245 + 12345) >>> 0) / 0xffffffff;
  const numLines = 2400;
  for (let i = 0; i < numLines; i++) {
    const x = (i / numLines) * size + (rnd(i * 7) - 0.5) * 3;
    const w = 0.28 + rnd(i * 13) * 0.38;
    const darkOpacity = 0.58 + rnd(i) * 0.26;
    const lightOpacity = 0.34 + rnd(i * 11) * 0.2;
    ctx.strokeStyle = rnd(i * 19) > 0.5 ? `rgba(62,48,34,${darkOpacity})` : `rgba(220,200,172,${lightOpacity})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, -2);
    for (let y = 0; y <= size + 4; y += 1) {
      const wave = Math.sin(y * 0.006 + i * 0.25) * 1.5 + (rnd(i * 17 + Math.floor(y / 4)) - 0.5) * 1.5;
      ctx.lineTo(x + wave, y - 2);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const shelfWoodGrainTex = createShelfWoodTextureFrame();
// Rotated 90° for horizontal bars so grain runs along the board
const shelfWoodGrainTexHorizontal = shelfWoodGrainTex.clone();
shelfWoodGrainTexHorizontal.rotation = Math.PI / 2;
shelfWoodGrainTexHorizontal.center.set(0.5, 0.5);
// Back panel: same grain but finer scale (repeat so it’s not overdone on the large surface)
const SHELF_WOOD_COLOR = 0xc08850;
const shelfWoodMatVertical = new THREE.MeshStandardMaterial({
  map: shelfWoodGrainTex,
  color: 0xffffff,
  roughness: 0.72,
  metalness: 0.02
});
const shelfWoodMatVerticalBack = new THREE.MeshStandardMaterial({
  map: shelfWoodGrainTexBack,
  color: 0xffffff,
  roughness: 0.72,
  metalness: 0.02
});
const shelfWoodMatHorizontal = new THREE.MeshStandardMaterial({
  map: shelfWoodGrainTexHorizontal,
  color: 0xffffff,
  roughness: 0.72,
  metalness: 0.02
});

const sideW = 0.35;
// Full width of unit = cubby grid + both side panels (top/bottom bars and sides align)
const FULL_UNIT_WIDTH = SHELF_WIDTH + sideW * 2;
// Middle shelves span cubby width with small overlap; top/bottom use full width
const MID_SHELF_WIDTH = SHELF_WIDTH + 0.2;

function createShelfMesh(yPosition, boardHeight = 0.35, zOffset = 0, useFullWidth = false) {
  const group = new THREE.Group();
  const w = useFullWidth ? FULL_UNIT_WIDTH : MID_SHELF_WIDTH;
  const shelfGeom = new THREE.BoxGeometry(w, boardHeight, SHELF_DEPTH);
  const shelf = new THREE.Mesh(shelfGeom, shelfWoodMatHorizontal);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  group.add(shelf);
  group.position.y = yPosition;
  group.position.z = zOffset;
  return group;
}

function createShelfUnit() {
  const unit = new THREE.Group();
  const shelfYPositions = [];
  for (let i = 0; i < MAX_ROWS; i++) shelfYPositions.push(i * -ROW_SPACING);

  const boardThickness = 0.35;
  const gapHeight = ROW_SPACING - 0.35; // exact space between shelf bottom and next shelf top
  const firstDividerTopY = shelfYPositions[0] - ROW_SPACING / 2 + gapHeight / 2;   // = bottom of top board
  const lastDividerBottomY = shelfYPositions[MAX_ROWS - 2] - ROW_SPACING / 2 - gapHeight / 2; // = top of bottom board
  const topOfUnitY = firstDividerTopY + boardThickness * 2;
  const bottomOfUnitY = shelfYPositions[MAX_ROWS - 1] - boardThickness / 2 - 0.175;
  const unitHeight = topOfUnitY - bottomOfUnitY;
  const unitCenterY = (topOfUnitY + bottomOfUnitY) / 2;

  // Back and sides: cast soft shadows so each row/column reads as its own cubby (vertical grain). Back uses TexBack only – do not change.
  const backGeom = new THREE.BoxGeometry(FULL_UNIT_WIDTH + 0.1, unitHeight, 0.25);
  const back = new THREE.Mesh(backGeom, shelfWoodMatVerticalBack);
  back.position.set(0, unitCenterY, -SHELF_DEPTH / 2 - 0.125);
  back.castShadow = true;
  back.receiveShadow = true;
  unit.add(back);
  const sideGeom = new THREE.BoxGeometry(sideW, unitHeight, SHELF_DEPTH + 0.5);
  const leftSide = new THREE.Mesh(sideGeom, shelfWoodMatVertical);
  leftSide.position.set(-FULL_UNIT_WIDTH / 2 + sideW / 2, unitCenterY, 0);
  leftSide.castShadow = true;
  leftSide.receiveShadow = true;
  unit.add(leftSide);
  const rightSide = new THREE.Mesh(sideGeom, shelfWoodMatVertical);
  rightSide.position.set(FULL_UNIT_WIDTH / 2 - sideW / 2, unitCenterY, 0);
  rightSide.castShadow = true;
  rightSide.receiveShadow = true;
  unit.add(rightSide);

  // Middle shelf boards (cubby width)
  for (let i = 1; i < MAX_ROWS - 1; i++) {
    unit.add(createShelfMesh(shelfYPositions[i], boardThickness, 0, false));
  }

  // Dividers: full height in each gap so they meet shelf above and below exactly (flush, vertical grain)
  const dividerW = 0.2;
  const dividerGeom = new THREE.BoxGeometry(dividerW, gapHeight, SHELF_DEPTH);
  for (let g = 0; g < MAX_ROWS - 1; g++) {
    const gapCenterY = shelfYPositions[g] - ROW_SPACING / 2;
    for (let i = 1; i < CUBBY_COLS; i++) {
      const div = new THREE.Mesh(dividerGeom, shelfWoodMatVertical);
      div.position.set(-SHELF_WIDTH / 2 + i * CUBBY_WIDTH, gapCenterY, 0);
      div.castShadow = true;
      div.receiveShadow = true;
      unit.add(div);
    }
  }

  // Top and bottom boards: meet dividers exactly (no overlap = flush)
  const topBoardBottomY = firstDividerTopY;
  const topBoardHeight = topOfUnitY - topBoardBottomY;
  const topBoardCenterY = (topBoardBottomY + topOfUnitY) / 2;
  const topBoard = createShelfMesh(topBoardCenterY, topBoardHeight, 0.03, true);
  topBoard.renderOrder = 1;
  unit.add(topBoard);

  const bottomBoardTopY = lastDividerBottomY;
  const bottomBoardHeight = bottomBoardTopY - bottomOfUnitY;
  const bottomBoardCenterY = (bottomOfUnitY + bottomBoardTopY) / 2;
  const bottomBoard = createShelfMesh(bottomBoardCenterY, bottomBoardHeight, 0.03, true);
  bottomBoard.renderOrder = 1;
  unit.add(bottomBoard);

  return unit;
}

const coverColors = [
  [0x2c5282, 0x2b6cb0],
  [0x9b2c2c, 0xc53030],
  [0x276749, 0x2f8558],
  [0x744210, 0x975a16],
  [0x553c9a, 0x6b46c1],
  [0x086f83, 0x0e7490],
  [0x1e3a5f, 0x234e77],
  [0x9c4221, 0xb45309],
  [0x1e40af, 0x2563eb],
  [0x831843, 0x9d174d]
];

function getSpineColorFromCanvas(canvas) {
  const stripWidth = Math.max(1, Math.floor(canvas.width * 0.08));
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, stripWidth, canvas.height).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (n === 0) return 0x6b6b6b;
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);
  return (r << 16) | (g << 8) | b;
}

function getSpineColorFromImage(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return getSpineColorFromCanvas(c);
}

function createSpineTexture(bookData, spineColor, spineAspect) {
  const ch = 512;
  const aspect = spineAspect != null ? spineAspect : 0.1;
  const cw = Math.max(48, Math.round(ch * aspect));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const r = (spineColor >> 16) & 0xff;
  const g = (spineColor >> 8) & 0xff;
  const b = spineColor & 0xff;
  ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 0, Math.ceil(cw * 0.12), ch);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(cw - Math.ceil(cw * 0.12), 0, Math.ceil(cw * 0.12), ch);
  // Audiobooks are too thin for readable spine text (CD-case style)
  if (bookData.type !== 'audio') {
    const title = (bookData.title || 'Book').trim();
    const maxSpinePx = ch; // text runs along spine height (512px)
    const maxFontSize = 26;
    const minFontSize = 10;
    let fontSize = maxFontSize;
    ctx.font = '400 ' + fontSize + 'px Arial, Helvetica, sans-serif';
    let w = ctx.measureText(title).width;
    if (w > maxSpinePx) {
      fontSize = Math.max(minFontSize, Math.floor(maxFontSize * (maxSpinePx / w)));
      ctx.font = '400 ' + fontSize + 'px Arial, Helvetica, sans-serif';
    }
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.scale(-1, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 4;
    ctx.fillText(title, 0, 0);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function createFakeCoverTexture(bookData, sizeIndex, aspectRatio) {
  const ratio = aspectRatio || DEFAULT_COVER_ASPECT;
  const base = 768;
  const cw = ratio >= 1 ? base : Math.round(base * ratio);
  const ch = ratio >= 1 ? Math.round(base / ratio) : base;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const pair = coverColors[(bookData.id || sizeIndex).toString().length % coverColors.length];
  const top = '#' + ('000000' + (pair[0] >>> 0).toString(16)).slice(-6);
  const bottom = '#' + ('000000' + (pair[1] >>> 0).toString(16)).slice(-6);
  const gradient = ctx.createLinearGradient(0, 0, 0, ch);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, cw, ch * 0.12);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, ch * 0.88, cw, ch * 0.12);
  const title = (bookData.title || 'Book').trim();
  const shortTitle = title.length > 22 ? title.slice(0, 19) + '…' : title;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  const fontScale = Math.min(cw, ch) / 400;
  ctx.font = 'bold ' + Math.round(76 * fontScale) + 'px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillText(shortTitle, cw / 2, ch / 2 - 24 * fontScale);
  ctx.font = Math.round(48 * fontScale) + 'px Georgia, serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(bookData.author || '', cw / 2, ch / 2 + 56 * fontScale);
  ctx.shadowBlur = 0;
  const spineColor = getSpineColorFromCanvas(canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return { texture, spineColor };
}

const textureLoader = new THREE.TextureLoader();

function loadCoverTexture(url) {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = true;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        resolve(tex);
      },
      undefined,
      () => reject(new Error('Failed to load cover: ' + url))
    );
  });
}

const PAGE_EDGE_COLOR = 0xf5f5f0;
const PAGE_EDGE_SHADOW_COLOR = 0xe5e0d8;

function createBookMesh(bookData, sizeIndex) {
  const group = new THREE.Group();
  const scale = 0.998 - (sizeIndex % 10) * 0.002;
  const isAudio = bookData.type === 'audio';
  const defaultDim = fitBookDimensionsInCubby(isAudio ? 3000 : 1650, isAudio ? 3000 : 2550, { treatAsAudio: isAudio });
  const w = defaultDim.w * scale;
  const h = defaultDim.h * scale;
  const d = getBookDepthFromPages(bookData.numberOfPages, bookData.type);
  const fakeResult = createFakeCoverTexture(bookData, sizeIndex, w / h);
  const fakeCover = fakeResult.texture;
  const spineColor = fakeResult.spineColor;
  const spineAspect = d / h;
  const spineTexture = createSpineTexture(bookData, spineColor, spineAspect);
  // Emissive so cover keeps its vibrancy and isn't washed out by soft scene lighting
  const coverMat = new THREE.MeshStandardMaterial({
    map: fakeCover,
    emissiveMap: fakeCover,
    emissive: 0xffffff,
    emissiveIntensity: 0.32,
    roughness: 0.7,
    metalness: 0.05
  });
  const spineMat = new THREE.MeshStandardMaterial({
    map: spineTexture,
    color: 0xffffff,
    roughness: 0.9
  });
  const materials = [
    new THREE.MeshStandardMaterial({ color: PAGE_EDGE_COLOR, roughness: 0.9 }),
    spineMat,
    new THREE.MeshStandardMaterial({ color: PAGE_EDGE_SHADOW_COLOR, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: PAGE_EDGE_SHADOW_COLOR, roughness: 0.9 }),
    coverMat,
    new THREE.MeshStandardMaterial({ color: PAGE_EDGE_COLOR, roughness: 0.9 })
  ];
  const bookGeom = new THREE.BoxGeometry(w, h, d);
  const bookMesh = new THREE.Mesh(bookGeom, materials);
  bookMesh.castShadow = true;
  bookMesh.receiveShadow = true;
  bookMesh.position.y = h / 2;
  group.add(bookMesh);
  group.userData = {
    ownerGroup: group,
    bookData: bookData,
    originalY: 0,
    targetY: 0,
    originalZ: 0,
    targetZ: 0,
    isHovered: false,
    coverMat: coverMat,
    spineMat: spineMat,
    defaultCoverTex: fakeCover,
    bookMesh: bookMesh,
    bookDepth: d,
    spineAspect: spineAspect,
    spineTex: spineTexture,
    setCoverTexture(tex, imageForSpine) {
      if (this.coverMat && this.defaultCoverTex) {
        this.defaultCoverTex.dispose();
        this.defaultCoverTex = null;
      }
      if (this.coverMat) {
        this.coverMat.map = tex;
        this.coverMat.emissiveMap = tex;
      }
      if (this.spineMat && imageForSpine && this.bookData) {
        if (this.spineTex) this.spineTex.dispose();
        const newSpineColor = getSpineColorFromImage(imageForSpine);
        this.spineTex = createSpineTexture(this.bookData, newSpineColor, this.spineAspect);
        this.spineMat.map = this.spineTex;
      }
      if ((this.genreFade ?? 0) > 0 && this.ownerGroup) {
        applyGenreFadeToBook(this.ownerGroup, this.genreFade);
      }
    },
    setBookDimensions(imgWidth, imgHeight) {
      const dim = fitBookDimensionsInCubby(imgWidth, imgHeight, { treatAsAudio: this.bookData && this.bookData.type === 'audio' });
      const w2 = dim.w;
      const h2 = dim.h;
      const d2 = this.bookDepth;
      const bookMesh = this.bookMesh;
      if (bookMesh.geometry) bookMesh.geometry.dispose();
      bookMesh.geometry = new THREE.BoxGeometry(w2, h2, d2);
      bookMesh.position.y = h2 / 2;
    }
  };
  return group;
}

function createPlaceholderSpineTexture(seed) {
  const canvas = document.createElement('canvas');
  const px = 128;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  const hue = (seed * 37) % 360;
  const sat = 25 + (seed % 15);
  const light = 35 + (seed % 20);
  ctx.fillStyle = 'hsl(' + hue + ',' + sat + '%,' + light + '%)';
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, px, px * 0.15);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, px * 0.85, px, px * 0.15);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.font = '14px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) ctx.fillText('—', px / 2, px / 2 - 20 + i * 20);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

function createPlaceholderSpineMesh(slotIndex) {
  const group = new THREE.Group();
  const spineW = 0.35;
  const h = CUBBY_MAX_HEIGHT * (0.92 + (slotIndex % 5) * 0.02);
  const d = BOOK_DEPTH * 1.2;
  const tex = createPlaceholderSpineTexture(slotIndex);
  const materials = [
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x3d3630, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x2c2520, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x2c2520, roughness: 0.9 })
  ];
  const geom = new THREE.BoxGeometry(spineW, h, d);
  const mesh = new THREE.Mesh(geom, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.y = h / 2;
  group.add(mesh);
  group.rotation.y = Math.PI / 2;
  group.userData = { bookData: null };
  return group;
}

let shelfUnit = null;
let bookMeshes = [];
let placeholderMeshes = [];
let decorationMeshes = [];

const SHELF_Y_BY_ROW = Array.from({ length: MAX_ROWS }, (_, i) => i * -ROW_SPACING);
const CUBBY_ROWS = MAX_ROWS - 1;
const SLOTS_TOTAL = CUBBY_ROWS * CUBBY_COLS * BOOKS_PER_CUBBY;
const boardThickness = 0.35;

const SHELF_FRONT_Z = SHELF_DEPTH / 2;
const BOOK_FORWARD_CLEARANCE = 0.22; // past divider/shelf front face (+Z)
const BOOK_HOVER_FORWARD_EXTRA = 0;
const BOOK_DRAG_FORWARD_EXTRA = 0.14;
const BOOK_OPEN_FORWARD_EXTRA = 0.28;
const BOOK_HOVER_LIFT_Y = 0.5;
const BOOK_OPEN_LIFT_Y = 0.55;
const BOOK_RAISED_RENDER_ORDER = 12;

function getBookRestZ(bookDepth) {
  const d = bookDepth != null ? bookDepth : BOOK_DEPTH;
  const inset = (d != null && d <= 0.11) ? BOOK_INSET_AUDIO : BOOK_INSET;
  return SHELF_FRONT_Z - d - 0.02 - inset;
}

function getBookForwardZ(bookDepth, forwardExtra = 0) {
  const d = bookDepth != null ? bookDepth : BOOK_DEPTH;
  return SHELF_FRONT_Z + d * 0.5 + BOOK_FORWARD_CLEARANCE + forwardExtra;
}

function getCubbyPosition(row, col, bookHeight, bookDepth) {
  const x = -SHELF_WIDTH / 2 + (col + 0.5) * CUBBY_WIDTH;
  const floorY = -(row + 1) * ROW_SPACING + boardThickness / 2;
  const y = floorY;
  const z = getBookRestZ(bookDepth);
  return { x, y, z };
}

// Map world (x,y) on the shelf plane to cubby (row, col)
function getCubbyFromWorld(x, y) {
  const col = Math.round((x + SHELF_WIDTH / 2) / CUBBY_WIDTH - 0.5);
  const row = Math.round((y - boardThickness / 2) / -ROW_SPACING - 1);
  return {
    row: Math.max(0, Math.min(CUBBY_ROWS - 1, row)),
    col: Math.max(0, Math.min(CUBBY_COLS - 1, col))
  };
}

function isPointInShelfBounds(x, y) {
  const halfW = SHELF_WIDTH / 2;
  if (x < -halfW || x > halfW) return false;
  const bottomFloorY = -CUBBY_ROWS * ROW_SPACING + boardThickness / 2;
  const topFloorY = -ROW_SPACING + boardThickness / 2;
  const topCeilingY = topFloorY + (ROW_SPACING - boardThickness);
  const margin = ROW_SPACING * 0.12;
  return y >= bottomFloorY - margin && y <= topCeilingY + margin;
}

function getBookAtCubby(row, col, excludeGroup) {
  return bookMeshes.find(m => m !== excludeGroup && m.userData.cubbyRow === row && m.userData.cubbyCol === col) || null;
}

function getCubbyFloorCenter(row, col) {
  const pos = getCubbyPosition(row, col, 0.5, BOOK_DEPTH);
  return { x: pos.x, floorY: pos.y, z: pos.z };
}

function slotIndexToCubby(slotIndex) {
  const row = Math.floor(slotIndex / (CUBBY_COLS * BOOKS_PER_CUBBY));
  const col = Math.floor((slotIndex % (CUBBY_COLS * BOOKS_PER_CUBBY)) / BOOKS_PER_CUBBY);
  return { row, col };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpVec3(out, a, b, t) {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}

// ----- Empty cubby fills: horizontal placeholder books + optional lamp/candle/plant -----
const CUBBY_FILL_MARGIN = 0.2;
const DECORATION_SCALE = 2.5;
const DECORATION_INSET = 0.22; // nudge away from vertical dividers so lamp/plant/candle don't clip

function decoMat(color, roughness = 0.7) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

// Spine texture: darker, more desaturated neutrals (cream, tan, grey-beige), subtle variation
function createHorizontalSpineTexture(seed) {
  const w = 48;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rnd = (s) => ((seed * 37 + s) * 1103515245 >>> 0) / 0xffffffff;
  const hue = 26 + rnd(1) * 22;
  const sat = 4 + rnd(2) * 6;
  const light = 44 + rnd(3) * 12;
  ctx.fillStyle = 'hsl(' + hue + ',' + sat + '%,' + light + '%)';
  ctx.fillRect(0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rnd(i) - 0.5) * 10;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  return tex;
}

// Same shape as real books (box with spine, cover, depth) but rotated so spine faces +Z (camera). Depth = into shelf (cover height).
const GHOST_NEUTRALS = [0xf4f0e8, 0xf0ebe4, 0xf8f4ec, 0xeee8e0, 0xf2ece4];
const GHOST_FILTERED_BOOK_OPACITY = 0.48;
const GHOST_FILTERED_COVER_EMISSIVE = 0.04;
const GHOST_FILTERED_COLOR_TINT = 0xa8a39c;
const GHOST_FILTERED_SPINE_TINT = 0xb5afa8;
const GENRE_FADE_MS = 420;
const _genreColorA = new THREE.Color();
const _genreColorB = new THREE.Color();

function bookMatchesGenreFilter(bookData, filterKey) {
  if (!filterKey || filterKey === 'all') return true;
  const target = GENRE_FILTER_MAP[filterKey];
  if (!target) return true;
  const genres = bookData && bookData.genres ? bookData.genres : [];
  return genres.indexOf(target) !== -1;
}

function getGenreFilterCounts(year = CURRENT_YEAR) {
  const books = getReadBooksForYear(year, 'oldest');
  const counts = { all: books.length };
  Object.keys(GENRE_FILTER_MAP).forEach(key => {
    if (key === 'all') return;
    counts[key] = books.filter(b => bookMatchesGenreFilter(b, key)).length;
  });
  return counts;
}

function updateGenreFilterLabels(year = CURRENT_YEAR) {
  const nav = document.getElementById('shelf-genre-filter');
  if (!nav) return;
  const counts = getGenreFilterCounts(year);
  nav.querySelectorAll('.shelf-chip-btn[data-genre]').forEach(btn => {
    const key = btn.dataset.genre;
    const label = GENRE_FILTER_LABELS[key] || key;
    const n = counts[key] ?? 0;
    btn.textContent = label + ' (' + n + ')';
  });
}

function saveBookMaterialSnapshot(bookMesh) {
  const mats = bookMesh.material;
  if (!Array.isArray(mats)) return null;
  return mats.map(m => ({
    transparent: m.transparent,
    opacity: m.opacity,
    color: m.color.getHex(),
    map: m.map,
    emissiveMap: m.emissiveMap,
    emissive: m.emissive.getHex(),
    emissiveIntensity: m.emissiveIntensity
  }));
}

function getGhostMaterialState(materialIndex) {
  if (materialIndex === 4) {
    return {
      opacity: GHOST_FILTERED_BOOK_OPACITY,
      emissiveIntensity: GHOST_FILTERED_COVER_EMISSIVE,
      color: GHOST_FILTERED_COLOR_TINT
    };
  }
  if (materialIndex === 1) {
    return {
      opacity: GHOST_FILTERED_BOOK_OPACITY * 0.92,
      emissiveIntensity: 0,
      color: GHOST_FILTERED_SPINE_TINT
    };
  }
  return { opacity: 0.55, emissiveIntensity: 0, color: 0xd8d3cc };
}

function applyGenreFadeToBook(group, t) {
  const ud = group.userData;
  const bookMesh = ud.bookMesh;
  if (!bookMesh) return;
  const mats = bookMesh.material;
  if (!Array.isArray(mats)) return;

  const fade = Math.max(0, Math.min(1, t));
  if (fade > 0 && !ud.savedMatState) {
    ud.savedMatState = saveBookMaterialSnapshot(bookMesh);
  }
  const snap = ud.savedMatState;
  if (!snap) return;

  ud.genreFade = fade;
  ud.isGenreGhost = fade > 0.12;

  mats.forEach((m, i) => {
    const s = snap[i];
    const g = getGhostMaterialState(i);
    if (!s) return;
    m.transparent = fade > 0.001 || s.transparent;
    m.depthWrite = true;
    m.map = s.map;
    m.emissiveMap = s.emissiveMap;
    m.opacity = s.opacity + (g.opacity - s.opacity) * fade;
    m.emissiveIntensity = s.emissiveIntensity + (g.emissiveIntensity - s.emissiveIntensity) * fade;
    _genreColorA.setHex(s.color);
    _genreColorB.setHex(g.color);
    m.color.copy(_genreColorA).lerp(_genreColorB, fade);
    m.emissive.setHex(s.emissive);
    m.needsUpdate = true;
  });

  if (fade <= 0) {
    restoreBookMaterials(group);
  }
}

function restoreBookMaterials(group) {
  const ud = group.userData;
  const bookMesh = ud.bookMesh;
  const saved = ud.savedMatState;
  if (!bookMesh || !saved) return;
  const mats = bookMesh.material;
  if (!Array.isArray(mats)) return;
  mats.forEach((m, i) => {
    const s = saved[i];
    if (!s) return;
    m.transparent = s.transparent;
    m.opacity = s.opacity;
    m.color.setHex(s.color);
    m.map = s.map;
    m.emissiveMap = s.emissiveMap;
    m.emissive.setHex(s.emissive);
    m.emissiveIntensity = s.emissiveIntensity;
    m.depthWrite = true;
    m.needsUpdate = true;
  });
  ud.savedMatState = null;
  ud.isGenreGhost = false;
  ud.genreFade = 0;
}

function updateGenreFilterAnimations(deltaMs) {
  const wasAnimating = genreFilterAnimating;
  genreFilterAnimating = false;
  const step = deltaMs / GENRE_FADE_MS;

  bookMeshes.forEach(mesh => {
    const ud = mesh.userData;
    if (ud.genreFadeTarget === undefined) return;

    let cur = ud.genreFade ?? 0;
    const tgt = ud.genreFadeTarget;

    if (Math.abs(cur - tgt) < 0.02) {
      if (cur !== tgt) {
        ud.genreFade = tgt;
        if (tgt === 0) restoreBookMaterials(mesh);
        else applyGenreFadeToBook(mesh, 1);
      }
      return;
    }

    genreFilterAnimating = true;
    cur += Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), step);
    ud.genreFade = cur;
    applyGenreFadeToBook(mesh, cur);
  });

  if (wasAnimating && !genreFilterAnimating) {
    updateShelfToolbarUI();
  }
}

function applyGenreFilterToShelf(filterKey, instant) {
  currentGenreFilter = filterKey;
  bookMeshes.forEach(mesh => {
    const book = mesh.userData.bookData;
    const match = bookMatchesGenreFilter(book, filterKey);
    const target = match ? 0 : 1;
    mesh.userData.genreFadeTarget = target;
    mesh.userData.isHovered = false;

    if (instant) {
      mesh.userData.genreFade = target;
      if (target === 0) {
        if (mesh.userData.savedMatState) restoreBookMaterials(mesh);
      } else {
        applyGenreFadeToBook(mesh, 1);
      }
      return;
    }

    if (mesh.userData.genreFade === undefined) {
      mesh.userData.genreFade = target;
    }
    if (Math.abs((mesh.userData.genreFade ?? 0) - target) >= 0.02) {
      genreFilterAnimating = true;
    }
  });
  updateShelfToolbarUI();
}

function createHorizontalBook(spineWidth, spineHeight, depthIntoShell, seed) {
  const spineTex = createHorizontalSpineTexture(seed);
  const neutral = GHOST_NEUTRALS[(seed >>> 0) % GHOST_NEUTRALS.length];
  const opacity = 0.42;
  const spineMat = new THREE.MeshStandardMaterial({
    map: spineTex,
    roughness: 0.85,
    transparent: true,
    opacity: opacity
  });
  const coverMat = new THREE.MeshStandardMaterial({
    color: neutral,
    roughness: 0.9,
    transparent: true,
    opacity: opacity
  });
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0xfcfaf6,
    roughness: 0.9,
    transparent: true,
    opacity: opacity
  });
  const materials = [
    pageMat,
    pageMat,
    coverMat,
    pageMat,
    spineMat,
    pageMat
  ];
  const geom = new THREE.BoxGeometry(spineWidth, spineHeight, depthIntoShell);
  const mesh = new THREE.Mesh(geom, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.y = spineHeight / 2;
  return mesh;
}

// Layouts: books only (2–6), or books + one item (lamp, candle, plant)
function createDecorationCandle() {
  // Jar = open cylinder (no top) + bottom disc, so wax sits fully inside with no z-fighting.
  const g = new THREE.Group();
  const jarH = 0.5;
  const jarMat = decoMat(0x5c2830);
  const jarWalls = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.16, jarH, 12, 1, true),
    jarMat
  );
  jarWalls.position.y = jarH / 2;
  jarWalls.castShadow = true;
  g.add(jarWalls);
  const jarBottom = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), jarMat);
  jarBottom.rotation.x = -Math.PI / 2;
  jarBottom.position.y = 0;
  jarBottom.castShadow = true;
  g.add(jarBottom);
  const rimThickness = 0.02;
  const jarRim = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.18, 16),
    jarMat
  );
  jarRim.rotation.x = -Math.PI / 2;
  jarRim.position.y = jarH;
  g.add(jarRim);
  const waxH = 0.11;
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, waxH, 24), decoMat(0xfff8e7));
  wax.position.y = jarH - waxH / 2 - 0.01;
  wax.castShadow = true;
  g.add(wax);
  const flameH = 0.12;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.04, flameH, 16), decoMat(0xffaa00));
  flame.position.y = jarH + flameH / 2 + 0.004;
  g.add(flame);
  g.userData.height = jarH + flameH + 0.004;
  return g;
}

function createDecorationLamp() {
  // Desk lamp sized to sit next to books (~half book height when scaled). Base at y=0.
  const g = new THREE.Group();
  const baseH = 0.1;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, baseH, 12), decoMat(0x2a2a2a));
  base.position.y = baseH / 2;
  g.add(base);
  const stemH = 0.52;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, stemH, 8), decoMat(0x1a1a1a));
  stem.position.y = baseH + stemH / 2;
  g.add(stem);
  const shadeH = 0.34;
  // Shade: wider at bottom (near stem), narrower at top; shade wider than base
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.2, shadeH, 12), decoMat(0xf5f5dc));
  shade.position.y = baseH + stemH + shadeH / 2;
  shade.rotation.x = Math.PI;
  g.add(shade);
  const lampLight = new THREE.PointLight(0xffeedd, 0.5, 4, 0.8);
  lampLight.position.y = baseH + stemH + shadeH * 0.4;
  g.add(lampLight);
  g.userData.height = baseH + stemH + shadeH;
  return g;
}

function createDecorationPlantSucculent() {
  // Type 1: Succulent – pot + cluster of chunky “leaves” (rosette / jade style), not one orb. Base at y=0.
  const g = new THREE.Group();
  const potH = 0.26;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, potH, 12), decoMat(0x8b6914));
  pot.position.y = potH / 2;
  pot.castShadow = true;
  g.add(pot);
  const leafMat = decoMat(0x4a7c59);
  // Chunky succulent leaves: position [x, y, z], radius, slight scale variation
  const leaves = [
    [0, potH + 0.14, 0, 0.14],
    [0.1, potH + 0.22, 0.04, 0.12],
    [-0.08, potH + 0.2, -0.02, 0.11],
    [0.02, potH + 0.28, 0.06, 0.1],
    [-0.06, potH + 0.26, -0.04, 0.09],
    [0.07, potH + 0.18, -0.03, 0.08],
    [-0.04, potH + 0.16, 0.05, 0.07]
  ];
  leaves.forEach(([px, py, pz, r]) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leafMat);
    leaf.position.set(px, py, pz);
    leaf.scale.set(1, 1.05, 0.92);
    leaf.castShadow = true;
    g.add(leaf);
  });
  g.userData.height = potH + 0.38;
  return g;
}

function createDecorationPlantTrailing() {
  // Type 2: Small leafy plant – pot + stem/twig + leaves clustered around it. Base at y=0.
  const g = new THREE.Group();
  const potH = 0.22;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, potH, 12), decoMat(0x6b5344));
  pot.position.y = potH / 2;
  pot.castShadow = true;
  g.add(pot);
  const stemH = 0.32;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, stemH, 6), decoMat(0x5c4a3a));
  stem.position.y = potH + stemH / 2;
  stem.castShadow = true;
  g.add(stem);
  const leafMat = decoMat(0x3d6b50);
  const leaves = [
    [0, potH + 0.18, 0],
    [0.12, potH + 0.22, 0.05],
    [-0.08, potH + 0.2, -0.03],
    [0.05, potH + 0.28, 0.08],
    [-0.06, potH + 0.26, 0.04]
  ];
  leaves.forEach(([px, py, pz], i) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12 + (i % 3) * 0.03, 8, 6), leafMat);
    leaf.position.set(px, py, pz);
    leaf.castShadow = true;
    g.add(leaf);
  });
  g.userData.height = potH + 0.38;
  return g;
}

const LAYOUT_TYPES = [
  'full_books', 'full_books', 'full_books', 'full_books', 'full_books',
  'few_books', 'few_books', 'few_books', 'few_books',
  'books_plant', 'books_candle', 'books_lamp',
  'plant_only', 'candle_only', 'lamp_only'
];

const GHOST_FRONT_MARGIN = 0.1;
const EMPTY_FILL_RATE_MIN = 0.28;
const EMPTY_FILL_RATE_MAX = 0.52;
const MAX_PLANTS = 4;
const MAX_CANDLES = 2;
const MAX_LAMPS = 2;

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildCubbyLayout(row, col, layout) {
  const pos = getCubbyFloorCenter(row, col);
  const group = new THREE.Group();
  const ghostCenterZ = -GHOST_FRONT_MARGIN / 2;
  group.position.set(pos.x, pos.floorY + ROW_SPACING / 2, ghostCenterZ);
  group.userData.cubbyRow = row;
  group.userData.cubbyCol = col;
  group.userData.layoutType = layout;
  const hasDecoration = layout.includes('plant') || layout.includes('candle') || layout.includes('lamp');
  // Reserve enough width for lamp/plant/candle (scaled) + gap so they don't overlap ghost books
  const decorationSpace = hasDecoration ? 2.7 : 0;
  const availableWidth = CUBBY_WIDTH - 2 * CUBBY_FILL_MARGIN - decorationSpace;

  const floorYLocal = -ROW_SPACING / 2;
  const spineHeightMax = CUBBY_MAX_HEIGHT * BOOK_SCALE * 0.92;

  const bookWidths = [];
  if (layout === 'full_books') {
    const targetFill = availableWidth * (0.65 + Math.random() * 0.22);
    let totalW = 0;
    while (totalW < targetFill) {
      const w = BOOK_DEPTH_MIN + Math.random() * (BOOK_DEPTH_MAX - BOOK_DEPTH_MIN);
      if (totalW + w > targetFill) break;
      bookWidths.push(w);
      totalW += w;
    }
    if (bookWidths.length === 0) bookWidths.push(Math.min(availableWidth * 0.4, BOOK_DEPTH_MAX));
  } else if (layout === 'few_books') {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      bookWidths.push(BOOK_DEPTH_MIN + Math.random() * (BOOK_DEPTH_MAX - BOOK_DEPTH_MIN));
    }
  } else if (hasDecoration) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      bookWidths.push(BOOK_DEPTH_MIN + Math.random() * (BOOK_DEPTH_MAX - BOOK_DEPTH_MIN));
    }
  }

  const maxDepth = SHELF_DEPTH - GHOST_FRONT_MARGIN;

  const totalBookWidth = bookWidths.length ? bookWidths.reduce((a, w) => a + w, 0) : 0;
  const alignRight = Math.random() < 0.5;
  const xOffset = alignRight ? (CUBBY_WIDTH - 2 * CUBBY_FILL_MARGIN - totalBookWidth) : 0;

  let x = -CUBBY_WIDTH / 2 + CUBBY_FILL_MARGIN;
  for (let i = 0; i < bookWidths.length; i++) {
    const spineWidth = bookWidths[i];
    const spineHeight = spineHeightMax * (0.68 + Math.random() * 0.32);
    const depthIntoShell = maxDepth * (0.7 + Math.random() * 0.3);
    const book = createHorizontalBook(spineWidth, spineHeight, depthIntoShell, row * 1000 + col * 37 + i * 7);
    const zOffset = (Math.random() - 0.5) * 0.38;
    book.position.set(x + spineWidth / 2 + xOffset, floorYLocal + spineHeight / 2, zOffset);
    group.add(book);
    x += spineWidth;
  }

  if (hasDecoration) {
    let deco;
    if (layout === 'plant_only' || layout === 'books_plant') {
      deco = Math.random() < 0.5 ? createDecorationPlantSucculent() : createDecorationPlantTrailing();
    } else if (layout === 'candle_only' || layout === 'books_candle') {
      deco = createDecorationCandle();
    } else {
      deco = createDecorationLamp();
    }
    deco.scale.setScalar(DECORATION_SCALE);
    let decoX = bookWidths.length === 0
      ? 0
      : (alignRight ? -CUBBY_WIDTH / 2 + CUBBY_FILL_MARGIN + decorationSpace / 2 : x + decorationSpace / 2);
    if (bookWidths.length > 0) {
      decoX += alignRight ? DECORATION_INSET : -DECORATION_INSET; // keep away from vertical dividers
    }
    // Place decoration so its base (y=0) sits on the shelf; nudge down to avoid floating
    deco.position.set(decoX, floorYLocal - 0.04, 0);
    deco.rotation.y = (Math.random() - 0.5) * 0.3;
    deco.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    group.add(deco);
  }

  group.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return group;
}

function removeDecorationAtCubby(row, col) {
  const idx = decorationMeshes.findIndex(d => d.userData.cubbyRow === row && d.userData.cubbyCol === col);
  if (idx === -1) return;
  const deco = decorationMeshes[idx];
  scene.remove(deco);
  decorationMeshes.splice(idx, 1);
}

function countShelfDecorations() {
  let plantCount = 0;
  let candleCount = 0;
  let lampCount = 0;
  decorationMeshes.forEach(d => {
    const layout = d.userData.layoutType || '';
    if (layout.includes('plant')) plantCount++;
    if (layout.includes('candle')) candleCount++;
    if (layout.includes('lamp')) lampCount++;
  });
  return { plantCount, candleCount, lampCount };
}

function fillEmptyCubbies(emptyCubbies) {
  const { plantCount, candleCount, lampCount } = countShelfDecorations();
  const fillRate = EMPTY_FILL_RATE_MIN + Math.random() * (EMPTY_FILL_RATE_MAX - EMPTY_FILL_RATE_MIN);
  shuffleArray(emptyCubbies);
  let plants = plantCount;
  let candles = candleCount;
  let lamps = lampCount;
  for (const { row, col } of emptyCubbies) {
    if (Math.random() >= fillRate) continue;
    const allowed = LAYOUT_TYPES.filter(l => {
      if ((l === 'plant_only' || l === 'books_plant') && plants >= MAX_PLANTS) return false;
      if ((l === 'candle_only' || l === 'books_candle') && candles >= MAX_CANDLES) return false;
      if ((l === 'lamp_only' || l === 'books_lamp') && lamps >= MAX_LAMPS) return false;
      return true;
    });
    if (allowed.length === 0) continue;
    const layout = allowed[Math.floor(Math.random() * allowed.length)];
    if (layout === 'plant_only' || layout === 'books_plant') plants++;
    if (layout === 'candle_only' || layout === 'books_candle') candles++;
    if (layout === 'lamp_only' || layout === 'books_lamp') lamps++;
    const layoutGroup = buildCubbyLayout(row, col, layout);
    scene.add(layoutGroup);
    decorationMeshes.push(layoutGroup);
  }
}

function removeDecorationsOnOccupiedCubbies() {
  const occupied = new Set(bookMeshes.map(m => m.userData.cubbyRow + ',' + m.userData.cubbyCol));
  for (let i = decorationMeshes.length - 1; i >= 0; i--) {
    const d = decorationMeshes[i];
    const key = d.userData.cubbyRow + ',' + d.userData.cubbyCol;
    if (occupied.has(key)) {
      scene.remove(d);
      decorationMeshes.splice(i, 1);
    }
  }
}

function buildSceneForYear(year) {
  bookMeshes.forEach(m => {
    if (m.userData.coverMat && m.userData.coverMat.map) m.userData.coverMat.map.dispose();
    scene.remove(m);
  });
  placeholderMeshes.forEach(m => scene.remove(m));
  decorationMeshes.forEach(m => scene.remove(m));
  bookMeshes = [];
  placeholderMeshes = [];
  decorationMeshes = [];

  const books = getReadBooksForYear(year);
  const readCount = books.filter(b => b.type !== 'audio').length;
  const listenedCount = books.filter(b => b.type === 'audio').length;
  const total = books.length;
  const bookWord = total === 1 ? 'book' : 'books';
  const counterText = total + ' ' + bookWord + ' read so far in ' + year + ' (' + readCount + ' print, ' + listenedCount + ' audio)';
  document.getElementById('book-counter').textContent = counterText;

  books.forEach((book, index) => {
    const { row, col } = slotIndexToCubby(index % SLOTS_TOTAL);
    const bookDepth = getBookDepthFromPages(book.numberOfPages, book.type);
    const pos = getCubbyPosition(row, col, CUBBY_MAX_HEIGHT, bookDepth);

    const group = createBookMesh(book, index);
    group.position.set(pos.x, pos.y, pos.z);
    group.userData.originalY = pos.y;
    group.userData.targetY = pos.y;
    group.userData.originalZ = pos.z;
    group.userData.targetZ = pos.z;
    group.userData.cubbyRow = row;
    group.userData.cubbyCol = col;
    scene.add(group);
    bookMeshes.push(group);

    const url = coverUrl(book.isbn);
    if (url) {
      loadCoverTexture(url).then((tex) => {
        if (group.userData.setCoverTexture) group.userData.setCoverTexture(tex, tex.image);
        if (tex.image && group.userData.setBookDimensions) {
          group.userData.setBookDimensions(tex.image.naturalWidth, tex.image.naturalHeight);
        }
      }).catch(() => {});
    }
  });

  const occupied = new Set(bookMeshes.map(m => m.userData.cubbyRow + ',' + m.userData.cubbyCol));
  const emptyCubbies = [];
  for (let row = 0; row < CUBBY_ROWS; row++) {
    for (let col = 0; col < CUBBY_COLS; col++) {
      if (!occupied.has(row + ',' + col)) emptyCubbies.push({ row, col });
    }
  }
  fillEmptyCubbies(emptyCubbies);
  applyGenreFilterToShelf(currentGenreFilter, true);
  updateGenreFilterLabels(year);
}

function addShelfUnitToScene() {
  shelfUnit = createShelfUnit();
  scene.add(shelfUnit);
}

addShelfUnitToScene();
buildSceneForYear(CURRENT_YEAR);
initShelfSortControls();
initShelfGenreFilterControls();

// Force WebGL to compile materials (incl. lighting) before showing – avoids ugly first-frame flash
(function showWhenReady() {
  if (renderer.compileAsync) {
    renderer.compileAsync(scene, camera).then(function () {
      renderer.render(scene, camera);
      canvasContainer.style.opacity = '1';
      animate();
    });
  } else {
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    canvasContainer.style.opacity = '1';
    animate();
  }
})();

// Raycaster & click
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Drag-and-drop: shelf plane for raycast, snap to cubicle
const shelfPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -SHELF_DEPTH / 2);
const shelfIntersect = new THREE.Vector3();
let draggingBook = null;
let potentialDragBook = null;
let mouseDownTime = 0;
let mouseDownX = 0;
let mouseDownY = 0;
const DRAG_HOLD_MS = 220;
const DRAG_MOVE_PX = 6;
let currentDropCubby = null;
let justDragged = false;

function setBookRaisedRenderOrder(book, raised) {
  const order = raised ? BOOK_RAISED_RENDER_ORDER : 0;
  book.renderOrder = order;
  book.traverse(child => {
    if (child.isMesh) child.renderOrder = order;
  });
}

function captureDragPlaneOffset(book, planeX, planeY) {
  const bookDepth = book.userData.bookDepth != null ? book.userData.bookDepth : BOOK_DEPTH;
  const targetZ = getBookForwardZ(bookDepth, BOOK_DRAG_FORWARD_EXTRA);
  book.userData.dragPlaneOffsetX = book.position.x - planeX;
  book.userData.dragPlaneOffsetY = book.position.y - planeY;
  book.userData.dragPlaneOffsetZ = book.position.z - targetZ;
}

function clearDragPlaneOffset(book) {
  delete book.userData.dragPlaneOffsetX;
  delete book.userData.dragPlaneOffsetY;
  delete book.userData.dragPlaneOffsetZ;
}

function positionBookAtDragPoint(book, planeX, planeY) {
  const bookDepth = book.userData.bookDepth != null ? book.userData.bookDepth : BOOK_DEPTH;
  const targetZ = getBookForwardZ(bookDepth, BOOK_DRAG_FORWARD_EXTRA);
  const ox = book.userData.dragPlaneOffsetX || 0;
  const oy = book.userData.dragPlaneOffsetY || 0;
  const oz = book.userData.dragPlaneOffsetZ || 0;
  book.position.set(planeX + ox, planeY + oy, targetZ + oz);
}

function snapBookToCubby(book, row, col) {
  const bookDepth = book.userData.bookDepth != null ? book.userData.bookDepth : BOOK_DEPTH;
  const pos = getCubbyPosition(row, col, CUBBY_MAX_HEIGHT, bookDepth);
  book.position.set(pos.x, pos.y, pos.z);
  book.userData.originalY = pos.y;
  book.userData.targetY = pos.y;
  book.userData.originalZ = pos.z;
  book.userData.targetZ = pos.z;
  book.userData.cubbyRow = row;
  book.userData.cubbyCol = col;
}

// ----- Shelf sort animation -----
const SORT_PHASE_MS = { out: 520, travel: 1100, in: 520 };
const _sortLerp = { x: 0, y: 0, z: 0 };

function buildSortKeyframe(mesh, toRow, toCol) {
  const bookDepth = mesh.userData.bookDepth != null ? mesh.userData.bookDepth : BOOK_DEPTH;
  const fromRest = getCubbyPosition(mesh.userData.cubbyRow, mesh.userData.cubbyCol, CUBBY_MAX_HEIGHT, bookDepth);
  const rest = getCubbyPosition(toRow, toCol, CUBBY_MAX_HEIGHT, bookDepth);
  const raisedZ = getBookForwardZ(bookDepth, BOOK_HOVER_FORWARD_EXTRA);
  const raisedY = rest.y + BOOK_HOVER_LIFT_Y;
  return {
    mesh,
    toRow,
    toCol,
    k0: { x: fromRest.x, y: fromRest.y, z: fromRest.z },
    k1: { x: fromRest.x, y: fromRest.y + BOOK_HOVER_LIFT_Y, z: raisedZ },
    k2: { x: rest.x, y: raisedY, z: raisedZ },
    k3: { x: rest.x, y: rest.y, z: rest.z }
  };
}

function updateShelfToolbarUI() {
  const busy = shelfSortState !== null || genreFilterAnimating;
  const disabled = busy || !modalEl.hidden;
  const sortNav = document.getElementById('shelf-sort');
  if (sortNav) {
    const activeSort = shelfSortState ? shelfSortState.sortKey : currentSortKey;
    sortNav.querySelectorAll('.shelf-chip-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.sort === activeSort);
      btn.disabled = disabled;
    });
  }
  const genreNav = document.getElementById('shelf-genre-filter');
  if (genreNav) {
    genreNav.querySelectorAll('.shelf-chip-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.genre === currentGenreFilter);
      btn.disabled = disabled;
    });
  }
}

function updateSortButtonsUI() {
  updateShelfToolbarUI();
}

function finishShelfSort() {
  if (!shelfSortState) return;
  currentSortKey = shelfSortState.sortKey;
  shelfSortState.assignments.forEach(a => {
    snapBookToCubby(a.mesh, a.toRow, a.toCol);
    setBookRaisedRenderOrder(a.mesh, false);
  });
  removeDecorationsOnOccupiedCubbies();
  shelfSortState = null;
  controls.enabled = true;
  updateSortButtonsUI();
}

function updateShelfSort(now) {
  if (!shelfSortState) return;
  const { phase, phaseStart, assignments } = shelfSortState;
  const dur = SORT_PHASE_MS[phase];
  const t = easeInOutCubic(Math.min(1, (now - phaseStart) / dur));

  assignments.forEach(a => {
    const from = phase === 'out' ? a.k0 : phase === 'travel' ? a.k1 : a.k2;
    const to = phase === 'out' ? a.k1 : phase === 'travel' ? a.k2 : a.k3;
    lerpVec3(_sortLerp, from, to, t);
    a.mesh.position.set(_sortLerp.x, _sortLerp.y, _sortLerp.z);
    setBookRaisedRenderOrder(a.mesh, phase !== 'in' || t < 0.98);
  });

  if (t >= 1) {
    if (phase === 'out') {
      shelfSortState.phase = 'travel';
      shelfSortState.phaseStart = now;
    } else if (phase === 'travel') {
      shelfSortState.phase = 'in';
      shelfSortState.phaseStart = now;
    } else {
      finishShelfSort();
    }
  }
}

function startShelfSort(sortKey) {
  if (shelfSortState || draggingBook || potentialDragBook || !modalEl.hidden) return;
  if (sortKey === currentSortKey || !SORT_MODES[sortKey]) return;

  const books = getReadBooksForYear(CURRENT_YEAR, sortKey);
  const assignments = [];
  const targetCubbies = new Set();

  books.forEach((book, index) => {
    const mesh = bookMeshes.find(m => m.userData.bookData && m.userData.bookData.id === book.id);
    if (!mesh) return;
    const { row, col } = slotIndexToCubby(index % SLOTS_TOTAL);
    targetCubbies.add(row + ',' + col);
    assignments.push(buildSortKeyframe(mesh, row, col));
  });

  if (assignments.length === 0) return;

  targetCubbies.forEach(key => {
    const [row, col] = key.split(',').map(Number);
    removeDecorationAtCubby(row, col);
  });

  assignments.forEach(a => {
    a.mesh.position.set(a.k0.x, a.k0.y, a.k0.z);
    a.mesh.userData.isHovered = false;
  });

  shelfSortState = {
    sortKey,
    phase: 'out',
    phaseStart: performance.now(),
    assignments
  };
  controls.enabled = false;
  updateSortButtonsUI();
}

function initShelfSortControls() {
  const nav = document.getElementById('shelf-sort');
  if (!nav) return;
  nav.addEventListener('click', e => {
    const btn = e.target.closest('.shelf-chip-btn');
    if (!btn || btn.disabled || !btn.dataset.sort) return;
    startShelfSort(btn.dataset.sort);
  });
  updateShelfToolbarUI();
}

function initShelfGenreFilterControls() {
  const nav = document.getElementById('shelf-genre-filter');
  if (!nav) return;
  nav.addEventListener('click', e => {
    const btn = e.target.closest('.shelf-chip-btn');
    if (!btn || btn.disabled || !btn.dataset.genre) return;
    const key = btn.dataset.genre;
    if (key === currentGenreFilter) return;
    applyGenreFilterToShelf(key);
  });
  updateGenreFilterLabels();
  updateShelfToolbarUI();
}

function onPointerMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (draggingBook) {
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(shelfPlane, shelfIntersect)) {
      const wx = shelfIntersect.x;
      const wy = shelfIntersect.y;
      currentDropCubby = isPointInShelfBounds(wx, wy) ? getCubbyFromWorld(wx, wy) : null;
      positionBookAtDragPoint(draggingBook, wx, wy);
    }
  } else if (potentialDragBook) {
    const dt = Date.now() - mouseDownTime;
    const dx = event.clientX - mouseDownX;
    const dy = event.clientY - mouseDownY;
    if (dt >= DRAG_HOLD_MS || (dx * dx + dy * dy >= DRAG_MOVE_PX * DRAG_MOVE_PX)) {
      draggingBook = potentialDragBook;
      potentialDragBook = null;
      draggingBook.userData.dragStartRow = draggingBook.userData.cubbyRow;
      draggingBook.userData.dragStartCol = draggingBook.userData.cubbyCol;
      currentDropCubby = { row: draggingBook.userData.cubbyRow, col: draggingBook.userData.cubbyCol };
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.ray.intersectPlane(shelfPlane, shelfIntersect)) {
        captureDragPlaneOffset(draggingBook, shelfIntersect.x, shelfIntersect.y);
        positionBookAtDragPoint(draggingBook, shelfIntersect.x, shelfIntersect.y);
      }
      controls.enabled = false;
    }
  }
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  if (!modalEl.hidden || shelfSortState) return;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(bookMeshes, true);
  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj.parent && !bookMeshes.includes(obj)) obj = obj.parent;
    if (bookMeshes.includes(obj) && obj.userData.bookData) {
      potentialDragBook = obj;
      mouseDownTime = Date.now();
      mouseDownX = event.clientX;
      mouseDownY = event.clientY;
      controls.enabled = false; // prevent OrbitControls from starting a rotate on this pointer
    }
  }
}

function onPointerUp(event) {
  if (event.button !== 0) return;
  if (draggingBook) {
    if (currentDropCubby) {
      const r = currentDropCubby.row;
      const c = currentDropCubby.col;
      const other = getBookAtCubby(r, c, draggingBook);
      if (other) {
        const oldR = draggingBook.userData.cubbyRow;
        const oldC = draggingBook.userData.cubbyCol;
        snapBookToCubby(draggingBook, r, c);
        snapBookToCubby(other, oldR, oldC);
        removeDecorationAtCubby(r, c);
      } else {
        snapBookToCubby(draggingBook, r, c);
        removeDecorationAtCubby(r, c);
      }
    } else {
      snapBookToCubby(
        draggingBook,
        draggingBook.userData.dragStartRow,
        draggingBook.userData.dragStartCol
      );
    }
    clearDragPlaneOffset(draggingBook);
    justDragged = true;
    draggingBook = null;
    currentDropCubby = null;
  } else if (potentialDragBook) {
    modalBookMesh = potentialDragBook;
    openModal(potentialDragBook.userData.bookData);
    potentialDragBook = null;
  }
  if (potentialDragBook === null && draggingBook === null) {
    controls.enabled = true; // re-enable after click or after drag ends
  }
}

function onPointerClick() {
  if (justDragged) {
    justDragged = false;
    return;
  }
}

window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mousedown', onPointerDown);
window.addEventListener('mouseup', onPointerUp);
window.addEventListener('click', onPointerClick);

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const deltaMs = Math.min(48, now - lastAnimTime);
  lastAnimTime = now;

  if (shelfSortState) {
    updateShelfSort(now);
    document.body.style.cursor = 'default';
    controls.update();
    renderer.render(scene, camera);
    return;
  }

  updateGenreFilterAnimations(deltaMs);

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(bookMeshes, true);

  if (draggingBook) {
    document.body.style.cursor = 'grabbing';
  } else {
    bookMeshes.forEach(m => { m.userData.isHovered = false; });
    if (modalBookMesh) modalBookMesh.userData.isHovered = true;
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !bookMeshes.includes(obj)) obj = obj.parent;
      if (bookMeshes.includes(obj)) {
        obj.userData.isHovered = true;
        document.body.style.cursor = 'pointer';
      }
    } else {
      document.body.style.cursor = 'default';
    }
  }

  bookMeshes.forEach(m => {
    const isDragging = m === draggingBook;
    const isOpened = m === modalBookMesh;
    const isRaised = isDragging || isOpened || m.userData.isHovered;
    setBookRaisedRenderOrder(m, isRaised);

    const bookDepth = m.userData.bookDepth != null ? m.userData.bookDepth : BOOK_DEPTH;
    if (isDragging) {
      // position driven by pointer move
    } else if (isOpened) {
      m.userData.targetY = m.userData.originalY + BOOK_OPEN_LIFT_Y;
      m.userData.targetZ = getBookForwardZ(bookDepth, BOOK_OPEN_FORWARD_EXTRA);
      m.position.y += (m.userData.targetY - m.position.y) * 0.1;
      m.position.z += (m.userData.targetZ - m.position.z) * 0.1;
    } else if (m.userData.isHovered) {
      m.userData.targetY = m.userData.originalY + BOOK_HOVER_LIFT_Y;
      m.userData.targetZ = getBookForwardZ(bookDepth, BOOK_HOVER_FORWARD_EXTRA);
      m.position.y += (m.userData.targetY - m.position.y) * 0.1;
      m.position.z += (m.userData.targetZ - m.position.z) * 0.1;
    } else {
      m.userData.targetY = m.userData.originalY;
      m.userData.targetZ = m.userData.originalZ;
      m.position.y += (m.userData.targetY - m.position.y) * 0.1;
      m.position.z += (m.userData.targetZ - m.position.z) * 0.1;
    }
  });

  controls.update();
  renderer.render(scene, camera);
}

function updateCameraAspect() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  updateCameraAspect();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateZoomLimits();
});
