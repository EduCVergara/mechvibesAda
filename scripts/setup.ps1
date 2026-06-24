$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_local-node.ps1"

$NodeZip = Join-Path $ToolsDir "$NodeDirName.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeDirName.zip"

New-Item -ItemType Directory -Force $ToolsDir | Out-Null
New-Item -ItemType Directory -Force $NpmCache | Out-Null

if (-not (Test-Path $NodeExe)) {
    Write-Host "Downloading Node $NodeVersion portable..."
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip

    Write-Host "Extracting Node into .tools..."
    Expand-Archive -Path $NodeZip -DestinationPath $ToolsDir -Force
    Remove-Item -LiteralPath $NodeZip -Force
}

Use-LocalNode
Show-LocalNodeVersion

Push-Location $ProjectRoot
try {
    Write-Host "Installing project dependencies with local Node..."
    & $NpmCmd ci
}
finally {
    Pop-Location
}
