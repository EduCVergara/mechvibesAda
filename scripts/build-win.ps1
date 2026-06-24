$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_local-node.ps1"

Use-LocalNode
Show-LocalNodeVersion

if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
    throw "node_modules was not found. Run .\scripts\setup.ps1 first."
}

Push-Location $ProjectRoot
try {
    & $NpmCmd run build:win
}
finally {
    Pop-Location
}
