@echo off
REM Bazaar Ledger: downloads the official API data and opens the site locally at http://localhost:8787
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required: https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Installing dependencies...
  call npm install || (pause & exit /b 1)
)
if not exist dist\es\index.html (
  echo Downloading data from the Guild Wars 2 API ^(about 3 minutes, first time only^)...
  set SITE_URL=http://localhost:8787
  call npm run build || (pause & exit /b 1)
)
start "" http://localhost:8787/es/
call npx wrangler dev --port 8787
