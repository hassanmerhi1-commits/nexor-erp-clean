@echo off
if /i not "%~1"=="__run__" (
    start "NEXOR ERP Builder" cmd /k ""%~f0" __run__"
    exit /b
)

setlocal EnableExtensions

:: Always run from the folder where this script lives (project root)
cd /d "%~dp0"

set "LOG_FILE=%~dp0build-installer.log"
break > "%LOG_FILE%"

title NEXOR ERP - Build Installer
color 0A

call :log ""
call :log "========================================"
call :log "   NEXOR ERP - BUILD INSTALLER"
call :log "========================================"
call :log ""
call :log "[INFO] Running from: %cd%"
call :log "[INFO] Full log: %LOG_FILE%"
call :log ""

:: Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    call :log "[ERROR] Node.js is not installed!"
    call :log "Please download and install Node.js from https://nodejs.org"
    goto :fail
)

call :log "[OK] Node.js found:"
node --version
node --version >> "%LOG_FILE%" 2>&1
call :log ""

:: Check if we're in the right directory
if not exist "package.json" (
    call :log "[ERROR] package.json not found!"
    call :log "Please run this script from the project root folder."
    goto :fail
)

:: Check for bundled PostgreSQL installer (warn only, do not block)
if not exist "installer\postgres\postgresql-16-windows-x64.exe" (
    call :log "[WARNING] Bundled PostgreSQL installer NOT FOUND."
    call :log "          Expected: installer\postgres\postgresql-16-windows-x64.exe"
    call :log "          Continuing without bundled PostgreSQL installer..."
) else (
    call :log "[OK] Bundled PostgreSQL installer found."
)
call :log ""

call :log "[1/5] Verifying app dependencies..."
set "NEEDS_FULL_INSTALL=0"
if not exist "node_modules\.bin\vite.cmd" set "NEEDS_FULL_INSTALL=1"

if "%NEEDS_FULL_INSTALL%"=="0" (
    call :log "[OK] Core app dependencies already installed."
) else (
    call :log "[INFO] Missing dependencies detected. Reinstalling full project dependencies..."
    call :log "[INFO] Using npm install with package-lock disabled so missing Electron packages can be added even if package-lock.json is stale."
call :run "Installing app dependencies with npm install" "npm install --package-lock=false --no-audit --no-fund --loglevel=error"
    if errorlevel 1 (
        call :log "[ERROR] Failed to install app dependencies."
        goto :fail
    )
)
call :log ""

call :log "[2/5] Verifying Electron build tools..."
if not exist "node_modules\.bin\electron-builder.cmd" goto :repair_electron_tools
if not exist "node_modules\electron\dist\electron.exe" goto :repair_electron_tools
call :log "[OK] Electron build tools already installed."
goto :electron_tools_ready

:repair_electron_tools
call :log "[WARNING] Electron build tools are incomplete. Repairing dependencies automatically..."
call :log "[INFO] Repair is limited to Electron packages so we do not re-run a full install when only desktop build tools are missing."
call :run "Repairing Electron dependencies with npm install" "npm install electron@41.2.2 electron-builder@26.8.1 electron-squirrel-startup@1.0.1 electron-updater@6.8.3 --package-lock=false --no-save --no-audit --no-fund --loglevel=error"
if errorlevel 1 (
    call :log "[ERROR] Failed while repairing Electron dependencies."
    goto :fail
)
if not exist "node_modules\.bin\electron-builder.cmd" (
    call :log "[ERROR] electron-builder is still missing after repair."
    goto :fail
)
if not exist "node_modules\electron\dist\electron.exe" (
    call :log "[ERROR] Electron runtime is still missing after repair."
    goto :fail
)
call :log "[OK] Electron build tools repaired successfully."

:electron_tools_ready
call :log ""

call :run "[3/5] Building web application" "npm run build"
if errorlevel 1 (
    call :log "[ERROR] Failed to build web app."
    goto :fail
)
call :log ""

call :run "[4/5] Building Windows installer" "npx electron-builder --win"
if errorlevel 1 (
    call :log "[ERROR] Failed to build installer."
    goto :fail
)
call :log ""

call :log "========================================"
call :log "   BUILD COMPLETE!"
call :log "========================================"
call :log ""
call :log "Your installers are in the release folder:"
dir /b release\*.exe 2>nul
dir /b release\*.exe >> "%LOG_FILE%" 2>&1
call :log ""

start "" "release"
pause
exit /b 0

:run
set "STEP_LABEL=%~1"
set "STEP_COMMAND=%~2"
call :log "%STEP_LABEL%"
>> "%LOG_FILE%" echo.
>> "%LOG_FILE%" echo ==== %DATE% %TIME% - %STEP_LABEL% ====
cmd /d /s /c "%STEP_COMMAND%" >> "%LOG_FILE%" 2>&1
exit /b %errorlevel%

:log
if "%~1"=="" (
    echo(
    >> "%LOG_FILE%" echo(
) else (
    echo %~1
    >> "%LOG_FILE%" echo %~1
)
exit /b 0

:fail
call :log "[INFO] Build stopped. Read build-installer.log for the exact error."
pause
exit /b 1
