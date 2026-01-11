// Companion app server for file transfer
// Just serves static files - the actual logic is in public/index.html

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

// Serve static files from public/
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

// Request handler
async function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;

  // Static files
  if (method === 'GET' && url.pathname === '/') {
    return serveStatic(res, 'index.html');
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
}

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`File Transfer App running on http://localhost:${PORT}`);
});
