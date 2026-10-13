$ErrorActionPreference='Stop'
$ainaProject=Split-Path $PSScriptRoot -Parent
$ainaListener=Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -First 1
$ainaWebWorker=Get-CimInstance Win32_Process -Filter "ProcessId = $($ainaListener.OwningProcess)"
if($ainaWebWorker.CommandLine -notmatch 'node\.exe.*server[/\\]index\.js'){
    throw 'Port 5173 is not the expected AINA web worker; nothing was stopped.'
}
$ainaNode=$ainaWebWorker.ExecutablePath
Stop-Process -Id $ainaWebWorker.ProcessId -Force
$ainaWebArgs=@('server/index.js')
if(Test-Path -LiteralPath (Join-Path $ainaProject 'cloudflare/config.yml')){$ainaWebArgs+='--production'}
$ainaWeb=Start-Process -FilePath $ainaNode -ArgumentList $ainaWebArgs -WorkingDirectory $ainaProject -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $PSScriptRoot 'logs/web-latency.stdout.log') -RedirectStandardError (Join-Path $PSScriptRoot 'logs/web-latency.stderr.log')
Write-Output "AINA web restarted: $($ainaWeb.Id)"
