UI.init('browse');

const el = document.getElementById('detail');
const id = new URLSearchParams(location.search).get('id');

const fmtRuntime = (min) => (min ? `${Math.floor(min / 60)}h ${min % 60}m` : '');
const initials = (name) => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

async function load() {
  if (!id) {
    UI.empty(el, 'No movie selected', 'Pick a movie from the browse page.', 'browse.html', 'Browse movies');
    return;
  }
  el.innerHTML = '<div class="container"><div class="skeleton-detail"></div></div>';
  try {
    render(await API.details(id));
  } catch (err) {
    UI.error(el, err.message, load);
  }
}

function render(m) {
  UI.cache[m.id] = m;
  document.title = `${m.title}${m.year ? ' (' + m.year + ')' : ''} · CineScout`;

  const fav = Store.has('favs', m.id), watch = Store.has('watch', m.id);
  const pct = Math.round((m.rating || 0) * 10);
  const circ = 2 * Math.PI * 26;
  const trailer = m.trailerKey
    ? `<button class="btn ghost" id="trailer-btn">▶ Watch trailer</button>`
    : `<a class="btn ghost" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + ' ' + m.year + ' trailer')}">▶ Find trailer</a>`;

  el.innerHTML = `
    <section class="detail-hero" style="--h:${UI.hue(m.id)}">
      ${m.backdrop ? `<div class="detail-bg" style="background-image:url('${UI.esc(m.backdrop)}')"></div>` : ''}
      <div class="container detail-grid">
        <div class="detail-poster">${UI.poster(m)}</div>
        <div class="detail-info">
          <p class="crumbs"><a href="browse.html">← Back to browse</a></p>
          <h1>${UI.esc(m.title)} ${m.year ? `<span class="year">(${UI.esc(m.year)})</span>` : ''}</h1>
          ${m.tagline ? `<p class="tagline">${UI.esc(m.tagline)}</p>` : ''}
          <div class="chips">${(m.genres || []).filter(g => API.GENRES[g]).map(g => `<a class="chip" href="browse.html?genre=${g}">${API.GENRES[g]}</a>`).join('')}</div>

          <div class="meta">
            <div class="ring" role="img" aria-label="Rating ${UI.fmtRating(m.rating)} out of 10">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke-width="6">
                <circle class="track" cx="32" cy="32" r="26"/>
                <circle class="fill" cx="32" cy="32" r="26" stroke-dasharray="0 ${circ}" data-dash="${(circ * pct / 100).toFixed(1)} ${circ.toFixed(1)}"/>
              </svg>
              <b>${pct ? pct + '%' : '–'}</b>
            </div>
            ${m.runtime ? `<span>⏱ ${fmtRuntime(m.runtime)}</span>` : ''}
            ${m.director ? `<span>🎬 ${UI.esc(m.director)}</span>` : ''}
          </div>

          <h2>Overview</h2>
          <p>${UI.esc(m.overview || 'No overview available.')}</p>

          <div class="actions">
            <button class="btn ghost ${fav ? 'on' : ''}" data-toggle="favs" data-id="${UI.esc(m.id)}" data-on-label="♥ Favourited" data-off-label="♡ Favourite">${fav ? '♥ Favourited' : '♡ Favourite'}</button>
            <button class="btn ghost ${watch ? 'on' : ''}" data-toggle="watch" data-id="${UI.esc(m.id)}" data-on-label="✓ In watchlist" data-off-label="＋ Watchlist">${watch ? '✓ In watchlist' : '＋ Watchlist'}</button>
            ${trailer}
            <button class="btn ghost" id="share-btn">🔗 Copy link</button>
          </div>

          <div class="my-rating"><span class="muted">Your rating</span><div class="stars" id="stars" role="group" aria-label="Your rating"></div></div>
        </div>
      </div>
    </section>

    <div class="container">
      ${m.cast && m.cast.length ? `<section class="section"><h2>Cast</h2><div class="cast-grid">
        ${m.cast.map(c => `<div class="person"><div class="avatar" style="--h:${UI.hue(c.name)}">${UI.esc(initials(c.name))}${c.photo ? `<img class="avatar-img" src="${UI.esc(c.photo)}" alt="" loading="lazy">` : ''}</div><b>${UI.esc(c.name)}</b>${c.character ? `<span>${UI.esc(c.character)}</span>` : ''}</div>`).join('')}
      </div></section>` : ''}
      ${UI.row('More like this', m.similar)}
    </div>`;

  // animate the rating ring
  requestAnimationFrame(() => {
    const f = el.querySelector('.ring .fill');
    if (f) f.setAttribute('stroke-dasharray', f.dataset.dash);
  });

  // personal star rating
  const stars = document.getElementById('stars');
  const paintStars = () => {
    const cur = Store.rating(m.id);
    stars.innerHTML = [1, 2, 3, 4, 5].map(n =>
      `<button class="${n <= cur ? 'on' : ''}" data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}" aria-pressed="${n <= cur}">★</button>`).join('');
  };
  paintStars();
  stars.addEventListener('click', e => {
    const b = e.target.closest('[data-star]');
    if (!b) return;
    const n = Number(b.dataset.star);
    const cur = Store.rating(m.id);
    Store.setRating(m.id, n === cur ? 0 : n); // clicking the same star clears it
    paintStars();
    UI.toast(n === cur ? 'Rating cleared' : `You rated it ${n}/5`);
  });

  const tb = document.getElementById('trailer-btn');
  if (tb) tb.addEventListener('click', () => {
    const d = UI.modal(`<iframe class="video" src="https://www.youtube.com/embed/${encodeURIComponent(m.trailerKey)}?autoplay=1" title="${UI.esc(m.title)} trailer" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`, 'wide');
    d.addEventListener('close', () => d.remove());
  });

  document.getElementById('share-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      UI.toast('Link copied');
    } catch (e) {
      UI.toast('Copy the link from the address bar');
    }
  });
}

load();
