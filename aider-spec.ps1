<#
.SYNOPSIS
    Launches Aider to implement a spec from the docs/ folder.
    Pass the spec name (without path or extension) to select which one.

.EXAMPLE
    .\aider-spec.ps1 combat-system
    .\aider-spec.ps1 inventory -Message "Focus on the stacking logic only"
    .\aider-spec.ps1                   # Lists available specs
#>

param(
    [string]$Spec = "",
    [string]$Message = ""
)

$env:PYTHONUTF8 = "1"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$docsDir = Join-Path $ProjectRoot "docs"

# --- No spec provided: list available specs and exit ---
if (-not $Spec) {
    Write-Host "Available specs in docs/:"
    Write-Host ""
    $specFiles = Get-ChildItem -Path $docsDir -Filter "*.md" | Where-Object { $_.Name -ne "_TEMPLATE.md" }
    if ($specFiles.Count -eq 0) {
        Write-Host "  (none found)"
        Write-Host ""
        Write-Host "Create a new spec:"
        Write-Host "  Copy docs\_TEMPLATE.md -> docs\my-feature.md"
        Write-Host "  Then run: .\aider-spec.ps1 my-feature"
    } else {
        foreach ($f in $specFiles) {
            $name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            $firstLine = (Get-Content $f.FullName -TotalCount 1) -replace '^#\s*', ''
            Write-Host "  $name"
            Write-Host "    $firstLine"
            Write-Host ""
        }
        Write-Host "Usage: .\aider-spec.ps1 <spec-name>"
    }
    exit 0
}

# --- Resolve spec file ---
$specFile = Join-Path $docsDir "$Spec.md"
if (-not (Test-Path $specFile)) {
    Write-Host "[ERROR] Spec not found: $specFile"
    Write-Host ""
    Write-Host "Available specs:"
    Get-ChildItem -Path $docsDir -Filter "*.md" | Where-Object { $_.Name -ne "_TEMPLATE.md" } | ForEach-Object {
        Write-Host "  $([System.IO.Path]::GetFileNameWithoutExtension($_.Name))"
    }
    exit 1
}

$specRelative = Resolve-Path -Path $specFile -Relative
Write-Host "Spec: $specRelative"

# --- Gather source files ---
$sourceFiles = Get-ChildItem -Path "src" -Recurse -Include "*.js","*.svelte","*.ts" | ForEach-Object { $_.FullName }

# --- Build aider command ---
$aiderArgs = @("--no-gitignore")

# Add the spec as an editable file (so aider can check off criteria)
$aiderArgs += $specRelative

# Add source files
foreach ($f in $sourceFiles) {
    $relativePath = Resolve-Path -Path $f -Relative
    $aiderArgs += $relativePath
}

# --- Build prompt ---
$defaultPrompt = @"
Read $specRelative carefully. Implement ALL acceptance criteria that are not yet checked off.

Rules:
1. Read the spec first to understand what needs to be built
2. Implement each unchecked acceptance criterion
3. Make sure the build passes (npm run build)
4. After implementing each criterion, update the spec to check it off: - [ ] becomes - [x]
5. When all criteria are checked, stop

Start by reading the spec and listing what needs to be done.
"@

$prompt = if ($Message) { $Message } else { $defaultPrompt }

$aiderArgs += "--message"
$aiderArgs += $prompt

Write-Host "Source files: $($sourceFiles.Count)"
Write-Host ""

aider @aiderArgs
