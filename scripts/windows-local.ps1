param([ValidateSet('Setup','Start')][string]$Mode = 'Start', [switch]$PrivateRuntime)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.runtime'
function Test-NodeRuntime([string]$Executable) {
    if (-not $Executable) { return $false }
    try {
        $versionText = & $Executable -p 'process.versions.node' 2>$null
        return $LASTEXITCODE -eq 0 -and [version]$versionText -ge [version]'22.12.0'
    } catch { return $false }
}
try {
    $nodePath = Join-Path $runtimeRoot 'node\node.exe'
    if (-not (Test-NodeRuntime $nodePath) -or -not (Test-Path (Join-Path (Split-Path $nodePath) 'npm.cmd'))) {
        $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $PrivateRuntime -and $systemNode -and (Test-NodeRuntime $systemNode.Source) -and (Test-Path (Join-Path (Split-Path $systemNode.Source) 'npm.cmd'))) {
            $nodePath = $systemNode.Source
        } else {
            Write-Host 'AINA: installing a private Node.js + npm runtime (first setup only)...'
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
            $releases = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
            $release = $releases | Where-Object { $_.lts -and $_.version -match '^v24\.' -and $_.files -contains "win-$architecture-zip" } | Select-Object -First 1
            if (-not $release) { throw 'Could not find the official Node.js 24 LTS Windows download.' }
            $archiveName = "node-$($release.version)-win-$architecture.zip"
            $downloadRoot = Join-Path $runtimeRoot $release.version
            New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null
            $archivePath = Join-Path $downloadRoot $archiveName
            $baseURL = "https://nodejs.org/dist/$($release.version)"
            $checksums = (Invoke-WebRequest "$baseURL/SHASUMS256.txt" -UseBasicParsing).Content
            $checksumLine = ($checksums -split "`n" | Where-Object { $_.TrimEnd().EndsWith(" $archiveName") } | Select-Object -First 1)
            if (-not $checksumLine) { throw 'Official Node.js checksum was not found.' }
            $expected = ($checksumLine.Trim() -split '\s+')[0]
            Invoke-WebRequest "$baseURL/$archiveName" -OutFile $archivePath -UseBasicParsing
            if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expected) { throw 'Node.js download failed SHA256 verification. Run SETUP.cmd again.' }
            Expand-Archive -LiteralPath $archivePath -DestinationPath $downloadRoot -Force
            $nodeFolder = Join-Path $downloadRoot "node-$($release.version)-win-$architecture"
            New-Item -ItemType Directory -Force -Path (Join-Path $runtimeRoot 'node') | Out-Null
            Copy-Item -Path (Join-Path $nodeFolder '*') -Destination (Join-Path $runtimeRoot 'node') -Recurse -Force
            $nodePath = Join-Path $runtimeRoot 'node\node.exe'
        }
    }
    $env:PATH = (Split-Path $nodePath) + ';' + $env:PATH
    Set-Location -LiteralPath $projectRoot
    $entry = if ($Mode -eq 'Setup') { 'aina-web\tools\setup.mjs' } else { 'aina-web\tools\local.mjs' }
    if ($Mode -eq 'Start') { & $nodePath (Join-Path $projectRoot $entry) --open } else { & $nodePath (Join-Path $projectRoot $entry) }
    exit $LASTEXITCODE
} catch {
    Write-Host "AINA ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
