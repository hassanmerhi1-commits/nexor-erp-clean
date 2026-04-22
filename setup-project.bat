@echo off
title Kwanza ERP - First Time Setup
color 0E

echo.
echo ========================================
echo    KWANZA ERP - FIRST TIME SETUP
echo ========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please download and install Node.js LTS from:
    echo https://nodejs.org
    echo.
    echo After installing, run this script again.
    pause
    exit /b 1
)

echo [OK] Node.js version:
node --version
echo.

:: Check npm
echo [OK] npm version:
call npm --version
echo.

:: Install dependencies
echo [1/2] Installing project dependencies...
echo This may take a few minutes...
echo.
call npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies.
    echo Try running: npm cache clean --force
    echo Then run this script again.
    pause
    exit /b 1
)

echo.
echo [2/2] Setup complete!
echo.
echo ========================================
echo    READY TO GO!
echo ========================================
echo.
echo You can now use:
echo.
echo   run-dev.bat          - Run in development mode
echo   build-installer.bat  - Build Windows installer
echo.
echo ========================================
echo.

pause
