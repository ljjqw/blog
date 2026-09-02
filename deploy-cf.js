/**
 * deploy-cf.js —— Cloudflare Pages 自动化部署脚本
 * 1) 先构建（node build.js）
 * 2) 用 Cloudflare 官方 Wrangler 把 public/ 上传到 Cloudflare Pages
 *
 *    Cloudflare Pages 免费、无需服务器，且在中国大陆通常可直接访问（不像 github.io 常被墙）。
 *
 * 鉴权（任选其一即可）：
 *   A. 交互登录（本机一次性）：先运行 `npx wrangler login`
 *   B. 环境变量（CI / 自动化）：设置
 *        CLOUDFLARE_API_TOKEN  （Cloudflare → My Profile → API Tokens，权限选 Account: Cloudflare Pages: Edit）
 *        CLOUDFLARE_ACCOUNT_ID
 *
 * 项目名：默认取 package.json 的 name，可用环境变量 CF_PROJECT_NAME 覆盖。
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const pkg = require('./package.json');

// 1) 先构建
console.log('→ 构建站点...');
try {
  execSync('node build.js', { stdio: 'inherit', cwd: ROOT });
} catch (e) {
  console.error('✗ 构建失败，终止部署。');
  process.exit(1);
}

// 2) 找到 wrangler（优先用本地安装，否则走 npx 自动下载）
const localBin = path.join(ROOT, 'node_modules', '.bin', 'wrangler' + (process.platform === 'win32' ? '.cmd' : ''));
const wrangler = fs.existsSync(localBin) ? localBin : 'npx wrangler';

// 3) 解析项目名（Cloudflare 要求小写、数字、连字符）
const rawName = process.env.CF_PROJECT_NAME || pkg.name || 'my-doc-site';
const projectName = rawName
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '') || 'my-doc-site';

// 4) 鉴权提示
const tokenAuth = !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
if (!tokenAuth) {
  console.log('ℹ️  未检测到 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 环境变量。');
  console.log('    将尝试使用已通过 `wrangler login` 缓存的凭证；');
  console.log('    若尚未登录，请先运行 `npx wrangler login`（或设置上述环境变量）。\n');
}

// 5) 部署
console.log(`→ 部署到 Cloudflare Pages 项目: ${projectName}`);
console.log('  （首次会自动创建项目；若已存在则更新生产环境）\n');
try {
  execSync(`${wrangler} pages deploy public --project-name ${projectName}`, {
    stdio: 'inherit',
    cwd: ROOT,
    shell: true
  });
} catch (e) {
  if (!tokenAuth) {
    console.error('\n✗ 部署失败：看起来尚未登录 Cloudflare。请任选一种方式后重试：');
    console.error('    A. 交互登录：npx wrangler login');
    console.error('    B. 环境变量：CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID');
    console.error('       （Cloudflare 控制台 → My Profile → API Tokens，权限选 Account: Cloudflare Pages: Edit）');
  } else {
    console.error('\n✗ 部署失败，请检查：凭证权限、项目名、网络连通性。');
  }
  process.exit(1);
}

console.log('\n✓ 部署完成！');
console.log('  预览/生产地址类似: https://<project>.<hash>.pages.dev');
console.log('  （Cloudflare 控制台 → Pages → 你的项目 → Deployments 查看，Custom domains 可绑定自定义域名）');
