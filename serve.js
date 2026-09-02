/**
 * serve.js —— 本地启动服务脚本（跨平台，仅依赖 Node 内置模块）
 * 用法: node serve.js  （端口可用 PORT 环境变量覆盖，默认读 config.js 的 port）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');

// 端口：环境变量优先，否则取 config.js，再否则 3000
let port = parseInt(process.env.PORT, 10);
if (!port) {
  try {
    port = require('./config.js').port || 3000;
  } catch (e) {
    port = 3000;
  }
}
const host = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

if (!fs.existsSync(PUBLIC)) {
  console.error('✗ 未找到 public/ 目录，请先运行: npm run build');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // 防目录穿越
  const filePath = path.join(PUBLIC, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const hasExt = path.extname(urlPath) !== '';
      if (hasExt) {
        // 带扩展名的资源缺失 → 真正的 404
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      // 无扩展名时尝试补 .html（支持 /blog 这种简洁链接）
      const htmlPath = path.join(PUBLIC, path.normalize(urlPath + '.html').replace(/^(\.\.[/\\])+/, ''));
      if (filePath.startsWith(PUBLIC) && fs.existsSync(htmlPath)) {
        fs.readFile(htmlPath, (e3, d3) => {
          if (e3) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': MIME['.html'] });
            res.end(d3);
          }
        });
        return;
      }
      // 无扩展名的路径兜底回 index.html（兼容目录式访问）
      const fallback = path.join(PUBLIC, 'index.html');
      fs.readFile(fallback, (e2, d2) => {
        if (e2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(d2);
        }
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, host, () => {
  const shown = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`\n✓ 本地服务已启动`);
  console.log(`  访问: http://${shown}:${port}/`);
  console.log(`  目录: ${PUBLIC}`);
  console.log(`  按 Ctrl+C 停止\n`);
});
