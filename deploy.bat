@echo off
REM 自动化部署（Windows 一键脚本，部署到 GitHub Pages）
cd /d "%~dp0"
echo [信息] 安装/校验依赖...
call npm install
echo [信息] 开始部署...
node deploy.js
pause
