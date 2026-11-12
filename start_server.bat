@echo off
title IRONFIT PRO - Gym Tracker & Database Server
cd /d "%~dp0"
echo ============================================================
echo   IRONFIT PRO - SQLite Gym Database Server
echo ============================================================
echo.
echo Starting database server on http://localhost:3000 ...
echo Close this window to stop the server.
echo.
node server.js
pause
