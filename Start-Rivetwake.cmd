@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
echo Open the address printed below in Chrome or Edge. Keep this window open while playing.
node server/server.mjs
pause
