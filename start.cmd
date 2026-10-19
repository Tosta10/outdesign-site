@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 and pnpm 11, then run this file again.
  pause
  exit /b 1
)
set "taskPnpm=pnpm"
where pnpm >nul 2>nul
if errorlevel 1 set "taskPnpm=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
if not exist node_modules (
  call "%taskPnpm%" install --frozen-lockfile
  if errorlevel 1 exit /b 1
)
echo OutDesign: http://127.0.0.1:4321/
echo Use the Author button in the footer to set your two passwords.
call "%taskPnpm%" dev
endlocal
