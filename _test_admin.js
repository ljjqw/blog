process.env.ADMIN_PORT='4020';
const fs=require('fs');
const base='http://localhost:'+process.env.ADMIN_PORT;
require('./admin');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(700);
  // 1) 导入：带 frontmatter(parent/order) + 纯 md
  const files=[
    {name:'import-with-meta.md', content:'---\ntitle: 导入带层级\nparent: guide\norder: 5\ndescription: 导入测试\n---\n\n# 导入带层级\n\n内容。'},
    {name:'plain-hello.md', content:'# 纯文本导入\n\n没有 frontmatter。'}
  ];
  const imp=await (await fetch(base+'/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files})})).json();
  console.log('导入结果:', JSON.stringify(imp));
  console.log('src 文件存在?', fs.existsSync('src/docs/import-with-meta.md'), fs.existsSync('src/docs/plain-hello.md'));
  console.log('public 文件存在?', fs.existsSync('public/docs/import-with-meta.html'), fs.existsSync('public/docs/plain-hello.html'));

  // 2) 编辑层级：把 home 移入 guide 下，order=9
  const h=await (await fetch(base+'/api/hierarchy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({updates:[{slug:'home',parent:'guide',order:9}]})})).json();
  console.log('层级保存:', JSON.stringify(h));
  const guideHtml=fs.readFileSync('public/docs/guide.html','utf8');
  console.log('guide 侧边栏是否含 home 链接?', guideHtml.includes('href="../docs/home.html"'));
  const homeMd=fs.readFileSync('src/docs/home.md','utf8');
  console.log('home.md frontmatter 含 parent: guide?', /parent:\s*guide/.test(homeMd));

  // 3) 还原 home 为顶级，避免污染示例
  await fetch(base+'/api/hierarchy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({updates:[{slug:'home',parent:'',order:1}]})});
  // 4) 删除导入的测试文件
  for(const s of ['import-with-meta','plain-hello']){
    await fetch(base+'/api/posts/'+s,{method:'DELETE'});
  }
  console.log('清理后 src/docs:', fs.readdirSync('src/docs').join(', '));
  process.exit(0);
})();
