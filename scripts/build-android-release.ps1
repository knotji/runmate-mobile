param(
  [ValidateSet('apk', 'aab', 'both')]
  [string]$Artifact = 'both'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  & npm.cmd run test.unit -- --run
  if ($LASTEXITCODE -ne 0) { throw 'Unit tests failed.' }
  & npm.cmd run lint
  if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }

  Push-Location (Join-Path $repoRoot 'android')
  try {
    if ($Artifact -in @('apk', 'both')) {
      & .\gradlew.bat assembleRelease
      if ($LASTEXITCODE -ne 0) { throw 'Release APK build failed.' }
    }
    if ($Artifact -in @('aab', 'both')) {
      & .\gradlew.bat bundleRelease
      if ($LASTEXITCODE -ne 0) { throw 'Release AAB build failed.' }
    }

    $mergedManifest = Join-Path $repoRoot 'android\app\build\intermediates\merged_manifest\release\processReleaseMainManifest\AndroidManifest.xml'
    if (-not (Test-Path -LiteralPath $mergedManifest)) { throw 'Merged release manifest was not generated.' }
    $writePermissions = Select-String -LiteralPath $mergedManifest -Pattern 'android\.permission\.health\.WRITE_'
    if ($writePermissions) {
      $names = ($writePermissions | ForEach-Object { $_.Matches.Value } | Sort-Object -Unique) -join ', '
      throw "Release APK is not Health Connect read-only. Found: $names"
    }
    Write-Host 'Health Connect permission check: read-only'
  } finally { Pop-Location }

  if ($Artifact -in @('apk', 'both')) { Write-Host 'APK: android/app/build/outputs/apk/release/app-release.apk' }
  if ($Artifact -in @('aab', 'both')) { Write-Host 'AAB: android/app/build/outputs/bundle/release/app-release.aab' }
} finally { Pop-Location }
