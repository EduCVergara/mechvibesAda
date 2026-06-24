$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DevEntryName = "$(Split-Path -Leaf $ProjectRoot).Dev"
$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

if (-not (Test-Path $RunKey)) {
    Write-Host "Windows startup registry key was not found: $RunKey"
    exit 0
}

$properties = (Get-ItemProperty -Path $RunKey).PSObject.Properties
$entries = $properties |
    Where-Object {
        $_.MemberType -eq "NoteProperty" -and
        $_.Name -notlike "PS*" -and
        (
            "$($_.Value)".Contains($ProjectRoot) -or
            $_.Name -eq $DevEntryName -or
            $_.Name -eq "electron.app.Mechvibes" -or
            "$($_.Value)" -match "\\Mechvibes\.exe(\s|$)"
        )
    } |
    ForEach-Object {
        $type = if ($_.Name -eq $DevEntryName) {
            "Project dev entry"
        } elseif ($_.Name -eq "electron.app.Electron" -and "$($_.Value)".Contains($ProjectRoot)) {
            "Legacy dev entry"
        } elseif ("$($_.Value)".Contains($ProjectRoot)) {
            "Project dev entry"
        } elseif ("$($_.Value)" -match "\\Mechvibes\.exe(\s|$)") {
            "Installed app entry"
        } else {
            "Related entry"
        }

        [PSCustomObject]@{
            Name = $_.Name
            Type = $type
            Command = $_.Value
        }
    }

if (-not $entries) {
    Write-Host "No Mechvibes startup entry was found."
    Write-Host "Open the app, enable 'Start with Windows', then run this script again."
    exit 0
}

Write-Host "Found startup entry:"
$entries | Format-List
