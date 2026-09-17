// Curated local pools of verified anime reaction GIFs (2D anime clips only).
// Source: raw.githubusercontent.com/bre4d777/anime-gifs (community anime-reaction
// database, categories are hand-curated to match the action). Every entry below
// was verified: URL resolves with Content-Type image/gif (HTTP 200), valid GIF89a,
// sane dimensions/frame count. KILL is a short stand-in pool drawn from the same
// verified `punch` category (comedic KO-style clips) until a dedicated defeat set
// is hand-verified in the content-pool pass.
const BASE = 'https://raw.githubusercontent.com/bre4d777/anime-gifs/master';

// Per-action curated pools. `cat` is the source category in the dataset (KILL
// reuses the verified `punch` clips — comedic KO-style — until a dedicated
// defeat set is hand-verified).
const POOLS = {
  hug:    { cat: 'hug',    idx: [22, 36, 39, 14, 32, 35, 34, 33, 12, 18] },
  kiss:   { cat: 'kiss',   idx: [2, 15, 14, 35, 36, 33, 11, 31, 4, 21] },
  slap:   { cat: 'slap',   idx: [17, 25, 18, 19, 20, 9, 2, 16, 11, 12] },
  pat:    { cat: 'pat',    idx: [18, 11, 12, 3, 14, 23, 2, 9, 8, 4] },
  cuddle: { cat: 'cuddle', idx: [4, 24, 23, 12, 5, 10, 20, 11, 15, 6] },
  bite:   { cat: 'bite',   idx: [16, 5, 17, 6, 9, 10, 13, 20, 3, 1] },
  punch:  { cat: 'punch',  idx: [8, 1, 4, 5, 3, 15, 7, 12, 11, 6] },
  lick:   { cat: 'lick',   idx: [1, 8, 2, 3, 11, 13, 5, 10] },
  kill:   { cat: 'punch',  idx: [2, 10, 13, 14] },
};

function gifsFor(action) {
  const p = POOLS[action] || { cat: action, idx: [] };
  return p.idx.map(n => `${BASE}/${p.cat}/${n}.gif`);
}

function pickGif(action) {
  const all = gifsFor(action);
  return all[Math.floor(Math.random() * all.length)];
}

module.exports = { POOLS, gifsFor, pickGif, BASE };