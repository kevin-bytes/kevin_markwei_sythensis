# CineScout: movie discovery web app

A multi-page, interactive movie discovery site built with plain **HTML, CSS and JavaScript** (no frameworks, no build step).

## Run it

Just open `index.html` in your browser (double-click it). For the best experience you can also serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Demo mode vs live data

- **Demo mode (default):** works instantly with 24 built-in sample movies, so nothing can break during a presentation.
- **Live mode:** add a free TMDB v3 API key to browse the real catalogue (hundreds of thousands of movies, posters, cast, trailers).
  1. Create a free account at https://www.themoviedb.org and request an API key (Settings > API).
  2. Either paste the key into `js/config.js` (`TMDB_API_KEY`), or click **API settings** in the site footer. The footer option stores it in your browser only.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Auto-rotating hero, genre chips, horizontal scrolling rows (trending, top rated, genres) and a "Because you liked..." row built from your favourites |
| `browse.html` | Debounced live search, genre filters, sorting, pagination with a numbered pager, URL-synced state (shareable links) |
| `movie.html?id=...` | Details, animated rating ring, cast, trailer modal, personal 1-5 star rating, "More like this", copy link |
| `favourites.html` | Saved favourites with sorting, genre breakdown bars, JSON export |
| `watchlist.html` | Same as favourites plus a "Pick for me" random chooser |

## Project structure

```
cinescout/
  index.html  browse.html  movie.html  favourites.html  watchlist.html
  css/style.css        all styling (CSS variables, dark/light theme, responsive grid)
  data/demo.js         sample movies for demo mode
  js/config.js         API key + settings
  js/api.js            TMDB wrapper with the demo-data fallback (same shape either way)
  js/store.js          localStorage: favourites, watchlist, ratings
  js/ui.js             shared header/footer, movie cards, rows, toast, modal
  js/home.js  browse.js  movie.js  lists.js    one script per page
```

## Concepts to mention in a presentation

- **`fetch` + async/await** against a REST API, with loading skeletons and error handling with retry.
- **`localStorage`** so favourites, watchlist, ratings and theme persist across pages and visits.
- **Event delegation**: one click listener handles every heart/bookmark button, including ones created later.
- **Race-condition guard** in browse: a request token ignores slow responses from older searches.
- **Debouncing** the search box so the API isn't hit on every keystroke.
- **State in the URL** (`?q=...&genre=...&page=...`) for bookmarkable results.
- **CSS custom properties** for theming, **Grid/Flexbox** for layout, container-friendly responsive design.
- **Accessibility**: semantic HTML, skip link, `aria-live` status, labelled buttons, visible focus, reduced-motion support.
- **Graceful degradation**: missing posters fall back to generated gradient placeholders.

## Ideas to extend it

- Add an "Actor" page that lists a person's films (TMDB `/person/{id}`).
- Compare two movies side by side.
- Sync lists with a small Node/Express backend and a database.
- Add keyboard shortcuts (`/` to focus search).

Movie data in live mode comes from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
