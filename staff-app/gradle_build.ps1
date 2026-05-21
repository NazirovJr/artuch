$env:ANDROID_HOME = "D:\SDK"
$env:ANDROID_SDK_ROOT = "D:\SDK"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-24"
$env:PATH = "C:\Program Files\Java\jdk-24\bin;" + $env:PATH

Set-Location "D:\job\artuch\staff-app\android"
Write-Host "Java: $(java -version 2>&1 | Select-Object -First 1)"
Write-Host "Building debug APK..."

& "D:\job\artuch\staff-app\android\gradlew.bat" assembleDebug 2>&1
