param([switch]$Hybrid)
$ErrorActionPreference = 'Stop'
$ainaProject = Split-Path $PSScriptRoot -Parent
$ainaPython = Join-Path $PSScriptRoot '.venv-tts/Scripts/python.exe'
$ainaLogs = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $ainaLogs | Out-Null
$ainaListener = Get-NetTCPConnection -LocalPort 8766 -State Listen
$ainaWorker = Get-CimInstance Win32_Process -Filter "ProcessId = $($ainaListener.OwningProcess)"
if ($ainaWorker.CommandLine -notmatch 'local-speech[/\\]tts_server\.py') {
    throw 'Port 8766 is not the expected AINA TTS worker; no process was stopped.'
}
$ainaParent = Get-CimInstance Win32_Process -Filter "ProcessId = $($ainaWorker.ParentProcessId)"
try {
    Stop-Process -Id $ainaWorker.ProcessId -Force
    if ($ainaParent -and $ainaParent.CommandLine -match '\.venv-tts[/\\]Scripts[/\\]python\.exe.*local-speech[/\\]tts_server\.py') {
        Stop-Process -Id $ainaParent.ProcessId -Force -ErrorAction SilentlyContinue
    }
    if ($Hybrid) {
        & $ainaPython -u (Join-Path $PSScriptRoot 'preview_dialogue4.py') --hybrid
    } else {
        & $ainaPython -u (Join-Path $PSScriptRoot 'preview_dialogue4.py')
    }
    if ($LASTEXITCODE -ne 0) { throw 'Voice preview failed; restoring the original TTS service.' }
} finally {
    $ainaExisting = Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue
    if (-not $ainaExisting) {
        $ainaRestored = Start-Process -FilePath $ainaPython -ArgumentList @('-u','local-speech/tts_server.py') -WorkingDirectory $ainaProject -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $ainaLogs 'tts-restored.stdout.log') -RedirectStandardError (Join-Path $ainaLogs 'tts-restored.stderr.log')
        Write-Output "Original TTS worker restarted: $($ainaRestored.Id)"
    }
}
