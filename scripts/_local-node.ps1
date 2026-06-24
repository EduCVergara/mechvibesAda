$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$NodeVersion = "14.21.3"
$NodeDirName = "node-v$NodeVersion-win-x64"
$ToolsDir = Join-Path $ProjectRoot ".tools"
$NodeDir = Join-Path $ToolsDir $NodeDirName
$NodeExe = Join-Path $NodeDir "node.exe"
$NpmCmd = Join-Path $NodeDir "npm.cmd"
$NpmCache = Join-Path $ProjectRoot ".npm-cache"

function Use-LocalNode {
    if (-not (Test-Path $NodeExe)) {
        throw "Node $NodeVersion portable is not installed. Run .\scripts\setup.ps1 first."
    }

    $env:PATH = "$NodeDir;$env:PATH"
    $env:npm_config_cache = $NpmCache
    $env:npm_config_fund = "false"
    $env:npm_config_audit = "false"
}

function Show-LocalNodeVersion {
    Write-Host "Project: $ProjectRoot"
    Write-Host "Node:    $(& $NodeExe -v)"
    Write-Host "npm:     $(& $NpmCmd -v)"
    Write-Host "Cache:   $NpmCache"
}
