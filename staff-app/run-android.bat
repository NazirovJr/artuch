@echo off
chcp 65001 >nul
title Artuch Staff - Android Build
echo ============================================
echo   Artuch Staff App - Build and Run
echo ============================================
echo.

set ANDROID_HOME=D:\SDK
set ANDROID_SDK_ROOT=D:\SDK
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%PATH%"

echo [1/7] Checking prerequisites...
java -version 2>nul >nul
if errorlevel 1 (echo ERROR: java not found && pause && exit /b 1)
adb version 2>nul >nul
if errorlevel 1 (echo ERROR: adb not found && pause && exit /b 1)
echo    OK - java, adb found
echo.

echo [2/7] Checking emulator...
adb start-server 2>nul
adb devices > "%TEMP%\adb_dev.txt" 2>nul
findstr /C:"emulator" "%TEMP%\adb_dev.txt" >nul 2>nul
if errorlevel 1 goto START_EMU
echo    Emulator already running
goto EMU_DONE

:START_EMU
echo    Starting emulator Medium_Phone_API_36.1...
start "" "%ANDROID_HOME%\emulator\emulator.exe" -avd Medium_Phone_API_36.1 -no-snapshot-load -gpu auto
echo    Waiting for device...
adb wait-for-device
echo    Waiting for boot...

:WAIT_BOOT
timeout /t 3 /nobreak >nul
for /f %%a in ('adb shell getprop sys.boot_completed 2^>nul') do set BOOTVAL=%%a
if not "%BOOTVAL%"=="1" goto WAIT_BOOT
echo    Emulator booted!

:EMU_DONE
echo.

echo [3/7] Starting Metro bundler...
start "Metro Bundler" cmd /c "cd /d D:\job\artuch\staff-app && npx expo start --port 8081"
timeout /t 5 /nobreak >nul
echo    Metro started in separate window
echo.

echo [4/7] Building debug APK...
cd /d D:\job\artuch\staff-app\android
call gradlew.bat assembleDebug --no-daemon
if errorlevel 1 (echo ERROR: Gradle build failed! && pause && exit /b 1)
echo    Build successful!
echo.

echo [5/7] Installing APK...
adb install -r D:\job\artuch\staff-app\android\app\build\outputs\apk\debug\app-debug.apk
if errorlevel 1 (echo ERROR: APK install failed! && pause && exit /b 1)
echo    APK installed!
echo.

echo [6/7] Launching app...
adb shell am start -n com.artuch.staff/.MainActivity
echo.

echo [7/7] Done!
echo ============================================
echo   App is running on the emulator.
echo   Metro bundler is in the other window.
echo ============================================
pause