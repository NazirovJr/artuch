@echo off
set ANDROID_HOME=D:\SDK
set ANDROID_SDK_ROOT=D:\SDK
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%;D:\SDK\platform-tools

cd /d D:\job\artuch\staff-app\android
echo Java version:
java -version

echo Building debug APK...
call gradlew.bat assembleDebug --no-daemon --info 2>&1
echo BUILD_DONE=%ERRORLEVEL%
