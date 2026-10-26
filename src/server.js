import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import './db.js';
import { handleApi } from './api.js';
import { initTelegram, handleWebhook, runReminders } from './telegram.js';

const PUBLIC = path.join(config.root, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json',
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => {
      n += c.length;
      if (n > limit) { reject(Object.assign(new Error('too_large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveFile(res, file, extra = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff', ...extra });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);

    if (p === '/health') { res.writeHead(200); return res.end('ok'); }

    if (p.startsWith('/api/')) return await handleApi(req, res, u, readBody);

    if (req.method === 'POST' && p.startsWith('/tg/')) {
      const key = p.slice(4);
      if (!/^(platform|b\d+)$/.test(key)) { res.writeHead(404); return res.end(); }
      const body = await readBody(req, 1024 * 1024);
      let update; try { update = JSON.parse(body.toString('utf8')); } catch { res.writeHead(400); return res.end(); }
      const status = await handleWebhook(key, req.headers['x-telegram-bot-api-secret-token'], update);
      res.writeHead(status); return res.end();
    }

    if (p.startsWith('/uploads/')) {
      const name = path.basename(p);
      if (!/^[\w.-]+\.(jpg|png|webp)$/.test(name)) { res.writeHead(404); return res.end(); }
      return serveFile(res, path.join(config.uploadDir, name), { 'Cache-Control': 'public, max-age=31536000, immutable' });
    }

    if (p === '/' ) { res.writeHead(302, { Location: '/app/' }); return res.end(); }
    if (p.startsWith('/app')) {
      let rel = p.replace(/^\/app\/?/, '') || 'index.html';
      const file = path.join(PUBLIC, rel);
      if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
      return serveFile(res, file, { 'Cache-Control': 'no-cache' });
    }
    res.writeHead(404); res.end('Not found');
  } catch (e) {
    if (e.status === 413) { res.writeHead(413); return res.end(); }
    console.error('[http]', e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.listen(config.port, config.host || undefined, () => {
  console.log(`[http] http://localhost:${config.port}/app/   (DEV_MODE=${config.dev ? 'on' : 'off'})`);
  initTelegram().catch(e => console.error('[tg init]', e));
});

process.on('unhandledRejection', e => console.error('[unhandled]', e));
export { runReminders };
