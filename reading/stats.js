// Reading stats page. Reads window.booksData (from data.js) and renders stat cards.
(function () {
  'use strict';

  const books = Array.isArray(window.booksData) ? window.booksData.slice() : [];
  const root = document.getElementById('stats-root');
  if (!root) return;

  // ----- Helpers -----
  function parseDate(iso) {
    if (!iso) return null;
    const parts = String(iso).split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function durationMinutes(book) {
    if (book.durationHours == null && book.durationMinutes == null) return null;
    const h = Number(book.durationHours) || 0;
    const m = Number(book.durationMinutes) || 0;
    return h * 60 + m;
  }

  function formatMinutes(totalMins) {
    if (totalMins == null || isNaN(totalMins)) return '–';
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
  }

  function formatNumber(n) {
    return Math.round(n).toLocaleString('en-GB');
  }

  function formatRating(n) {
    if (n == null || isNaN(n)) return '–';
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function wordCount(str) {
    if (!str) return 0;
    return String(str).trim().split(/\s+/).filter(Boolean).length;
  }

  function starMarkup(rating) {
    const num = Math.min(5, Math.max(0, Number(rating) || 0));
    const pct = (num / 5) * 100;
    const label = 'Rated ' + formatRating(num) + ' out of 5';
    return '<span class="modal-rating-stars" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) +
      '"><span class="stars-bg">☆☆☆☆☆</span><span class="stars-fill" style="width:' + pct + '%">★★★★★</span></span>';
  }

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ----- Derived data -----
  const dated = books
    .map(b => ({ book: b, date: parseDate(b.readDate) }))
    .filter(x => x.date)
    .sort((a, b) => a.date - b.date);

  const printBooks = books.filter(b => b.type === 'print');
  const audioBooks = books.filter(b => b.type === 'audio');
  const rated = books.filter(b => b.rating != null && b.rating !== '' && !isNaN(Number(b.rating)));

  const total = books.length;
  const pagesRead = printBooks.reduce((sum, b) => sum + (Number(b.numberOfPages) || 0), 0);
  const totalListenMins = audioBooks.reduce((sum, b) => sum + (durationMinutes(b) || 0), 0);
  const wordsRead = pagesRead * 300;
  const avgRating = rated.length ? rated.reduce((s, b) => s + Number(b.rating), 0) / rated.length : null;

  // ----- Header book counter (matches the shelf page exactly) -----
  (function () {
    const counterEl = document.getElementById('book-counter');
    if (!counterEl) return;
    const year = 2026;
    const readCount = books.filter(b => b.type !== 'audio').length;
    const listenedCount = books.filter(b => b.type === 'audio').length;
    const bookWord = total === 1 ? 'book' : 'books';
    counterEl.textContent = total + ' ' + bookWord + ' read so far in ' + year +
      ' (' + readCount + ' print, ' + listenedCount + ' audio)';
  })();

  // ----- Section builders -----
  const sections = [];

  function statCard(value, label, sub) {
    return '<div class="stat-card">' +
      '<div class="stat-value">' + value + '</div>' +
      '<div class="stat-label">' + label + '</div>' +
      (sub ? '<div class="stat-sub">' + sub + '</div>' : '') +
      '</div>';
  }

  function section(title, bodyHtml) {
    return '<section class="stats-section">' +
      '<h2 class="stats-section-title">' + escapeHtml(title) + '</h2>' +
      bodyHtml + '</section>';
  }

  function highlightCard(label, book, detail) {
    if (!book) return '';
    const ratingHtml = (book.rating != null && book.rating !== '')
      ? '<div class="stat-highlight-rating">' + starMarkup(book.rating) + ' <span>' + formatRating(Number(book.rating)) + '</span></div>'
      : '';
    return '<div class="stat-card stat-highlight">' +
      '<div class="stat-label">' + escapeHtml(label) + '</div>' +
      '<div class="stat-highlight-title">' + escapeHtml(book.title) + '</div>' +
      '<div class="stat-highlight-author">' + escapeHtml(book.author) + '</div>' +
      (detail ? '<div class="stat-sub">' + escapeHtml(detail) + '</div>' : '') +
      ratingHtml +
      '</div>';
  }

  // 1. Totals
  (function () {
    const cards = [
      statCard(formatNumber(total), 'Books read', 'since 2026'),
      statCard(printBooks.length + ' / ' + audioBooks.length, 'Print / Audio', printBooks.length + ' read, ' + audioBooks.length + ' listened'),
      statCard(formatNumber(pagesRead), 'Pages read', 'print books'),
      statCard(formatMinutes(totalListenMins), 'Hours listened', 'audiobooks'),
      statCard('~' + formatNumber(wordsRead), 'Words read', 'pages × ~300'),
      statCard(formatRating(avgRating) + ' ★', 'Average rating', 'across ' + rated.length + ' rated books')
    ].join('');
    sections.push(section('At a glance', '<div class="stat-grid">' + cards + '</div>'));
  })();

  // 2. Pace
  (function () {
    if (!dated.length) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trackingYear = dated.reduce((y, x) => Math.min(y, x.date.getFullYear()), dated[0].date.getFullYear());
    const periodStart = new Date(trackingYear, 0, 1);
    const periodTotal = dated.filter(x => x.date >= periodStart && x.date <= today).length;
    const spanDays = Math.max(1, Math.round((today - periodStart) / 86400000) + 1);
    const spanMonths = spanDays / 30.44;
    const spanWeeks = spanDays / 7;
    const booksPerMonth = periodTotal / spanMonths;
    const booksPerWeek = periodTotal / spanWeeks;

    // Average gap between consecutive finishes, split by format.
    // Print and audio are consumed in parallel — finishing one starts the next of
    // that format — so the within-format gap approximates time to complete each.
    function avgGapForType(predicate) {
      const seq = dated.filter(x => predicate(x.book));
      if (seq.length < 2) return null;
      let sum = 0;
      for (let i = 1; i < seq.length; i++) {
        sum += (seq[i].date - seq[i - 1].date) / 86400000;
      }
      return sum / (seq.length - 1);
    }
    const avgGapPrint = avgGapForType(b => b.type !== 'audio');
    const avgGapAudio = avgGapForType(b => b.type === 'audio');
    const formatGaps = [avgGapPrint, avgGapAudio].filter(g => g != null);
    const avgGap = formatGaps.length ? formatGaps.reduce((s, g) => s + g, 0) / formatGaps.length : null;

    // Most productive month
    const byMonth = {};
    dated.forEach(x => {
      const key = x.date.getFullYear() + '-' + x.date.getMonth();
      byMonth[key] = (byMonth[key] || 0) + 1;
    });
    let bestKey = null, bestCount = 0;
    Object.keys(byMonth).forEach(k => { if (byMonth[k] > bestCount) { bestCount = byMonth[k]; bestKey = k; } });
    const bestLabel = bestKey ? MONTH_NAMES[Number(bestKey.split('-')[1])] + ' ' + bestKey.split('-')[0] : '–';

    const cards = [
      statCard(booksPerMonth.toFixed(1), 'Books per month', 'on average'),
      statCard(booksPerWeek.toFixed(1), 'Books per week', 'on average'),
      statCard(avgGap != null ? avgGap.toFixed(1) + ' days' : '–', 'Avg time per book', 'print & audio averaged*'),
      statCard(bestLabel, 'Most productive month', bestCount + ' books finished')
    ].join('');
    const note = '<p class="stats-note">*Only completion dates are recorded, so true time-to-read per book isn\'t available. Since print and audiobooks are consumed in parallel — finishing one starts the next of that format — the average gap between consecutive finishes is measured within each format and then averaged across the two.</p>';
    sections.push(section('Reading pace', '<div class="stat-grid">' + cards + '</div>' + note));
  })();

  // 3. Ratings
  (function () {
    if (!rated.length) return;
    let highest = rated[0], lowest = rated[0];
    rated.forEach(b => {
      if (Number(b.rating) > Number(highest.rating)) highest = b;
      if (Number(b.rating) < Number(lowest.rating)) lowest = b;
    });

    const topCards = '<div class="stat-grid">' +
      statCard(formatRating(avgRating) + ' ★', 'Average rating', 'out of 5') +
      highlightCard('Highest rated', highest) +
      highlightCard('Lowest rated', lowest) +
      '</div>';

    // Avg rating per month for trend
    const monthBuckets = {};
    dated.forEach(x => {
      const b = x.book;
      if (b.rating == null || b.rating === '' || isNaN(Number(b.rating))) return;
      const key = x.date.getFullYear() + '-' + String(x.date.getMonth()).padStart(2, '0');
      if (!monthBuckets[key]) monthBuckets[key] = { sum: 0, n: 0, m: x.date.getMonth(), y: x.date.getFullYear() };
      monthBuckets[key].sum += Number(b.rating);
      monthBuckets[key].n += 1;
    });
    // Window to the most recent 12 months of data (or fewer if that's all we have).
    const windowKeys = Object.keys(monthBuckets).sort().slice(-12);
    const multiYear = new Set(windowKeys.map(k => k.split('-')[0])).size > 1;
    const trend = windowKeys.map(k => {
      const b = monthBuckets[k];
      return {
        label: MONTH_NAMES[b.m] + (multiYear ? " '" + String(b.y).slice(-2) : ''),
        avg: b.sum / b.n
      };
    });

    sections.push(section('Ratings', topCards + buildTrendChart(trend)));
  })();

  function buildTrendChart(trend) {
    if (!trend.length) return '';
    const W = 640, H = 220, padL = 36, padR = 20, padT = 20, padB = 34;
    const minR = 1, maxR = 5;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const n = trend.length;
    const x = i => n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
    const y = v => padT + (1 - (v - minR) / (maxR - minR)) * plotH;

    let gridlines = '';
    for (let r = 1; r <= 5; r++) {
      const gy = y(r);
      gridlines += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" class="trend-grid" />';
      gridlines += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" class="trend-axis" text-anchor="end">' + r + '</text>';
    }

    const linePts = trend.map((p, i) => x(i) + ',' + y(p.avg)).join(' ');
    const dots = trend.map((p, i) =>
      '<circle cx="' + x(i) + '" cy="' + y(p.avg) + '" r="4" class="trend-dot"><title>' +
      escapeHtml(p.label + ': ' + p.avg.toFixed(2) + ' ★') + '</title></circle>'
    ).join('');
    const labels = trend.map((p, i) =>
      '<text x="' + x(i) + '" y="' + (H - padB + 20) + '" class="trend-axis" text-anchor="middle">' + escapeHtml(p.label) + '</text>'
    ).join('');

    const polyline = n > 1
      ? '<polyline points="' + linePts + '" class="trend-line" fill="none" />'
      : '';

    return '<div class="trend-wrap">' +
      '<div class="trend-caption">Average rating by month — am I getting better at picking books?</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="trend-chart" role="img" aria-label="Average rating by month">' +
      gridlines + polyline + dots + labels +
      '</svg></div>';
  }

  // 4. Extremes
  (function () {
    const withPages = books.filter(b => Number(b.numberOfPages) > 0);
    const cards = [];
    if (withPages.length) {
      const longest = withPages.reduce((a, b) => Number(b.numberOfPages) > Number(a.numberOfPages) ? b : a);
      const shortest = withPages.reduce((a, b) => Number(b.numberOfPages) < Number(a.numberOfPages) ? b : a);
      cards.push(highlightCard('Longest book', longest, formatNumber(Number(longest.numberOfPages)) + ' pages'));
      cards.push(highlightCard('Shortest book', shortest, formatNumber(Number(shortest.numberOfPages)) + ' pages'));
    }
    const withDur = audioBooks.filter(b => durationMinutes(b) != null);
    if (withDur.length) {
      const longestA = withDur.reduce((a, b) => durationMinutes(b) > durationMinutes(a) ? b : a);
      const shortestA = withDur.reduce((a, b) => durationMinutes(b) < durationMinutes(a) ? b : a);
      cards.push(highlightCard('Longest listen', longestA, formatMinutes(durationMinutes(longestA))));
      cards.push(highlightCard('Shortest listen', shortestA, formatMinutes(durationMinutes(shortestA))));
    }
    const withReview = books.filter(b => b.review && b.review.trim());
    if (withReview.length) {
      const longestR = withReview.reduce((a, b) => wordCount(b.review) > wordCount(a.review) ? b : a);
      const shortestR = withReview.reduce((a, b) => wordCount(b.review) < wordCount(a.review) ? b : a);
      cards.push(highlightCard('Longest review', longestR, formatNumber(wordCount(longestR.review)) + ' words'));
      cards.push(highlightCard('Shortest review', shortestR, formatNumber(wordCount(shortestR.review)) + ' words'));
    }
    if (cards.length) {
      sections.push(section('Extremes', '<div class="stat-grid">' + cards.join('') + '</div>'));
    }
  })();

  // 5. Genres
  (function () {
    const counts = {};
    books.forEach(b => {
      (b.genres || []).forEach(g => { counts[g] = (counts[g] || 0) + 1; });
    });
    const entries = Object.keys(counts).map(g => ({ genre: g, n: counts[g] })).sort((a, b) => b.n - a.n);
    if (!entries.length) return;
    const max = entries[0].n;
    const mostRead = entries[0];

    const bars = entries.map(e =>
      '<div class="bar-row">' +
      '<span class="bar-name">' + escapeHtml(e.genre) + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + (e.n / max * 100) + '%"></span></span>' +
      '<span class="bar-count">' + e.n + '</span>' +
      '</div>'
    ).join('');

    const top = '<div class="stat-grid"><div class="stat-card">' +
      '<div class="stat-value">' + escapeHtml(mostRead.genre) + '</div>' +
      '<div class="stat-label">Most read genre</div>' +
      '<div class="stat-sub">' + mostRead.n + ' books</div></div></div>';

    sections.push(section('Genres', top + '<div class="bar-list">' + bars + '</div>'));
  })();

  // 6. Authors
  (function () {
    const map = {};
    books.forEach(b => {
      const a = b.author || 'Unknown';
      if (!map[a]) map[a] = { count: 0, ratingSum: 0, ratingN: 0 };
      map[a].count += 1;
      if (b.rating != null && b.rating !== '' && !isNaN(Number(b.rating))) {
        map[a].ratingSum += Number(b.rating);
        map[a].ratingN += 1;
      }
    });
    const entries = Object.keys(map)
      .map(a => ({ author: a, count: map[a].count, avg: map[a].ratingN ? map[a].ratingSum / map[a].ratingN : null }))
      .filter(e => e.count > 1)
      .sort((a, b) => b.count - a.count || (b.avg || 0) - (a.avg || 0));
    if (!entries.length) return;

    const rows = entries.map(e =>
      '<div class="author-row">' +
      '<span class="author-name">' + escapeHtml(e.author) + '</span>' +
      '<span class="author-meta">' + e.count + ' books' + (e.avg != null ? ' · ' + formatRating(e.avg) + ' ★ avg' : '') + '</span>' +
      '</div>'
    ).join('');
    sections.push(section('Favourite authors', '<div class="author-list">' + rows + '</div><p class="stats-note">Authors with more than one book, ranked by count then average rating.</p>'));
  })();

  // 7. Monthly breakdown
  (function () {
    if (!dated.length) return;
    const map = {};
    dated.forEach(x => {
      const b = x.book;
      const key = x.date.getFullYear() + '-' + String(x.date.getMonth()).padStart(2, '0');
      if (!map[key]) map[key] = { m: x.date.getMonth(), y: x.date.getFullYear(), books: 0, pages: 0, mins: 0 };
      map[key].books += 1;
      if (b.type === 'print') map[key].pages += Number(b.numberOfPages) || 0;
      if (b.type === 'audio') map[key].mins += durationMinutes(b) || 0;
    });
    const rows = Object.keys(map).sort().slice(-12).map(k => {
      const r = map[k];
      return '<tr>' +
        '<td>' + MONTH_NAMES[r.m] + ' ' + r.y + '</td>' +
        '<td>' + r.books + '</td>' +
        '<td>' + (r.pages ? formatNumber(r.pages) : '–') + '</td>' +
        '<td>' + (r.mins ? formatMinutes(r.mins) : '–') + '</td>' +
        '</tr>';
    }).join('');
    const table = '<div class="month-table-wrap"><table class="month-table">' +
      '<thead><tr><th>Month</th><th>Books</th><th>Pages</th><th>Hours</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
    sections.push(section('Reading by month', table));
  })();

  root.innerHTML = sections.join('');
})();
