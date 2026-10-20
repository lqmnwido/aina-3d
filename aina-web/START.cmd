@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-local.ps1" -Mode Start
if errorlevel 1 (
  echo AINA could not start. See the error above.
  pause
  exit /b 1
)
