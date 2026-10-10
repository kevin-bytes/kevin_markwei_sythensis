// UI: shared header/footer, cards, rows, toast, modal and global event handling.
const UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const cache = {}; // id -> movie, so buttons can find the full movie object

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function hue(id) {
    let h = 0;
    for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }
  const genreNames = (ids = [], n = 3) => ids.map(i => API.GENRES[i]).filter(Boolean).slice(0, n);
  const fmtRating = (r) => (r ? Number(r).toFixed(1) : '–');

  // A poster always has a coloured placeholder underneath; the real image sits on top.
  function poster(m) {
    return `<div class="poster" style="--h:${hue(m.id)}"><span class="ph">${esc(m.title)}</span>` +
      (m.poster ? `<img class="poster-img" src="${esc(m.poster)}" alt="Poster of ${esc(m.title)}" loading="lazy">` : '') + `</div>`;
  }

  function card(m) {
    cache[m.id] = m;
    const fav = Store.has('favs', m.id), watch = Store.has('watch', m.id);
    const meta = [m.year, ...genreNames(m.genres, 2)].filter(Boolean).join(' · ');
    return `<article class="card">
      <a class="card-link" href="movie.html?id=${encodeURIComponent(m.id)}" aria-label="${esc(m.title)}, details">
        ${poster(m)}<span class="badge">★ ${fmtRating(m.rating)}</span>
      </a>
      <div class="card-actions">
        <button class="icon-btn ${fav ? 'on' : ''}" data-toggle="favs" data-id="${esc(m.id)}" aria-pressed="${fav}" aria-label="Favourite ${esc(m.title)}" title="Favourite">♥</button>
        <button class="icon-btn ${watch ? 'on' : ''}" data-toggle="watch" data-id="${esc(m.id)}" aria-pressed="${watch}" aria-label="Watchlist ${esc(m.title)}" title="Watchlist">🔖</button>
      </div>
      <div class="card-body"><h3>${esc(m.title)}</h3><p class="muted">${esc(meta)}</p></div>
    </article>`;
  }

  const skeletons = (n = 12) => Array.from({ length: n }, () =>
    '<div class="card skeleton"><div class="poster"></div><div class="card-body"><h3>&nbsp;</h3><p>&nbsp;</p></div></div>').join('');

  function row(title, movies, href) {
    if (!movies || !movies.length) return '';
    return `<section class="row">
      <div class="row-head"><h2>${esc(title)}</h2>${href ? `<a class="see-all" href="${esc(href)}">See all →</a>` : ''}
        <div class="row-nav"><button data-scroll="-1" aria-label="Scroll left">‹</button><button data-scroll="1" aria-label="Scroll right">›</button></div>
      </div>
      <div class="row-track">${movies.map(card).join('')}</div>
    </section>`;
  }

  function toast(msg) {
    let t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.setAttribute('role', 'status');
      document.body.append(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function modal(html, cls = '') {
    const d = document.createElement('dialog');
    d.className = 'modal ' + cls;
    d.innerHTML = `<button class="modal-close" aria-label="Close">×</button><div class="modal-body">${html}</div>`;
    document.body.append(d);
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('.modal-close')) d.close(); });
    d.addEventListener('close', () => d.remove());
    d.showModal();
    return d;
  }

  function error(el, msg, retry) {
    el.innerHTML = `<div class="state"><h2>Something went wrong</h2><p class="muted">${esc(msg)}</p>${retry ? '<button class="btn" data-retry>Try again</button>' : ''}</div>`;
    if (retry) $('[data-retry]', el).onclick = retry;
  }

  function empty(el, title, msg, ctaHref, ctaText) {
    el.innerHTML = `<div class="state"><h2>${esc(title)}</h2><p class="muted">${esc(msg)}</p>${ctaHref ? `<a class="btn" href="${esc(ctaHref)}">${esc(ctaText)}</a>` : ''}</div>`;
  }

  // Keeps every heart/bookmark button for a movie in sync after a toggle.
  function syncButtons(list, id, on) {
    $$('[data-toggle]').filter(b => b.dataset.toggle === list && b.dataset.id === String(id)).forEach(b => {
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
      if (b.dataset.onLabel) b.textContent = on ? b.dataset.onLabel : b.dataset.offLabel;
    });
  }

  function updateCounts() {
    $$('[data-count]').forEach(el => {
      const n = Store.list(el.dataset.count).length;
      el.textContent = n || '';
      el.hidden = !n;
    });
  }

  function keyDialog() {
    const d = modal(`<h2>Connect TMDB</h2>
      <p class="muted">Paste your free TMDB <strong>v3 API key</strong> to load live movie data. It is stored only in this browser. Without a key the site shows built-in sample movies.</p>
      <form id="key-form">
        <label for="key-input">API key</label>
        <input id="key-input" class="input" autocomplete="off" spellcheck="false" placeholder="32-character key" value="${esc(localStorage.getItem('tmdb_key') || '')}">
        <div class="modal-actions">
          <button class="btn" type="submit">Save &amp; reload</button>
          <button class="btn ghost" type="button" data-clear>Use demo data</button>
        </div>
      </form>`);
    $('#key-form', d).addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#key-input', d).value.trim();
      if (v) localStorage.setItem('tmdb_key', v); else localStorage.removeItem('tmdb_key');
      location.reload();
    });
    $('[data-clear]', d).addEventListener('click', () => { localStorage.removeItem('tmdb_key'); location.reload(); });
  }

  function init(active) {
    const link = (href, key, label, extra = '') =>
      `<a href="${href}" ${active === key ? 'aria-current="page"' : ''}>${label}${extra}</a>`;
    $('#site-header').innerHTML = `<div class="container nav">
      <a class="logo" href="index.html">🎬 Cine<span>Scout</span></a>
      <button class="menu-btn" aria-label="Toggle menu" aria-expanded="false" aria-controls="nav-links">☰</button>
      <nav class="links" id="nav-links" aria-label="Main">
        ${link('index.html', 'home', 'Home')}
        ${link('browse.html', 'browse', 'Browse')}
        ${link('favourites.html', 'favs', 'Favourites', ' <span class="count" data-count="favs" hidden></span>')}
        ${link('watchlist.html', 'watch', 'Watchlist', ' <span class="count" data-count="watch" hidden></span>')}
      </nav>
      <form class="nav-search" action="browse.html" role="search">
        <input type="search" name="q" placeholder="Search movies…" aria-label="Search movies">
      </form>
      <button class="theme-btn" aria-label="Toggle light/dark theme" title="Toggle theme">🌓</button>
    </div>`;

    if (!API.isLive() && !sessionStorage.getItem('hideBanner')) {
      $('#site-header').insertAdjacentHTML('afterend',
        `<div class="banner" id="banner"><div class="container"><span>Demo mode: showing ${DEMO_MOVIES.length} sample films. Add a free TMDB key for the full catalogue.</span>
        <button class="link-btn" data-open-key>Add key</button><button class="link-btn" data-hide-banner aria-label="Dismiss">✕</button></div></div>`);
    }

    $('#site-footer').innerHTML = `<div class="container foot">
      <span>CineScout · ${API.isLive() ? 'Live data from TMDB' : 'Demo data'}</span>
      <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
      <button class="link-btn" data-open-key>API settings</button>
    </div>`;

    updateCounts();
  }

  // ----- global event handling (event delegation) -----
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-toggle]');
    if (t) {
      e.preventDefault();
      const m = cache[t.dataset.id];
      if (!m) return;
      const list = t.dataset.toggle;
      const on = Store.toggle(list, m);
      syncButtons(list, m.id, on);
      const label = list === 'favs' ? 'favourites' : 'watchlist';
      toast(on ? `Added to ${label}` : `Removed from ${label}`);
      return;
    }
    const sc = e.target.closest('[data-scroll]');
    if (sc) {
      const track = $('.row-track', sc.closest('.row'));
      track.scrollBy({ left: track.clientWidth * 0.8 * Number(sc.dataset.scroll), behavior: 'smooth' });
      return;
    }
    if (e.target.closest('[data-open-key]')) { keyDialog(); return; }
    if (e.target.closest('[data-hide-banner]')) { sessionStorage.setItem('hideBanner', '1'); const b = $('#banner'); if (b) b.remove(); return; }
    const menu = e.target.closest('.menu-btn');
    if (menu) {
      const open = $('#nav-links').classList.toggle('open');
      menu.setAttribute('aria-expanded', open);
      return;
    }
    if (e.target.closest('.theme-btn')) {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (err) { /* ignore */ }
    }
  });

  // If a poster image fails to load, remove it so the placeholder shows.
  document.addEventListener('error', e => {
    const t = e.target;
    if (t.tagName === 'IMG' && (t.classList.contains('poster-img') || t.classList.contains('avatar-img'))) t.remove();
  }, true);

  document.addEventListener('store:change', updateCounts);
  window.addEventListener('storage', updateCounts);

  return { $, $$, cache, esc, hue, genreNames, fmtRating, poster, card, skeletons, row, toast, modal, error, empty, init, syncButtons };
})();
