@echo off
REM ============================================================
REM   Quick deploy helper
REM   Double-click this to: stage all changes -> commit -> push
REM   Cloudflare auto-deploys within ~30s after the push lands.
REM
REM   Optional: pass a commit message
REM       push.bat "your message here"
REM ============================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

REM Make sure Git is on PATH (handles fresh sessions that haven't refreshed env)
set "GITPATH=C:\Program Files\Git\cmd"
if exist "%GITPATH%\git.exe" set "PATH=%GITPATH%;%PATH%"

echo.
echo  ====================================================
echo    Pushing portfolio to GitHub  ->  Cloudflare deploy
echo  ====================================================
echo.

git status --short
echo.

git add .

REM Check if anything is staged
git diff --staged --quiet
if %errorlevel% equ 0 (
    echo Nothing to commit. Working tree clean.
    echo.
    pause
    exit /b 0
)

REM Build commit message — argument first, else timestamp
set "MSG=%~1"
if "%MSG%"=="" (
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value ^| find "="') do set DT=%%I
    set "DT=!DT:~0,4!-!DT:~4,2!-!DT:~6,2! !DT:~8,2!:!DT:~10,2!"
    set "MSG=update !DT!"
)

echo Commit message: !MSG!
echo.

git commit -m "!MSG!"
if errorlevel 1 (
    echo.
    echo [ERROR] Commit failed.
    pause
    exit /b 1
)

REM Pull any remote changes (e.g. edits made on GitHub.com) and replay our commit on top.
REM If there's a real conflict, this stops and asks you to resolve.
echo.
echo Syncing with remote (pull --rebase) ...
git pull --rebase origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Pull failed — likely a merge conflict.
    echo Resolve conflicts in the files git lists above, then run:
    echo     git add ^<file^>
    echo     git rebase --continue
    echo     git push
    pause
    exit /b 1
)

git push
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed. Check the message above.
    echo If GitHub asked for credentials, complete the browser sign-in and try again.
    pause
    exit /b 1
)

echo.
echo  ====================================================
echo    Pushed.
echo    Cloudflare will redeploy in ~30 seconds.
echo    Watch it at: https://dash.cloudflare.com
echo    Live: https://saadm.dev
echo  ====================================================
echo.
pause
endlocal
