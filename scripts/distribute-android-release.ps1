param(
  [string]$ReleaseNotes = 'RunMate signed release build.',
  [string]$Testers = 'jirayuknot55@gmail.com'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$apkPath = Join-Path $repoRoot 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $apkPath)) { throw 'Signed release APK not found. Run: npm run android:release:apk' }

Push-Location $repoRoot
try {
  & npx.cmd firebase-tools appdistribution:distribute $apkPath --app '1:276482893444:android:5643c0971817db76a584d1' --testers $Testers --release-notes $ReleaseNotes
  if ($LASTEXITCODE -ne 0) { throw 'Firebase App Distribution failed.' }
} finally { Pop-Location }
