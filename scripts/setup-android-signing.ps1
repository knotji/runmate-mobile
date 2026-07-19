param(
  [switch]$GenerateSecurePassword
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $repoRoot 'android'
$keystorePath = Join-Path $androidRoot 'app\runmate-release.jks'
$propertiesPath = Join-Path $androidRoot 'keystore.properties'
$alias = 'runmate-release'

if ((Test-Path -LiteralPath $keystorePath) -or (Test-Path -LiteralPath $propertiesPath)) {
  throw 'Signing files already exist. Back them up instead of regenerating the production key.'
}

if ($GenerateSecurePassword) {
  $bytes = New-Object byte[] 32
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  $password = [Convert]::ToBase64String($bytes).Replace('+', 'A').Replace('/', 'B').TrimEnd('=')
} else {
  $securePassword = Read-Host 'Create the RunMate release-key password' -AsSecureString
  $confirmPassword = Read-Host 'Confirm the password' -AsSecureString
  $password = [Net.NetworkCredential]::new('', $securePassword).Password
  $confirmation = [Net.NetworkCredential]::new('', $confirmPassword).Password
  if ([string]::IsNullOrWhiteSpace($password) -or $password -ne $confirmation) { throw 'Passwords do not match.' }
}

$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
if (-not (Test-Path -LiteralPath $keytool)) { $keytool = 'keytool.exe' }

& $keytool -genkeypair -v -keystore $keystorePath -alias $alias -keyalg RSA -keysize 4096 -validity 10000 -storepass $password -keypass $password -dname 'CN=RunMate, O=RunMate, C=TH'
if ($LASTEXITCODE -ne 0) { throw "keytool failed with exit code $LASTEXITCODE" }

$lines = @(
  'storeFile=app/runmate-release.jks'
  "storePassword=$password"
  "keyAlias=$alias"
  "keyPassword=$password"
)
[IO.File]::WriteAllLines($propertiesPath, $lines, [Text.UTF8Encoding]::new($false))
Write-Host 'Release signing created. Back up android/app/runmate-release.jks and android/keystore.properties securely.'
