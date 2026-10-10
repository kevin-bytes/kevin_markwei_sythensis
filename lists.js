// Shared script for favourites.html and watchlist.html (chosen by <body data-list="...">)
const listName = document.body.dataset.list;
UI.init(listName);

const $ = (s) => document.querySelector(s);
const grid = $('#grid'), stats = $('#stats'), toolbar = $('#toolbar'), sortSel = $('#sort');

const SORTS = {
  added: (a, b) => (b.added || 0) - (a.added || 0),
  title: (a, b) => a.title.localeCompare(b.title),
  rating: (a, b) => (b.rating || 0) - (a.rating || 0),
  year: (a, b) => Number(b.year || 0) - Number(a.year || 0)
};

function renderStats(items) {
  const avg = items.reduce((s, m) => s + (m.rating || 0), 0) / items.length;
  const counts = {};
  items.forEach(m => (m.genres || []).forEach(g => { if (API.GENRES[g]) counts[g] = (counts[g] || 0) + 1; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top.length ? top[0][1] : 1;

  stats.innerHTML = `
    <div class="stat"><b>${items.length}</b><span>${items.length === 1 ? 'movie' : 'movies'} saved</span></div>
    <div class="stat"><b>★ ${avg.toFixed(1)}</b><span>average rating</span></div>
    <div class="stat"><b>${top.length ? UI.esc(API.GENRES[top[0][0]]) : '–'}</b><span>top genre</span></div>
    ${top.length ? `<div class="bars" aria-label="Genre breakdown"><h3>Genre breakdown</h3>
      ${top.map(([g, n]) => `<div class="bar"><span>${UI.esc(API.GENRES[g])}</span><i style="width:${(n / max) * 100}%"></i><span>${n}</span></div>`).join('')}
    </div>` : ''}`;
}

function render() {
  const items = Store.list(listName);
  if (!items.length) {
    toolbar.hidden = true;
    stats.innerHTML = '';
    UI.empty(grid,
      listName === 'favs' ? 'No favourites yet' : 'Your watchlist is empty',
      listName === 'favs' ? 'Tap the heart on any movie to save it here.' : 'Tap the bookmark on any movie to plan your next watch.',
      'browse.html', 'Browse movies');
    return;
  }
  toolbar.hidden = false;
  renderStats(items);
  grid.innerHTML = [...items].sort(SORTS[sortSel.value] || SORTS.added).map(UI.card).join('');
}

sortSel.addEventListener('change', render);
document.addEventListener('store:change', e => { if (e.detail.name === listName) render(); });

$('#clear').addEventListener('click', () => {
  const n = Store.list(listName).length;
  if (n && confirm(`Remove all ${n} movies from this list?`)) Store.clear(listName);
});

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(Store.list(listName), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = listName === 'favs' ? 'favourites.json' : 'watchlist.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

const random = $('#random');
if (random) random.addEventListener('click', () => {
  const items = Store.list(listName);
  if (!items.length) return;
  const m = items[Math.floor(Math.random() * items.length)];
  UI.cache[m.id] = m;
  UI.modal(`<p class="kicker">Tonight's pick</p>
    <div class="pick">${UI.poster(m)}
      <div><h2>${UI.esc(m.title)}</h2>
        <p class="muted">${UI.esc([m.year, ...UI.genreNames(m.genres, 2)].join(' · '))} · ★ ${UI.fmtRating(m.rating)}</p>
        <div class="modal-actions"><a class="btn" href="movie.html?id=${encodeURIComponent(m.id)}">View details</a></div>
      </div></div>`);
});

render();
