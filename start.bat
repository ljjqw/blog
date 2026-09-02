@echo off
REM 本地启动服务（Windows 一键脚本）
REM 用法：双击本文件，或命令行执行 start.bat
cd /d "%~dp0"
if not exist public (
  echo [信息] 未检测到 public 目录，先执行构建...
  call npm run build
)
echo [信息] 启动本地预览服务...
node serve.js
pause
