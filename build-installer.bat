@echo off
:: Always run from the folder where this script lives (project root)
cd /d "%~dp0"

title NEXOR ERP - Build Installer
color 0A

echo.
echo ========================================
echo    NEXOR ERP - BUILD INSTALLER
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

:: Check for bundled PostgreSQL installer (warn only, do not block)
if not exist "installer\postgres\postgresql-16-windows-x64.exe" (
    echo.
    echo [WARNING] Bundled PostgreSQL installer NOT FOUND.
    echo           Expected: installer\postgres\postgresql-16-windows-x64.exe
    echo.
    echo           The installer will still build, but end users will
    echo           need PostgreSQL 16 already installed on their PC.
    echo.
    echo           To bundle: download PostgreSQL 16 Windows x64 from
    echo           https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
    echo           and place it at the path above.
    echo.
    echo [INFO] Continuing without bundled PostgreSQL installer...
) else (
    echo [OK] Bundled PostgreSQL installer found.
)
echo.

echo [1/5] Verifying app dependencies...
if exist "node_modules\.bin\vite.cmd" (
    echo [OK] App dependencies already installed.
) else (
    echo [INFO] Installing app dependencies (first time only)...
    if exist "package-lock.json" (
        call npm ci --no-audit --no-fund --loglevel=error
    ) else (
        call npm install --no-audit --no-fund --loglevel=error
    )
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install app dependencies
        pause
        exit /b 1
    )
)

echo.
echo [2/5] Verifying Electron build tools...
if exist "node_modules\.bin\electron-builder.cmd" (
    if exist "node_modules\electron\dist\electron.exe" (
        echo [OK] Electron build tools already installed.
        goto :step3
    )
)

echo [INFO] Installing Electron build tools (first time only)...
call npm install --no-save --no-package-lock --no-audit --no-fund --loglevel=error electron electron-builder electron-squirrel-startup
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Electron build tools
    pause
    exit /b 1
)

:step3

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
