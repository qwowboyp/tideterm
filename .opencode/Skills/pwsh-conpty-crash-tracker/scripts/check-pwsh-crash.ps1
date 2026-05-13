# check-pwsh-crash.ps1
# TideTerm pwsh/ConPTY crash diagnostic script
# Checks: pwsh version, Windows Event Log for crash signature, ConPTY pipe errors

param(
    [int]$MinutesBack = 60
)

$ErrorActionPreference = "Continue"
$found = $false

Write-Host "=== TideTerm pwsh/ConPTY Crash Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# Check pwsh version
Write-Host "--- PowerShell Version ---" -ForegroundColor Yellow
try {
    $pwshPath = Get-Command pwsh.exe -ErrorAction Stop
    $pwshVersion = & pwsh.exe -NoProfile -Command '$PSVersionTable.PSVersion.ToString()'
    Write-Host "pwsh path: $($pwshPath.Source)"
    Write-Host "pwsh version: $pwshVersion"
    $ver = [Version]$pwshVersion
    if ($ver.Major -ge 7 -and $ver.Minor -ge 2) {
        Write-Host "STATUS: AFFECTED (pwsh 7.2+ is known to have this ConPTY crash)" -ForegroundColor Red
        $found = $true
    } else {
        Write-Host "STATUS: Lower risk (pwsh < 7.2)" -ForegroundColor Green
    }
} catch {
    Write-Host "pwsh.exe not found in PATH"
}

# Check PowerShell 5.1
try {
    $ps51Path = Get-Command powershell.exe -ErrorAction Stop
    $ps51Version = & powershell.exe -NoProfile -Command '$PSVersionTable.PSVersion.ToString()'
    Write-Host "powershell.exe path: $($ps51Path.Source)"
    Write-Host "powershell.exe version: $ps51Version"
    if ($ps51Version -match '^5\.') {
        Write-Host "STATUS: Windows PowerShell 5.1 is NOT affected by this crash" -ForegroundColor Green
    }
} catch {
    Write-Host "powershell.exe not found"
}

Write-Host ""

# Check Windows Event Log for crash signature
Write-Host "--- Windows Event Log (last $MinutesBack minutes) ---" -ForegroundColor Yellow

$crashes = Get-WinEvent -FilterHashtable @{
    LogName = 'Application'
    StartTime = (Get-Date).AddMinutes(-$MinutesBack)
} -ErrorAction SilentlyContinue | Where-Object {
    $_.Message -match '0x80131623|GetConsoleScreenBufferInfo|FailFast.*pwsh|0xE9.*console.*buffer'
}

if ($crashes) {
    $found = $true
    foreach ($crash in $crashes) {
        Write-Host ""
        Write-Host "Time: $($crash.TimeCreated)" -ForegroundColor Red
        Write-Host "Provider: $($crash.ProviderName)"
        Write-Host "Event ID: $($crash.Id)"

        # Extract key lines from the verbose message
        $msg = $crash.Message
        if ($msg -match 'Description: The process was terminated due to an unhandled exception\.(.+?)\n') {
            Write-Host "Exception: $($matches[1])" -ForegroundColor Red
        }
        if ($msg -match 'at Microsoft\.PowerShell\.ConsoleControl\.GetConsoleScreenBufferInfo') {
            Write-Host "SIGNATURE: GetConsoleScreenBufferInfo crash (ConPTY pipe closed)" -ForegroundColor Magenta
        }
        if ($msg -match '0x80131623') {
            Write-Host "CODE: 0x80131623 (COR_E_EXECUTIONENGINE / FailFast)" -ForegroundColor Red
        }
        if ($msg -match '0xE9') {
            Write-Host "CAUSE: Win32 0xE9 = ERROR_PIPE_NOT_CONNECTED (ConPTY pipe broken)" -ForegroundColor Red
        }
        if ($msg -match 'pwsh.exe') {
            Write-Host "APPLICATION: pwsh.exe" -ForegroundColor Yellow
        }
        Write-Host "---"
    }
} else {
    Write-Host "No recent pwsh/ConPTY crash events found in Application log." -ForegroundColor Green
}

Write-Host ""

# Check for tideTerm integration log if present
if (Test-Path "$env:TEMP\tideterm-pwsh-integration.log") {
    Write-Host "--- TideTerm pwsh Integration Log ---" -ForegroundColor Yellow
    Get-Content "$env:TEMP\tideterm-pwsh-integration.log" -Tail 20
} else {
    Write-Host "TideTerm pwsh integration log not found at %TEMP%\tideterm-pwsh-integration.log" -ForegroundColor Gray
}

Write-Host ""
if (-not $found) {
    Write-Host "=== No crash signature detected ===" -ForegroundColor Green
    Write-Host "If you're still experiencing issues, check wavesrv output log for:" -ForegroundColor Gray
    Write-Host "  [shellproc] pty-read loop received EOF ... waitDone=false" -ForegroundColor Gray
    Write-Host "  [shellproc] shell wait returned ... exit status 0x80131623" -ForegroundColor Gray
} else {
    Write-Host "=== Crash signature DETECTED ===" -ForegroundColor Red
    Write-Host "This is a known upstream PowerShell 7.x ConPTY bug." -ForegroundColor Yellow
    Write-Host "Workaround: use Windows PowerShell 5.1 or downgrade pwsh." -ForegroundColor Yellow
    Write-Host "See .opencode/Skills/pwsh-conpty-crash-tracker/references/known-issues.md for details." -ForegroundColor Yellow
}
