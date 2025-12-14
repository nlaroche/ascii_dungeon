@echo off
setlocal enabledelayedexpansion

echo ========================================
echo ASCII Dungeon - Build and Run
echo ========================================
echo.

:: Check for Vulkan SDK
if "%VULKAN_SDK%"=="" (
    echo ERROR: VULKAN_SDK environment variable not set
    echo Please install Vulkan SDK from https://vulkan.lunarg.com
    pause
    exit /b 1
)

echo Vulkan SDK: %VULKAN_SDK%
echo.

:: Create build directory
if not exist "build" mkdir build
cd build

:: Configure with CMake
echo [1/3] Configuring CMake...
cmake .. -G "Visual Studio 17 2022" -A x64
if errorlevel 1 (
    echo CMake configuration failed!
    cd ..
    pause
    exit /b 1
)

:: Build
echo.
echo [2/3] Building...
cmake --build . --config Debug
if errorlevel 1 (
    echo Build failed!
    cd ..
    pause
    exit /b 1
)

:: Run
echo.
echo [3/3] Running...
echo ========================================
cd Debug
ascii_dungeon.exe 2>&1
set EXIT_CODE=!errorlevel!
cd ..\..

echo.
echo ========================================
echo Program exited with code: %EXIT_CODE%
pause
