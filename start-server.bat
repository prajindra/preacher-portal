@echo off
echo Starting ISKCON Malaysia Website Server...
echo.
echo The website will be available at: http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
python -m http.server 8000
pause
