@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo MAM LUA PHIEU LUU - LOCAL WEBSITE
 echo Mo http://localhost:8080 trong Chrome / Edge
 echo Nhan Ctrl+C de dung server.
 echo.
where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8080"
  py -m http.server 8080
) else (
  start "" "http://localhost:8080"
  python -m http.server 8080
)
pause
