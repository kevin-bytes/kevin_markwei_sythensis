UI.init('browse');

const $ = (s) => document.querySelector(s);
const grid = $('#grid'), pager = $('#pager'), status = $('#status');
const qInput = $('#q'), sortSel = $('#sort'), chips = $('#chips');

// State lives in the URL so results can be bookmarked and shared.
const params = new URLSearchParams(location.search);
const state = {
  q: params.get('q') || '',
  genre: params.get('genre') || '',
  sort: params.get('sort') || 'popularity',
  page: Math.max(1, Number(params.get('page')) || 1)
};
if (![...sortSel.options].some(o => o.value === state.sort)) state.sort = 'popularity';

qInput.value = state.q;
sortSel.value = state.sort;

function renderChips() {
  chips.innerHTML =
    `<button class="chip ${state.genre ? '' : 'on'}" data-genre="">All</button>` +
    API.MAIN_GENRES.map(id => `<button class="chip ${String(id) === state.genre ? 'on' : ''}" data-genre="${id}" aria-pressed="${String(id) === state.genre}">${API.GENRES[id]}</button>`).join('');
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.genre) p.set('genre', state.genre);
  if (state.sort !== 'popularity') p.set('sort', state.sort);
  if (state.page > 1) p.set('page', state.page);
  const qs = p.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

function renderPager(page, total) {
  if (total <= 1) { pager.innerHTML = ''; return; }
  const wanted = [...new Set([1, total, page - 1, page, page + 1])].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  let html = `<button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`;
  let prev = 0;
  for (const n of wanted) {
    if (n - prev > 1) html += '<span class="gap">…</span>';
    html += `<button data-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`;
    prev = n;
  }
  html += `<button data-page="${page + 1}" ${page === total ? 'disabled' : ''} aria-label="Next page">›</button>`;
  pager.innerHTML = html;
}

let token = 0; // ignore responses that arrive after a newer request started
async function load() {
  const mine = ++token;
  grid.innerHTML = UI.skeletons(12);
  status.textContent = 'Loading…';
  try {
    const data = await API.discover(state);
    if (mine !== token) return;
    state.page = data.page;
    syncUrl();

    if (!data.results.length) {
      pager.innerHTML = '';
      status.textContent = '';
      UI.empty(grid, 'No movies found', 'Try a different search or clear the genre filter.', 'browse.html', 'Reset filters');
      return;
    }
    grid.innerHTML = data.results.map(UI.card).join('');
    const parts = [`${data.total.toLocaleString()} result${data.total === 1 ? '' : 's'}`];
    if (state.genre) parts.push(API.GENRES[state.genre]);
    if (state.q) parts.push(`“${state.q}”`);
    if (data.relevance) parts.push('sorted by relevance');
    status.textContent = parts.join(' · ');
    renderPager(data.page, data.totalPages);
  } catch (err) {
    if (mine !== token) return;
    pager.innerHTML = '';
    status.textContent = '';
    UI.error(grid, err.message, load);
  }
}

function update(changes, scroll = false) {
  Object.assign(state, changes);
  renderChips();
  load();
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- events ----------
$('#filters').addEventListener('submit', e => {
  e.preventDefault();
  update({ q: qInput.value.trim(), page: 1 });
});

let debounce;
qInput.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => update({ q: qInput.value.trim(), page: 1 }), 350);
});

sortSel.addEventListener('change', () => update({ sort: sortSel.value, page: 1 }));

chips.addEventListener('click', e => {
  const b = e.target.closest('[data-genre]');
  if (!b) return;
  const g = b.dataset.genre;
  update({ genre: g === state.genre ? '' : g, page: 1 });
});

pager.addEventListener('click', e => {
  const b = e.target.closest('[data-page]');
  if (b && !b.disabled) update({ page: Number(b.dataset.page) }, true);
});

renderChips();
load();
