// File Transfer Receiver - static file server
//
// This serves the receiver webpage on a DIFFERENT origin (port 3002) from the
// relay (port 3000), demonstrating cross-origin OOB binding.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
  }[ext] || 'text/plain';

  try {
    const content = fs.readFileSync(path.join(__dirname, 'public', filePath));
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    serveStatic(res, 'index.html');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`File Receiver running on http://localhost:${PORT}`);
  console.log('');
  console.log('This demonstrates cross-origin OOB binding:');
  console.log('  - Receiver webpage: http://localhost:3000 (this server)');
  console.log('  - Relay service:    http://localhost:3002 (different origin)');
  console.log('');
});
