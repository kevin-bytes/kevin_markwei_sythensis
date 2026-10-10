UI.init('home');

const hero = document.getElementById('hero');
const rows = document.getElementById('rows');

document.getElementById('genre-chips').innerHTML = API.MAIN_GENRES
  .map(id => `<a class="chip" href="browse.html?genre=${id}">${API.GENRES[id]}</a>`).join('');

// ---------- hero slideshow ----------
let featured = [];
let idx = 0;
let timer = null;

function slide(i) {
  idx = (i + featured.length) % featured.length;
  const m = featured[idx];
  UI.cache[m.id] = m;
  const inWatch = Store.has('watch', m.id);
  const bg = m.backdrop ? `background-image:url('${UI.esc(m.backdrop)}');` : '';
  hero.innerHTML = `
    <div class="hero-bg" style="--h:${UI.hue(m.id)};${bg}"></div>
    <div class="container hero-content">
      <div class="hero-text" aria-live="polite">
        <p class="kicker">Trending now</p>
        <h1>${UI.esc(m.title)}</h1>
        <p class="hero-meta">${UI.esc([m.year, ...UI.genreNames(m.genres, 3)].join(' · '))} · ★ ${UI.fmtRating(m.rating)}</p>
        <p class="lead">${UI.esc(m.overview)}</p>
        <div class="hero-actions">
          <a class="btn" href="movie.html?id=${encodeURIComponent(m.id)}">View details</a>
          <button class="btn ghost ${inWatch ? 'on' : ''}" data-toggle="watch" data-id="${UI.esc(m.id)}"
            data-on-label="✓ In watchlist" data-off-label="＋ Watchlist">${inWatch ? '✓ In watchlist' : '＋ Watchlist'}</button>
        </div>
        <div class="dots">${featured.map((_, n) => `<button data-dot="${n}" class="${n === idx ? 'on' : ''}" aria-label="Show featured movie ${n + 1}"></button>`).join('')}</div>
      </div>
    </div>`;
}

function autoplay() {
  clearInterval(timer);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || featured.length < 2) return;
  timer = setInterval(() => slide(idx + 1), 8000);
}

hero.addEventListener('click', e => {
  const dot = e.target.closest('[data-dot]');
  if (dot) { slide(Number(dot.dataset.dot)); autoplay(); }
});
hero.addEventListener('mouseenter', () => clearInterval(timer));
hero.addEventListener('mouseleave', autoplay);

// ---------- rows ----------
function mostCommonGenre(list) {
  const counts = {};
  list.forEach(m => (m.genres || []).forEach(g => { counts[g] = (counts[g] || 0) + 1; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? Number(top[0]) : null;
}

async function start() {
  rows.innerHTML = `<section class="row"><div class="row-head"><h2>Loading…</h2></div><div class="row-track">${UI.skeletons(7)}</div></section>`;
  try {
    const trending = await API.category('trending');
    featured = trending.filter(m => m.backdrop).slice(0, 5);
    if (!featured.length) featured = trending.slice(0, 5);
    slide(0);
    autoplay();

    // "Because you liked ..." uses your favourites' most common genre.
    const favs = Store.list('favs');
    const favGenre = mostCommonGenre(favs);
    const wanted = [
      API.category('top_rated'),
      API.discover({ genre: 878, sort: 'rating' }).then(d => d.results),
      API.discover({ genre: 16, sort: 'rating' }).then(d => d.results),
      API.discover({ genre: 35, sort: 'rating' }).then(d => d.results)
    ];
    if (favGenre) wanted.push(API.discover({ genre: favGenre, sort: 'rating' }).then(d => d.results));
    const [top, scifi, anim, comedy, rec] = await Promise.all(wanted);

    const favIds = new Set(favs.map(m => String(m.id)));
    const recommended = rec ? rec.filter(m => !favIds.has(String(m.id))) : [];

    rows.innerHTML = [
      recommended.length ? UI.row(`Because you liked ${API.GENRES[favGenre]}`, recommended, `browse.html?genre=${favGenre}&sort=rating`) : '',
      UI.row('Trending this week', trending, 'browse.html'),
      UI.row('Top rated', top, 'browse.html?sort=rating'),
      UI.row('Sci-Fi picks', scifi, 'browse.html?genre=878&sort=rating'),
      UI.row('Animation', anim, 'browse.html?genre=16&sort=rating'),
      UI.row('Comedy', comedy, 'browse.html?genre=35&sort=rating')
    ].join('');
  } catch (err) {
    hero.hidden = true;
    UI.error(rows, err.message, () => { hero.hidden = false; start(); });
  }
}

start();
