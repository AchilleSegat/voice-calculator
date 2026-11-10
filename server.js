// Tiny local server (lets Chrome remember the microphone permission).
// Run: node server.js   ->   http://localhost:4747
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4747;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.join(ROOT, path.normalize(url));
  if (!file.startsWith(ROOT) || !TYPES[path.extname(file)]) { res.writeHead(404); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Voice Calculator running at http://localhost:${PORT}`))
  .on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.log('Server already running.');
    else console.error(e);
  });
