@echo off
title Scraper Camoufox
echo ==========================================
echo Demarrage du scraper Camoufox (port 8765)...
echo ==========================================
echo.

cd scraper-service
call .venv\Scripts\activate.bat
python -m uvicorn main:app --host 127.0.0.1 --port 8765

pause
