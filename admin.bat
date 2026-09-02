@echo off
REM 启动博客后台编辑服务（Windows 一键脚本）
cd /d "%~dp0"
if not exist public (
  echo [信息] 未检测到 public 目录，先执行构建...
  call npm run build
)
echo [信息] 启动后台编辑服务 http://localhost:4000/admin
node admin.js
pause
