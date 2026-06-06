/**
 * Entry-point shim.  Some platforms expect `index.js` at the repo root.
 * This forwards to `server.js` so `node index.js` and `node server.js`
 * both work.
 */
require('./server');
