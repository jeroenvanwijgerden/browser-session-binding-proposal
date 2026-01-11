// Companion app server - just serves static files
// The actual app logic is in public/index.html

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
  console.log(`App server running on http://localhost:${PORT}`);
});
