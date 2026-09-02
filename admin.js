/**
 * admin.js —— 后台编辑服务（本地运行，不部署到线上）
 *
 * 功能：
 *   1) 可视化 新建 / 编辑 / 删除 文档（Markdown），保存后自动重建站点
 *   2) 批量【导入 .md 文件】（保留原 frontmatter 的 parent/order）
 *   3) 可视化【编辑关系层级】：调整每篇文档的父级与排序，自动重建目录树
 *
 * 启动：npm run admin   （默认 http://localhost:4000/admin）
 * 注意：这是本地写作工具，请勿暴露到公网。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { readDocs, parseFrontmatter, slugify } = require('./build');

const nativeFs = require('fs');
const realUnlink = nativeFs.unlinkSync.bind(nativeFs);

const ROOT = __dirname;
const DOCS_DIR = path.join(ROOT, 'src', 'docs');
const PUBLIC = path.join(ROOT, 'public');

const PORT = process.env.ADMIN_PORT || require('./config.js').adminPort || 4000;

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// 把文档对象写成 Markdown 文件内容
function toMarkdown(post) {
  const tags = Array.isArray(post.tags) ? post.tags.join(', ') : post.tags || '';
  const fm = ['---'];
  if (post.title) fm.push(`title: ${post.title}`);
  if (post.date) fm.push(`date: ${post.date}`);
  if (post.parent) fm.push(`parent: ${post.parent}`);
  if (post.order !== undefined && post.order !== '' && post.order !== null) fm.push(`order: ${post.order}`);
  if (post.group) fm.push(`group: ${post.group}`);
  if (tags) fm.push(`tags: ${tags}`);
  if (post.description) fm.push(`description: ${post.description}`);
  fm.push('---');
  return fm.join('\n') + '\n\n' + (post.content || '') + '\n';
}

// 读取某篇文档的 frontmatter + 正文
function readDocFile(slug) {
  const file = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  return { data, body: body.trim() };
}

function rebuild() {
  try {
    execSync('node build.js', { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error('✗ 构建失败:', e.message);
    return false;
  }
}

// 列出全部文档（含层级字段）
function listDocs() {
  return readDocs().map((d) => ({
    slug: d.slug,
    title: d.title,
    date: d.date,
    parent: d.parent,
    order: d.order === 999 ? '' : d.order,
    group: d.group,
    tags: d.tags,
    description: d.description,
    content: d.content
  }));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // 后台页面
  if (pathname === '/' || pathname === '/admin') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ADMIN_HTML);
    return;
  }

  // 静态站点（后台与博客共用一个端口，可直接预览 /docs/xxx.html）
  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    let rel = url.pathname;
    if (rel === '/') rel = '/index.html';
    const filePath = path.join(PUBLIC, decodeURIComponent(rel));
    if (filePath.startsWith(PUBLIC) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon'
      }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      return res.end(fs.readFileSync(filePath));
    }
    const htmlPath = path.join(PUBLIC, decodeURIComponent(rel) + '.html');
    if (filePath.startsWith(PUBLIC) && fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(htmlPath));
    }
    if (fs.existsSync(path.join(PUBLIC, 'index.html'))) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(PUBLIC, 'index.html')));
    }
    return sendJSON(res, 404, { error: 'Not Found' });
  }

  // API: 列表
  if (pathname === '/api/posts' && req.method === 'GET') {
    return sendJSON(res, 200, { posts: listDocs() });
  }

  // API: 新建
  if (pathname === '/api/posts' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      let slug = (body.slug || '').trim();
      if (!slug) slug = slugify(body.title || 'untitled');
      let finalSlug = slug;
      let i = 2;
      while (fs.existsSync(path.join(DOCS_DIR, `${finalSlug}.md`))) {
        finalSlug = `${slug}-${i++}`;
      }
      fs.writeFileSync(path.join(DOCS_DIR, `${finalSlug}.md`), toMarkdown(body), 'utf8');
      if (!rebuild()) return sendJSON(res, 500, { error: '构建失败' });
      return sendJSON(res, 200, { slug: finalSlug });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // API: 批量导入
  if (pathname === '/api/import' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const files = Array.isArray(body.files) ? body.files : [];
      const created = [];
      const skipped = [];
      const errors = [];
      for (const f of files) {
        const raw = f.content || '';
        const { data } = parseFrontmatter(raw);
        const baseName = String(f.name || '').replace(/\.md$/i, '');
        let slug = (data.title && slugify(data.title)) || (baseName && slugify(baseName)) || slugify('doc');
        let finalSlug = slug;
        let i = 2;
        while (fs.existsSync(path.join(DOCS_DIR, `${finalSlug}.md`))) {
          finalSlug = `${slug}-${i++}`;
        }
        const post = {
          title: data.title || baseName || finalSlug,
          date: data.date || '',
          parent: data.parent || '',
          order: data.order || '',
          group: String(data.group || '').toLowerCase() === 'true',
          tags: data.tags || '',
          description: data.description || '',
          content: raw.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '')
        };
        fs.writeFileSync(path.join(DOCS_DIR, `${finalSlug}.md`), toMarkdown(post), 'utf8');
        created.push(finalSlug);
      }
      if (!rebuild()) return sendJSON(res, 500, { error: '构建失败', created, skipped, errors });
      return sendJSON(res, 200, { created, skipped, errors, count: created.length });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // API: 保存层级关系
  if (pathname === '/api/hierarchy' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const updates = Array.isArray(body.updates) ? body.updates : [];
      const results = [];
      for (const u of updates) {
        const slug = (u.slug || '').trim();
        if (!slug) continue;
        const doc = readDocFile(slug);
        if (!doc) {
          results.push({ slug, ok: false, error: '不存在' });
          continue;
        }
        if (u.parent !== undefined) doc.data.parent = u.parent || '';
        if (u.order !== undefined && u.order !== '') doc.data.order = u.order;
        else if (u.order === '') delete doc.data.order;
        const post = {
          title: doc.data.title,
          date: doc.data.date || '',
          parent: doc.data.parent || '',
          order: doc.data.order || '',
          group: String(doc.data.group || '').toLowerCase() === 'true',
          tags: doc.data.tags || '',
          description: doc.data.description || '',
          content: doc.body
        };
        fs.writeFileSync(path.join(DOCS_DIR, `${slug}.md`), toMarkdown(post), 'utf8');
        results.push({ slug, ok: true });
      }
      if (!rebuild()) return sendJSON(res, 500, { error: '构建失败', results });
      return sendJSON(res, 200, { ok: true, results });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // API: 单篇 获取/更新/删除
  const m = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    const file = path.join(DOCS_DIR, `${slug}.md`);

    if (req.method === 'GET') {
      const doc = readDocFile(slug);
      if (!doc) return sendJSON(res, 404, { error: '文档不存在' });
      return sendJSON(res, 200, {
        slug,
        title: doc.data.title || slug,
        date: doc.data.date || '',
        parent: doc.data.parent || '',
        order: doc.data.order || '',
        group: String(doc.data.group || '').toLowerCase() === 'true',
        tags: (doc.data.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
        description: doc.data.description || '',
        content: doc.body
      });
    }

    if (req.method === 'PUT') {
      try {
        if (!fs.existsSync(file)) return sendJSON(res, 404, { error: '文档不存在' });
        const b = await readBody(req);
        let newSlug = (b.slug || slug).trim() || slug;
        const newFile = path.join(DOCS_DIR, `${newSlug}.md`);
        if (newSlug !== slug && fs.existsSync(newFile)) {
          return sendJSON(res, 400, { error: '目标 slug 已存在，请换一个' });
        }
        fs.writeFileSync(newFile, toMarkdown(b), 'utf8');
        if (newSlug !== slug) realUnlink(file);
        if (!rebuild()) return sendJSON(res, 500, { error: '构建失败' });
        return sendJSON(res, 200, { slug: newSlug });
      } catch (e) {
        return sendJSON(res, 400, { error: e.message });
      }
    }

    if (req.method === 'DELETE') {
      if (!fs.existsSync(file)) return sendJSON(res, 404, { error: '文档不存在' });
      try {
        realUnlink(file);
      } catch (e) {
        if (fs.existsSync(file)) return sendJSON(res, 500, { error: '删除失败: ' + e.message });
      }
      if (fs.existsSync(file)) return sendJSON(res, 500, { error: '删除失败：文件仍存在' });
      if (!rebuild()) return sendJSON(res, 500, { error: '构建失败' });
      return sendJSON(res, 200, { ok: true });
    }
  }

  sendJSON(res, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log('✓ 后台编辑服务已启动');
  console.log(`  打开: http://localhost:${PORT}/admin`);
  console.log('  （本地写作工具，请勿暴露到公网）');
});

// ============================================================
//  后台管理页面（纯前端，无依赖）
// ============================================================
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>文档后台 · 编辑与层级管理</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
    background:#0f1115; color:#e6e8ec; }
  .top { padding:14px 18px; border-bottom:1px solid #2a2f3a; display:flex; align-items:center; gap:14px; }
  .top h1 { font-size:16px; margin:0; }
  .tabs { display:flex; gap:6px; margin-left:auto; }
  .tab { cursor:pointer; border:1px solid #2a2f3a; background:#181b22; color:#c7ccd4;
    padding:7px 14px; border-radius:8px; font-size:13px; }
  .tab.active { background:#6ea8fe; color:#0f1115; border-color:#6ea8fe; }
  .panel { display:none; padding:18px 22px; }
  .panel.active { display:block; }
  /* 编辑文章 */
  .edit-wrap { display:flex; gap:16px; align-items:flex-start; }
  .list { width:280px; border:1px solid #2a2f3a; border-radius:10px; overflow:auto; max-height:78vh; }
  .list-item { padding:11px 14px; border-bottom:1px solid #1c2029; cursor:pointer; }
  .list-item:hover { background:#181b22; }
  .list-item .t { font-size:14px; }
  .list-item .d { font-size:12px; color:#9aa0aa; margin-top:2px; }
  .editor { flex:1; }
  .bar { display:flex; gap:10px; margin-bottom:14px; align-items:center; }
  .btn { cursor:pointer; border:none; border-radius:8px; padding:8px 14px; font-size:14px; }
  .btn-primary { background:#6ea8fe; color:#0f1115; }
  .btn-ghost { background:#20242d; color:#e6e8ec; }
  .btn-danger { background:#3a2126; color:#ff9aa3; }
  .hint { color:#9aa0aa; font-size:12px; margin-left:auto; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .field { margin-bottom:12px; }
  .field label { display:block; font-size:13px; color:#9aa0aa; margin-bottom:5px; }
  .field input, .field textarea, .field select { width:100%; background:#181b22; border:1px solid #2a2f3a;
    color:#e6e8ec; border-radius:8px; padding:9px 11px; font-size:14px; font-family:inherit; }
  .field textarea { min-height:320px; resize:vertical; line-height:1.6; }
  /* 层级 */
  .import-box { border:1px dashed #3a4150; border-radius:10px; padding:16px; margin-bottom:18px; background:#161a21; }
  .import-box input[type=file] { color:#9aa0aa; font-size:13px; }
  .import-log { font-size:12px; color:#9aa0aa; margin-top:10px; white-space:pre-wrap; max-height:120px; overflow:auto; }
  table.hier { width:100%; border-collapse:collapse; font-size:14px; }
  table.hier th, table.hier td { border:1px solid #2a2f3a; padding:8px 10px; text-align:left; }
  table.hier th { background:#161a21; color:#9aa0aa; font-weight:600; }
  table.hier select, table.hier input { width:100%; background:#181b22; border:1px solid #2a2f3a; color:#e6e8ec; border-radius:6px; padding:6px 8px; }
  .path { color:#9aa0aa; font-size:12px; }
</style>
</head>
<body>
  <div class="top">
    <h1>📚 文档后台</h1>
    <div class="tabs">
      <div class="tab active" data-tab="edit">编辑文章</div>
      <div class="tab" data-tab="hier">层级结构</div>
    </div>
  </div>

  <!-- 编辑文章 -->
  <div class="panel active" id="panel-edit">
    <div class="edit-wrap">
      <div class="list" id="list"></div>
      <div class="editor">
        <div class="bar">
          <button class="btn btn-primary" id="newBtn">+ 新建文档</button>
          <button class="btn btn-primary" id="saveBtn">保存</button>
          <button class="btn btn-danger" id="delBtn">删除</button>
          <span class="hint" id="hint"></span>
        </div>
        <div class="grid2">
          <div class="field"><label>标题</label><input id="f-title" placeholder="文档标题"></div>
          <div class="field"><label>URL slug（留空自动生成）</label><input id="f-slug" placeholder="my-doc"></div>
        </div>
        <div class="grid2">
          <div class="field"><label>父级文档（留空=顶级）</label><select id="f-parent"></select></div>
          <div class="field"><label>排序 order（数字越小越靠前）</label><input id="f-order" type="number" placeholder="如 1"></div>
        </div>
        <div class="grid2">
          <div class="field"><label>日期 (YYYY-MM-DD)</label><input id="f-date"></div>
          <div class="field"><label>标签 (逗号分隔)</label><input id="f-tags" placeholder="技术, 前端"></div>
        </div>
        <div class="field"><label>简介 / 摘要</label><input id="f-desc" placeholder="一句话简介"></div>
        <div class="field"><label>正文 (Markdown)</label><textarea id="f-content" placeholder="# 标题&#10;&#10;正文内容……"></textarea></div>
      </div>
    </div>
  </div>

  <!-- 层级结构 -->
  <div class="panel" id="panel-hier">
    <div class="import-box">
      <strong>📥 导入 Markdown 文件</strong>
      <p style="font-size:13px;color:#9aa0aa;margin:6px 0 10px;">选择若干 .md 文件批量导入；文件原有 frontmatter 的 <code>parent</code> / <code>order</code> 会被保留。slug 冲突时自动加后缀。</p>
      <input type="file" id="importInput" accept=".md,.markdown" multiple>
      <div style="margin-top:10px;"><button class="btn btn-primary" id="importBtn">导入选中的文件</button></div>
      <div class="import-log" id="importLog"></div>
    </div>

    <div style="display:flex;align-items:center;margin-bottom:10px;">
      <strong>🗂 关系层级与排序</strong>
      <span class="hint" style="margin-left:auto;">修改后点击“保存层级”即可重建目录树</span>
      <button class="btn btn-primary" id="saveHierBtn" style="margin-left:12px;">保存层级</button>
    </div>
    <table class="hier">
      <thead><tr><th style="width:26%">标题</th><th style="width:30%">父级</th><th style="width:10%">顺序</th><th>完整路径</th></tr></thead>
      <tbody id="hierBody"></tbody>
    </table>
  </div>

<script>
let current = null;
let allDocs = [];

function esc(s){ return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function setHint(t){ document.getElementById('hint').textContent = t; }

async function loadList(){
  const r = await fetch('/api/posts');
  const { posts } = await r.json();
  allDocs = posts;
  const list = document.getElementById('list');
  list.innerHTML = '';
  posts.forEach(p=>{
    const div = document.createElement('div');
    div.className='list-item';
    div.innerHTML = '<div class="t">'+esc(p.title)+'</div><div class="d">'+(p.parent?('父: '+esc(p.parent)):'顶级')+(p.date?(' · '+esc(p.date)):'')+'</div>';
    div.onclick = ()=>loadPost(p.slug);
    list.appendChild(div);
  });
  fillParentSelects();
  renderHierTable();
}

function fillParentSelects(){
  const opts = '<option value="">（顶级）</option>' + allDocs.map(d=>'<option value="'+esc(d.slug)+'">'+esc(d.title)+'</option>').join('');
  document.getElementById('f-parent').innerHTML = opts;
  // 层级表格里的父级下拉也用同一份
  document.querySelectorAll('.hier select').forEach(sel=>{ /* 在 renderHierTable 内已填充 */ });
}

async function loadPost(slug){
  const r = await fetch('/api/posts/'+encodeURIComponent(slug));
  const p = await r.json();
  current = slug;
  document.getElementById('f-title').value = p.title||'';
  document.getElementById('f-date').value = p.date||'';
  document.getElementById('f-tags').value = (p.tags||[]).join(', ');
  document.getElementById('f-desc').value = p.description||'';
  document.getElementById('f-slug').value = p.slug||'';
  document.getElementById('f-parent').value = p.parent||'';
  document.getElementById('f-order').value = (p.order===''||p.order==null)?'':p.order;
  document.getElementById('f-content').value = p.content||'';
  setHint('正在编辑：'+slug);
}

function collect(){
  return {
    title: document.getElementById('f-title').value,
    date: document.getElementById('f-date').value,
    tags: document.getElementById('f-tags').value,
    description: document.getElementById('f-desc').value,
    slug: document.getElementById('f-slug').value,
    parent: document.getElementById('f-parent').value,
    order: document.getElementById('f-order').value,
    content: document.getElementById('f-content').value
  };
}

document.getElementById('newBtn').onclick = ()=>{
  current=null;
  ['f-title','f-date','f-tags','f-desc','f-slug','f-content'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('f-parent').value='';
  document.getElementById('f-order').value='';
  document.getElementById('f-date').value = new Date().toISOString().slice(0,10);
  setHint('新建文档模式');
};

document.getElementById('saveBtn').onclick = async ()=>{
  const data = collect();
  if(!data.title && !data.content){ setHint('请填写标题或正文'); return; }
  let r;
  if(current) r = await fetch('/api/posts/'+encodeURIComponent(current),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else r = await fetch('/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const j = await r.json();
  if(r.ok){ setHint('✅ 已保存'); await loadList(); if(j.slug) loadPost(j.slug); }
  else setHint('❌ '+(j.error||'保存失败'));
};

document.getElementById('delBtn').onclick = async ()=>{
  if(!current){ setHint('没有可删除的文档'); return; }
  if(!confirm('确定删除《'+current+'》？此操作不可撤销。')) return;
  const r = await fetch('/api/posts/'+encodeURIComponent(current),{method:'DELETE'});
  if(r.ok){ setHint('🗑 已删除'); current=null; await loadList(); }
  else setHint('❌ 删除失败');
};

/* ---------- 导入 ---------- */
document.getElementById('importBtn').onclick = async ()=>{
  const input = document.getElementById('importInput');
  const files = Array.from(input.files||[]);
  const log = document.getElementById('importLog');
  if(!files.length){ log.textContent='请先选择 .md 文件'; return; }
  log.textContent = '正在导入 '+files.length+' 个文件…';
  const arr = [];
  for(const f of files){ arr.push({ name:f.name, content: await f.text() }); }
  const r = await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:arr})});
  const j = await r.json();
  if(r.ok){
    log.textContent = '✅ 成功导入 '+j.count+' 篇：\\n' + j.created.join('\\n');
    await loadList();
  } else {
    log.textContent = '❌ '+(j.error||'导入失败');
  }
};

/* ---------- 层级表格 ---------- */
function pathOf(slug, map, guard=0){
  if(guard>20) return slug;
  const d = map[slug];
  if(!d || !d.parent || !map[d.parent]) return d?d.title:slug;
  return pathOf(d.parent, map, guard+1) + ' / ' + d.title;
}
function renderHierTable(){
  const map = {}; allDocs.forEach(d=>map[d.slug]=d);
  const body = document.getElementById('hierBody');
  body.innerHTML='';
  allDocs.forEach(d=>{
    const tr = document.createElement('tr');
    const parentOpts = '<option value="">（顶级）</option>' + allDocs
      .filter(x=>x.slug!==d.slug)
      .map(x=>'<option value="'+esc(x.slug)+'"'+(x.slug===d.parent?' selected':'')+'>'+esc(x.title)+'</option>').join('');
    tr.innerHTML =
      '<td>'+esc(d.title)+'</td>'+
      '<td><select data-slug="'+esc(d.slug)+'" class="h-parent">'+parentOpts+'</select></td>'+
      '<td><input type="number" data-slug="'+esc(d.slug)+'" class="h-order" value="'+esc(d.order===''||d.order==null?'':d.order)+'"></td>'+
      '<td class="path">'+esc(pathOf(d.slug, map))+'</td>';
    body.appendChild(tr);
  });
}
document.getElementById('saveHierBtn').onclick = async ()=>{
  const updates = [];
  document.querySelectorAll('.h-parent').forEach(sel=>{
    const orderEl = document.querySelector('.h-order[data-slug="'+CSS.escape(sel.dataset.slug)+'"]');
    updates.push({ slug: sel.dataset.slug, parent: sel.value, order: orderEl?orderEl.value:'' });
  });
  const r = await fetch('/api/hierarchy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({updates})});
  const j = await r.json();
  if(r.ok){ setHint('✅ 层级已保存并重建'); await loadList(); }
  else setHint('❌ '+(j.error||'保存失败'));
};

/* ---------- Tab 切换 ---------- */
document.querySelectorAll('.tab').forEach(t=>{
  t.onclick = ()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('panel-'+t.dataset.tab).classList.add('active');
    if(t.dataset.tab==='hier') renderHierTable();
  };
});

loadList();
</script>
</body>
</html>`;
