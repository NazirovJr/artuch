$env:ANDROID_HOME = "D:\SDK"
$env:ANDROID_SDK_ROOT = "D:\SDK"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-24"
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
$env:PATH = "D:\SDK\platform-tools;" + $env:PATH
$env:PATH = "D:\SDK\emulator;" + $env:PATH

Set-Location "D:\job\artuch\staff-app"
Write-Host "Node: $(node --version)"
Write-Host "ADB: $(& 'D:\SDK\platform-tools\adb.exe' devices)"

npx expo run:android 2>&1
