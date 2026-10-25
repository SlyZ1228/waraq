@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:4173 in your browser.
echo Keep this window open while downloading offline resources. Ctrl+C stops the preview.
".venv\Scripts\python.exe" -m http.server 4173 --bind 127.0.0.1 --directory dist
pause
