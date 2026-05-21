$env:ANDROID_HOME = "D:\SDK"
$env:ANDROID_SDK_ROOT = "D:\SDK"
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
$env:PATH = $env:JAVA_HOME + "\bin;" + $env:PATH + ";D:\SDK\platform-tools"

Set-Location "D:\job\artuch\staff-app\android"
Write-Host "Java: $(java -version 2>&1 | Select-Object -First 1)"
Write-Host "Building debug APK..."
& ".\gradlew.bat" assembleDebug --no-daemon 2>&1
