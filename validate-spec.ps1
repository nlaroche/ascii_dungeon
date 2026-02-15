<#
.SYNOPSIS
    Validates the current codebase against a spec file's acceptance criteria.
    Runs the build and checks for key artifacts/exports mentioned in the spec.

.EXAMPLE
    .\validate-spec.ps1 combat-system
    .\validate-spec.ps1                # Lists available specs
#>

param(
    [string]$Spec = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$docsDir = Join-Path $ProjectRoot "docs"

# --- No spec provided: list available specs ---
if (-not $Spec) {
    Write-Host "Usage: .\validate-spec.ps1 <spec-name>"
    Write-Host ""
    Write-Host "Available specs:"
    Get-ChildItem -Path $docsDir -Filter "*.md" | Where-Object { $_.Name -ne "_TEMPLATE.md" } | ForEach-Object {
        Write-Host "  $([System.IO.Path]::GetFileNameWithoutExtension($_.Name))"
    }
    exit 0
}

# --- Resolve spec file ---
$specFile = Join-Path $docsDir "$Spec.md"
if (-not (Test-Path $specFile)) {
    Write-Host "[FAIL] Spec not found: $specFile"
    exit 1
}

$specContent = Get-Content $specFile -Raw
$specRelative = Resolve-Path -Path $specFile -Relative
$exitCode = 0

Write-Host "Validating: $specRelative"
Write-Host ""

# --------------------------------------------------
# Step 1: Build check
# --------------------------------------------------
Write-Host "--- BUILD CHECK ---"
$buildOutput = npm run build 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Build failed"
    Write-Host "BUILD_ERROR_START"
    Write-Host $buildOutput.Trim()
    Write-Host "BUILD_ERROR_END"
    exit 1
}
Write-Host "[PASS] Build succeeded"

# --------------------------------------------------
# Step 2: Parse spec for file references
# --------------------------------------------------
Write-Host ""
Write-Host "--- FILE EXISTENCE CHECK ---"

$filePatterns = [regex]::Matches($specContent, '`(src/[^`]+)`') | ForEach-Object { $_.Groups[1].Value }

$missingFiles = @()
foreach ($file in $filePatterns) {
    $fullPath = Join-Path $ProjectRoot $file
    if (Test-Path $fullPath) {
        Write-Host "[PASS] File exists: $file"
    } else {
        Write-Host "[FAIL] File missing: $file"
        $missingFiles += $file
        $exitCode = 1
    }
}

if ($filePatterns.Count -eq 0) {
    Write-Host "[SKIP] No file paths found in spec"
}

# --------------------------------------------------
# Step 3: Parse spec for export/function/component references
# --------------------------------------------------
Write-Host ""
Write-Host "--- EXPORT/SYMBOL CHECK ---"

$symbolMatches = [regex]::Matches($specContent, '(?:export|function|component|class)\s+`(\w+)`') | ForEach-Object { $_.Groups[1].Value }
$codeRefMatches = [regex]::Matches($specContent, '- \[[ x]\].*`(\w+(?:\.\w+)?)`') | ForEach-Object { $_.Groups[1].Value }
$allSymbols = ($symbolMatches + $codeRefMatches) | Select-Object -Unique

foreach ($sym in $allSymbols) {
    $found = Get-ChildItem -Path (Join-Path $ProjectRoot "src") -Recurse -Include "*.js","*.svelte","*.ts" |
        Select-String -Pattern $sym -SimpleMatch -Quiet
    if ($found) {
        Write-Host "[PASS] Symbol found in codebase: $sym"
    } else {
        Write-Host "[FAIL] Symbol not found in codebase: $sym"
        $exitCode = 1
    }
}

if ($allSymbols.Count -eq 0) {
    Write-Host "[SKIP] No code symbols found in spec to check"
}

# --------------------------------------------------
# Step 4: Check acceptance criteria completion
# --------------------------------------------------
Write-Host ""
Write-Host "--- ACCEPTANCE CRITERIA ---"

$checked = [regex]::Matches($specContent, '- \[x\](.+)')
$unchecked = [regex]::Matches($specContent, '- \[ \](.+)')
$total = $checked.Count + $unchecked.Count

if ($total -gt 0) {
    Write-Host "Completed: $($checked.Count)/$total criteria"
    foreach ($item in $unchecked) {
        Write-Host "[TODO] $($item.Groups[1].Value.Trim())"
    }
    foreach ($item in $checked) {
        Write-Host "[DONE] $($item.Groups[1].Value.Trim())"
    }
} else {
    Write-Host "[SKIP] No acceptance criteria found in spec"
}

# --------------------------------------------------
# Summary
# --------------------------------------------------
Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "SPEC_VALIDATION: PASSED"
} else {
    Write-Host "SPEC_VALIDATION: FAILED"
}

exit $exitCode
