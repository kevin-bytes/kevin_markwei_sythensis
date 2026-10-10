// API: talks to TMDB when a key is available, otherwise serves the demo dataset.
// Every function returns the same normalised movie shape either way:
// { id, title, year, rating, votes, genres:[ids], overview, poster, backdrop, ... }
const API = (() => {
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/';

  const GENRES = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
    18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
    9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller',
    10752: 'War', 37: 'Western'
  };
  const MAIN_GENRES = [28, 12, 16, 35, 80, 18, 10751, 14, 27, 9648, 10749, 878, 53];

  const getKey = () => (localStorage.getItem('tmdb_key') || CONFIG.TMDB_API_KEY || '').trim();
  const isLive = () => !!getKey();

  async function tmdb(path, params = {}) {
    const url = new URL(BASE + path);
    url.searchParams.set('api_key', getKey());
    url.searchParams.set('language', 'en-US');
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v != null) url.searchParams.set(k, v);
    }
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error('Could not reach TMDB. Check your internet connection.');
    }
    if (res.status === 401) throw new Error('TMDB rejected the API key. Check it in API settings.');
    if (!res.ok) throw new Error('TMDB request failed (' + res.status + ').');
    return res.json();
  }

  function norm(m) {
    return {
      id: m.id,
      title: m.title || m.name || 'Untitled',
      year: (m.release_date || '').slice(0, 4),
      rating: m.vote_average || 0,
      votes: m.vote_count || 0,
      genres: m.genre_ids || (m.genres || []).map(g => g.id),
      overview: m.overview || '',
      poster: m.poster_path ? IMG + 'w500' + m.poster_path : null,
      backdrop: m.backdrop_path ? IMG + 'w1280' + m.backdrop_path : null
    };
  }

  // ---------- demo mode ----------
  const DEMO_SORT = {
    popularity: (a, b) => a._i - b._i,
    rating: (a, b) => b.rating - a.rating,
    newest: (a, b) => Number(b.year) - Number(a.year),
    oldest: (a, b) => Number(a.year) - Number(b.year),
    title: (a, b) => a.title.localeCompare(b.title)
  };
  const delay = (v) => new Promise(r => setTimeout(() => r(v), 150)); // feels like a network call

  function demoDiscover({ q, genre, sort, page }) {
    const needle = (q || '').trim().toLowerCase();
    const list = DEMO_MOVIES
      .filter(m => !genre || m.genres.includes(Number(genre)))
      .filter(m => !needle || (m.title + ' ' + m.overview + ' ' + m.director + ' ' + m.cast.join(' ')).toLowerCase().includes(needle))
      .sort(DEMO_SORT[sort] || DEMO_SORT.popularity);
    const size = CONFIG.PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(list.length / size));
    const p = Math.min(Math.max(1, Number(page) || 1), totalPages);
    return { results: list.slice((p - 1) * size, p * size), page: p, totalPages, total: list.length, relevance: false };
  }

  // ---------- public API ----------
  const LIVE_SORT = {
    popularity: { sort_by: 'popularity.desc' },
    rating: { sort_by: 'vote_average.desc', 'vote_count.gte': 300 },
    newest: { sort_by: 'primary_release_date.desc', 'primary_release_date.lte': new Date().toISOString().slice(0, 10), 'vote_count.gte': 20 },
    oldest: { sort_by: 'primary_release_date.asc', 'vote_count.gte': 300 },
    title: { sort_by: 'original_title.asc', 'vote_count.gte': 100 }
  };

  async function discover({ q = '', genre = '', sort = 'popularity', page = 1 } = {}) {
    if (!isLive()) return delay(demoDiscover({ q, genre, sort, page }));
    if (q.trim()) {
      const d = await tmdb('/search/movie', { query: q.trim(), page, include_adult: 'false' });
      let results = d.results.map(norm);
      if (genre) results = results.filter(m => m.genres.includes(Number(genre)));
      return { results, page: d.page, totalPages: Math.min(d.total_pages, 500), total: d.total_results, relevance: true };
    }
    const d = await tmdb('/discover/movie', { with_genres: genre, page, include_adult: 'false', ...(LIVE_SORT[sort] || LIVE_SORT.popularity) });
    return { results: d.results.map(norm), page: d.page, totalPages: Math.min(d.total_pages, 500), total: d.total_results, relevance: false };
  }

  const LIVE_CATEGORY = { trending: '/trending/movie/week', top_rated: '/movie/top_rated', popular: '/movie/popular', upcoming: '/movie/upcoming' };

  async function category(name) {
    if (!isLive()) {
      const sort = name === 'top_rated' ? 'rating' : 'popularity';
      return delay([...DEMO_MOVIES].sort(DEMO_SORT[sort]).slice(0, 12));
    }
    const d = await tmdb(LIVE_CATEGORY[name] || LIVE_CATEGORY.popular);
    return d.results.map(norm);
  }

  async function details(id) {
    // Ids starting with "d" are demo movies, even if a key is set later.
    if (String(id).startsWith('d')) {
      const m = DEMO_MOVIES.find(x => x.id === id);
      if (!m) throw new Error('That movie could not be found.');
      const similar = DEMO_MOVIES
        .filter(x => x.id !== id)
        .map(x => ({ x, overlap: x.genres.filter(g => m.genres.includes(g)).length }))
        .filter(o => o.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap || b.x.rating - a.x.rating)
        .slice(0, 10).map(o => o.x);
      return delay({ ...m, cast: m.cast.map(name => ({ name, character: '', photo: null })), trailerKey: null, similar });
    }
    if (!isLive()) throw new Error('Add a TMDB API key (footer > API settings) to open this movie.');
    const d = await tmdb('/movie/' + encodeURIComponent(id), { append_to_response: 'credits,videos,similar' });
    const crew = (d.credits && d.credits.crew) || [];
    const videos = (d.videos && d.videos.results) || [];
    return {
      ...norm(d),
      runtime: d.runtime || 0,
      tagline: d.tagline || '',
      director: (crew.find(c => c.job === 'Director') || {}).name || '',
      cast: ((d.credits && d.credits.cast) || []).slice(0, 10).map(c => ({
        name: c.name, character: c.character || '', photo: c.profile_path ? IMG + 'w185' + c.profile_path : null
      })),
      trailerKey: (videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') || {}).key || null,
      similar: ((d.similar && d.similar.results) || []).slice(0, 12).map(norm)
    };
  }

  return { GENRES, MAIN_GENRES, isLive, discover, category, details };
})();
