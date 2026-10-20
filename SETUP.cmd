@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-local.ps1" -Mode Setup
if errorlevel 1 (
  echo Setup failed. See the error above.
  pause
  exit /b 1
)
echo Setup complete. Double-click START.cmd to open AINA.
pause
