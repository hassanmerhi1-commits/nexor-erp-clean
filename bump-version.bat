@echo off
title Kwanza ERP - Bump Version and Push Tag
color 0E

echo.
echo ========================================
echo    KWANZA ERP - BUMP VERSION
echo ========================================
echo.

:: Get current version from package.json
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" package.json') do set CURRENT=%%~a
echo Current version: %CURRENT%

:: Ask for new version
set /p NEW_VERSION=Enter new version (e.g. 1.0.45): 

:: Update package.json
powershell -Command "(Get-Content package.json) -replace '\"version\": \".*\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.json"

echo.
echo [OK] Version updated to %NEW_VERSION%
echo [INFO] Committing and pushing tag...

git add package.json
git commit -m "Bump version to %NEW_VERSION%"
git tag v%NEW_VERSION%
git push origin main
git push origin v%NEW_VERSION%

echo.
echo ========================================
echo    TAG v%NEW_VERSION% PUSHED!
echo    GitHub Actions will build automatically.
echo ========================================
echo.
pause
