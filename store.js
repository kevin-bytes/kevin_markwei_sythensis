// Store: tiny wrapper around localStorage for favourites, watchlist and ratings.
const Store = {
  read(key, fallback = []) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  },
  list(name) { return this.read(name, []); },
  has(name, id) { return this.list(name).some(m => String(m.id) === String(id)); },
  changed(name) { document.dispatchEvent(new CustomEvent('store:change', { detail: { name } })); },
  // Adds the movie if missing, removes it if present. Returns true when it is now in the list.
  toggle(name, movie) {
    const list = this.list(name);
    const i = list.findIndex(m => String(m.id) === String(movie.id));
    if (i > -1) {
      list.splice(i, 1);
    } else {
      list.unshift({
        id: movie.id, title: movie.title, year: movie.year, rating: movie.rating,
        genres: movie.genres || [], poster: movie.poster || null,
        overview: movie.overview || '', added: Date.now()
      });
    }
    this.write(name, list);
    this.changed(name);
    return i === -1;
  },
  clear(name) { this.write(name, []); this.changed(name); },
  // Personal 1-5 star ratings: { movieId: stars }
  rating(id) { return this.read('myratings', {})[id] || 0; },
  setRating(id, stars) {
    const all = this.read('myratings', {});
    if (stars) all[id] = stars; else delete all[id];
    this.write('myratings', all);
  }
};
