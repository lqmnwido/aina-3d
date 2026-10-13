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
Stop-Process -Id $ainaWorker.ProcessId -Force
if ($ainaParent -and $ainaParent.CommandLine -match '\.venv-tts[/\\]Scripts[/\\]python\.exe.*local-speech[/\\]tts_server\.py') {
    Stop-Process -Id $ainaParent.ProcessId -Force -ErrorAction SilentlyContinue
}
$ainaRestored = Start-Process -FilePath $ainaPython -ArgumentList @('-u','local-speech/tts_server.py') -WorkingDirectory $ainaProject -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $ainaLogs 'tts-active.stdout.log') -RedirectStandardError (Join-Path $ainaLogs 'tts-active.stderr.log')
Write-Output "TTS worker restarted: $($ainaRestored.Id)"
