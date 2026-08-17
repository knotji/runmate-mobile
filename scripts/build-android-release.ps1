param(
  [ValidateSet('apk', 'aab', 'both')]
  [string]$Artifact = 'both'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  # Retries a few times before failing the whole release: vitest has an occasional,
  # unrelated flake ("ReferenceError: window is not defined") from a test file's
  # environment tearing down while a leaked async task from elsewhere in that run is
  # still settling. It doesn't reproduce reliably (confirmed clean on immediate
  # reruns), so a single occurrence here should not block a release on its own -
  # a real, persistent test failure will still fail every attempt and correctly abort.
  $testAttempts = 0
  $testMaxAttempts = 3
  do {
    $testAttempts++
    & npm.cmd run test.unit -- --run
    $testsPassed = ($LASTEXITCODE -eq 0)
    if (-not $testsPassed -and $testAttempts -lt $testMaxAttempts) {
      Write-Host "Unit tests failed on attempt $testAttempts of $testMaxAttempts - retrying in case this is a flaky test-teardown timing issue."
    }
  } while (-not $testsPassed -and $testAttempts -lt $testMaxAttempts)
  if (-not $testsPassed) { throw "Unit tests failed after $testMaxAttempts attempts." }
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
    # WRITE_NUTRITION is RunMate's one deliberate, opt-in exception to an otherwise
    # read-only Health Connect integration (see android/app/src/main/AndroidManifest.xml
    # and src/components/health/NutritionSyncSettings.tsx). Any other WRITE_* permission
    # still fails this gate.
    $allowedWritePermissions = @('android.permission.health.WRITE_NUTRITION')
    $writePermissionMatches = Select-String -LiteralPath $mergedManifest -Pattern 'android\.permission\.health\.WRITE_[A-Z_]+'
    $foundWritePermissions = @($writePermissionMatches | ForEach-Object { $_.Matches.Value } | Sort-Object -Unique)
    $unexpectedWritePermissions = @($foundWritePermissions | Where-Object { $allowedWritePermissions -notcontains $_ })
    if ($unexpectedWritePermissions.Count -gt 0) {
      throw "Release APK is not Health Connect read-only. Found unexpected write permission(s): $($unexpectedWritePermissions -join ', ')"
    }
    if ($foundWritePermissions -contains 'android.permission.health.WRITE_NUTRITION') {
      Write-Host 'Health Connect permission check: read-only except the documented WRITE_NUTRITION opt-in (Share Logged Nutrition toggle).'
    } else {
      Write-Host 'Health Connect permission check: read-only'
    }
  } finally { Pop-Location }

  if ($Artifact -in @('apk', 'both')) { Write-Host 'APK: android/app/build/outputs/apk/release/app-release.apk' }
  if ($Artifact -in @('aab', 'both')) { Write-Host 'AAB: android/app/build/outputs/bundle/release/app-release.aab' }
} finally { Pop-Location }
