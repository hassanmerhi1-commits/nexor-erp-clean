@echo off
:: Always run from the folder where this script lives (project root)
cd /d "%~dp0"

title Kwanza ERP - Build Installer
color 0A

echo.
echo ========================================
echo    KWANZA ERP - BUILD INSTALLER
echo ========================================
echo.

echo [INFO] Running from: %cd%
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo.

:: Check if we're in the right directory
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo Please run this script from the project root folder.
    pause
    exit /b 1
)

echo [1/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/5] Installing Electron (dev dependencies)...
call npm install --save-dev electron electron-builder electron-squirrel-startup
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Electron
    pause
    exit /b 1
)

echo.
echo [3/5] Building web application...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build web app
    pause
    exit /b 1
)

echo.
echo [4/5] Building Windows installer...
call npx electron-builder --win
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build installer
    pause
    exit /b 1
)

echo.
echo ========================================
echo    BUILD COMPLETE!
echo ========================================
echo.
echo Your installers are in the "release" folder:
echo.
dir /b release\*.exe 2>nul
echo.
echo - .exe installer: Double-click to install
echo - Portable .exe: Run directly, no install needed
echo.

:: Open release folder
start "" "release"

pause
