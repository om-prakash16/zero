@echo off
echo Starting CROSSWIRE FastAPI Real-Time Translation & Live Dubbing Engine...
cd /d "%~dp0\.."
backend\.venv\Scripts\uvicorn.exe backend.main:app --host 127.0.0.1 --port 8000 --reload
