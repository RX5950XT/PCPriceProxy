[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

function Get-ConfiguredPort {
    if ($env:PORT) {
        return [int]$env:PORT
    }

    $envPath = Join-Path $ProjectRoot '.env'
    if (Test-Path -LiteralPath $envPath) {
        $portLine = Get-Content -LiteralPath $envPath |
            Where-Object { $_ -match '^\s*PORT\s*=\s*\d+\s*$' } |
            Select-Object -First 1

        if ($portLine -and $portLine -match '(\d+)') {
            return [int]$Matches[1]
        }
    }

    return 3000
}

function Test-HealthEndpoint {
    param([Parameter(Mandatory = $true)][string]$HealthUrl)

    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Get-RequiredCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$InstallHint
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$Name was not found. $InstallHint"
    }

    return $command.Source
}

function Test-DependenciesNeedInstall {
    $nodeModulesPath = Join-Path $ProjectRoot 'node_modules'
    $installedLockPath = Join-Path $nodeModulesPath '.package-lock.json'
    $packageLockPath = Join-Path $ProjectRoot 'package-lock.json'
    $packageJsonPath = Join-Path $ProjectRoot 'package.json'

    if (-not (Test-Path -LiteralPath $nodeModulesPath) -or
        -not (Test-Path -LiteralPath $installedLockPath)) {
        return $true
    }

    $installedAt = (Get-Item -LiteralPath $installedLockPath).LastWriteTimeUtc
    return (Get-Item -LiteralPath $packageLockPath).LastWriteTimeUtc -gt $installedAt -or
        (Get-Item -LiteralPath $packageJsonPath).LastWriteTimeUtc -gt $installedAt
}

function Install-DependenciesIfNeeded {
    param(
        [Parameter(Mandatory = $true)][string]$NpmCommand,
        [switch]$PreviewOnly
    )

    if (-not (Test-DependenciesNeedInstall)) {
        Write-Host '[OK] Dependencies are up to date.' -ForegroundColor Green
        return
    }

    if ($PreviewOnly) {
        Write-Host '[INFO] Dependencies need npm install.' -ForegroundColor Yellow
        return
    }

    Write-Host '[INFO] Installing dependencies...' -ForegroundColor Cyan
    & $NpmCommand install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE."
    }
}

function Start-BrowserWhenReady {
    param(
        [Parameter(Mandatory = $true)][string]$HealthUrl,
        [Parameter(Mandatory = $true)][string]$DashboardUrl
    )

    Write-Host "[INFO] The browser will open when $HealthUrl is ready." -ForegroundColor Cyan
    return Start-Job -ScriptBlock {
        param($JobHealthUrl, $JobDashboardUrl)

        for ($attempt = 0; $attempt -lt 120; $attempt++) {
            try {
                $response = Invoke-WebRequest -Uri $JobHealthUrl -UseBasicParsing -TimeoutSec 2
                if ($response.StatusCode -eq 200) {
                    Start-Process $JobDashboardUrl
                    return
                }
            }
            catch {
                # The server is still starting.
            }

            Start-Sleep -Seconds 1
        }
    } -ArgumentList $HealthUrl, $DashboardUrl
}

$browserJob = $null

try {
    $port = Get-ConfiguredPort
    if ($port -lt 1 -or $port -gt 65535) {
        throw "PORT must be between 1 and 65535; received $port."
    }

    $dashboardUrl = "http://localhost:$port"
    $healthUrl = "$dashboardUrl/api/v1/health"

    if (-not $CheckOnly -and (Test-HealthEndpoint -HealthUrl $healthUrl)) {
        Write-Host "[OK] PCPriceProxy is already running at $dashboardUrl" -ForegroundColor Green
        if (-not $NoBrowser) {
            Start-Process $dashboardUrl
        }
        exit 0
    }

    $nodeCommand = Get-RequiredCommand -Name 'node.exe' -InstallHint 'Install Node.js 20 or newer first.'
    $npmCommand = Get-RequiredCommand -Name 'npm.cmd' -InstallHint 'Reinstall Node.js with npm enabled.'
    Write-Host "[OK] Node.js $(& $nodeCommand --version)" -ForegroundColor Green
    Write-Host "[OK] npm $(& $npmCommand --version)" -ForegroundColor Green

    Install-DependenciesIfNeeded -NpmCommand $npmCommand -PreviewOnly:$CheckOnly

    if ($CheckOnly) {
        Write-Host '[OK] Quick-start check completed.' -ForegroundColor Green
        exit 0
    }

    if (-not $NoBrowser) {
        $browserJob = Start-BrowserWhenReady -HealthUrl $healthUrl -DashboardUrl $dashboardUrl
    }

    Write-Host "[INFO] Starting PCPriceProxy at $dashboardUrl" -ForegroundColor Cyan
    Write-Host '[INFO] Press Ctrl+C to stop the server.' -ForegroundColor DarkGray
    $npmArguments = @('run', 'dev')
    & $npmCommand $npmArguments

    if ($LASTEXITCODE -ne 0) {
        throw "npm run dev failed with exit code $LASTEXITCODE."
    }
}
catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if ($null -ne $browserJob) {
        Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
        Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }
}
