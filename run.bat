@echo off
REM ============================================================
REM  Saad - Portfolio local server launcher
REM  Double-click this file to view the site at http://localhost:8000
REM ============================================================

setlocal
set PORT=8000
set HOST=127.0.0.1

REM Move into the folder this .bat lives in (the site/ directory)
cd /d "%~dp0"

echo.
echo  =====================================================
echo    Saad - Portfolio
echo    Serving:  %CD%
echo    URL:      http://%HOST%:%PORT%/
echo    Stop:     Ctrl+C in this window
echo  =====================================================
echo.

REM Pick the first available Python launcher
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    set PY=py
    goto :launch
)
where python >nul 2>nul
if %ERRORLEVEL%==0 (
    set PY=python
    goto :launch
)
where python3 >nul 2>nul
if %ERRORLEVEL%==0 (
    set PY=python3
    goto :launch
)

echo [ERROR] Python is not installed or not on PATH.
echo Install it from https://www.python.org/downloads/ and try again.
pause
exit /b 1

:launch
REM Open the browser AFTER a short delay so the server has time to bind
start "" /min cmd /c "timeout /t 1 /nobreak >nul && start http://%HOST%:%PORT%/"

REM Start the static server in this window (foreground so Ctrl+C stops it)
%PY% -m http.server %PORT% --bind %HOST%

endlocal
