/**
 * deploy.js —— 自动化部署脚本
 * 1) 先执行构建（node build.js）
 * 2) 用 gh-pages 把 public/ 推送到 GitHub 的 gh-pages 分支（GitHub Pages 免费托管）
 *
 * 前置条件:
 *   - 已 npm install（安装 marked、gh-pages）
 *   - 已 git init 并设置了名为 origin 的远程仓库
 *   - 在 GitHub 仓库 Settings → Pages 选择 "Deploy from a branch: gh-pages"
 */
const { execSync } = require('child_process');
const ghpages = require('gh-pages');

console.log('→ 构建站点...');
try {
  execSync('node build.js', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
  console.error('✗ 构建失败，终止部署。');
  process.exit(1);
}

// 校验 git remote
try {
  const remote = execSync('git remote get-url origin', {
    cwd: __dirname
  })
    .toString()
    .trim();
  if (!remote) throw new Error('no origin');
  console.log(`→ 目标仓库: ${remote}`);
} catch (e) {
  console.error('✗ 未检测到 git remote "origin"。');
  console.error('  请先执行:');
  console.error('    git init');
  console.error('    git remote add origin https://github.com/你的用户名/你的仓库.git');
  process.exit(1);
}

const options = {
  branch: 'gh-pages',
  dotfiles: true,
  message: 'deploy: ' + new Date().toISOString()
};

console.log('→ 推送到 gh-pages 分支...');
ghpages.publish('public', options, (err) => {
  if (err) {
    console.error('✗ 部署失败:', err.message);
    process.exit(1);
  }

  // 从 git remote 推断用户名/仓库名，给出准确链接
  let siteUrl = 'https://<用户名>.github.io/<仓库名>/';
  let settingsUrl = 'https://github.com/<用户名>/<仓库名>/settings/pages';
  try {
    const remote = execSync('git remote get-url origin', { cwd: __dirname })
      .toString()
      .trim();
    const m = remote.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (m) {
      const user = m[1];
      const repo = m[2];
      siteUrl = `https://${user}.github.io/${repo}/`;
      settingsUrl = `https://github.com/${user}/${repo}/settings/pages`;
    }
  } catch (e) {}

  console.log('\n✓ 部署成功！代码已推送到 gh-pages 分支。');
  console.log('\n⚠️  还需在 GitHub 上开启 Pages 才会真正可访问：');
  console.log(`    1) 打开 ${settingsUrl}`);
  console.log('    2) Source 选 "Deploy from a branch"');
  console.log('    3) Branch 选 gh-pages / (root)，点 Save');
  console.log('    4) 等待 1~2 分钟');
  console.log(`\n    正确访问地址（项目站点，带仓库名）: ${siteUrl}`);
  console.log('    （若自定义域名，在同一页面填写即可）');
  console.log('\n    提示：github.io 在中国大陆常被墙/很慢，如打不开');
  console.log('          建议改用 Cloudflare Pages / Netlify 等可直连的免费托管。');
});
