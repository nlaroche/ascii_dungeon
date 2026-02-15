<#
.SYNOPSIS
    Validation script for ASCII Dungeon project.
    Runs build, optional lint, and optional dev server smoke test.

.PARAMETER Quick
    Only run the build step (skip lint and dev server checks).

.EXAMPLE
    .\test.ps1           # Full validation
    .\test.ps1 -Quick    # Build only
#>

param(
    [switch]$Quick
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$exitCode = 0
$results = @()

function Write-Step($step, $status, $detail) {
    $icon = if ($status -eq "PASS") { "[PASS]" } elseif ($status -eq "FAIL") { "[FAIL]" } elseif ($status -eq "SKIP") { "[SKIP]" } else { "[INFO]" }
    $msg = "$icon $step"
    if ($detail) { $msg += " - $detail" }
    Write-Host $msg
    $script:results += @{ Step = $step; Status = $status; Detail = $detail }
}

# --------------------------------------------------
# Step 1: Check dependencies
# --------------------------------------------------
if (-not (Test-Path "node_modules")) {
    Write-Step "Dependencies" "INFO" "node_modules missing, running npm install..."
    $installOutput = npm install 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Step "Dependencies" "FAIL" "npm install failed"
        Write-Host $installOutput
        exit 1
    }
    Write-Step "Dependencies" "PASS" "npm install succeeded"
} else {
    Write-Step "Dependencies" "PASS" "node_modules present"
}

# --------------------------------------------------
# Step 2: Build
# --------------------------------------------------
Write-Host ""
Write-Host "--- BUILD ---"
$vitePath = Join-Path $ProjectRoot "node_modules\vite\bin\vite.js"
$buildOutput = node $vitePath build 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Step "Build" "FAIL" "npm run build failed"
    Write-Host "BUILD_ERROR_START"
    Write-Host $buildOutput.Trim()
    Write-Host "BUILD_ERROR_END"
    $exitCode = 1
} else {
    Write-Step "Build" "PASS" "Build succeeded"
}

# --------------------------------------------------
# Step 2b: Unit Tests (if vitest is installed)
# --------------------------------------------------
Write-Host ""
Write-Host "--- UNIT TESTS ---"
$vitestPath = Join-Path $ProjectRoot "node_modules\vitest\vitest.mjs"
if (Test-Path $vitestPath) {
    $testOutput = node $vitestPath run 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Step "UnitTests" "FAIL" "Vitest tests failed"
        Write-Host "TEST_ERROR_START"
        Write-Host $testOutput.Trim()
        Write-Host "TEST_ERROR_END"
        $exitCode = 1
    } else {
        Write-Step "UnitTests" "PASS" "All tests passed"
    }
} else {
    Write-Step "UnitTests" "SKIP" "Vitest not installed"
}

# --------------------------------------------------
# Step 2c: E2E Smoke Tests (Playwright)
# --------------------------------------------------
Write-Host ""
Write-Host "--- E2E SMOKE TESTS ---"
$playwrightCli = Join-Path $ProjectRoot "node_modules\@playwright\test\cli.js"
if (Test-Path $playwrightCli) {
    $e2eOutput = node $playwrightCli test 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Step "E2ESmoke" "FAIL" "Playwright smoke tests failed"
        Write-Host "E2E_ERROR_START"
        Write-Host $e2eOutput.Trim()
        Write-Host "E2E_ERROR_END"
        $exitCode = 1
    } else {
        Write-Step "E2ESmoke" "PASS" "All smoke tests passed"
    }
} else {
    Write-Step "E2ESmoke" "SKIP" "Playwright not installed"
}

if ($Quick) {
    Write-Host ""
    Write-Host "--- SUMMARY (quick mode) ---"
    foreach ($r in $results) {
        Write-Step $r.Step $r.Status $r.Detail
    }
    exit $exitCode
}

# --------------------------------------------------
# Step 3: Lint (optional - only if eslint is installed)
# --------------------------------------------------
Write-Host ""
Write-Host "--- LINT ---"
$eslintPath = Join-Path $ProjectRoot "node_modules\.bin\eslint.cmd"
if (Test-Path $eslintPath) {
    $lintOutput = & $eslintPath "src/" --format compact 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Step "Lint" "FAIL" "ESLint found errors"
        Write-Host "LINT_ERROR_START"
        Write-Host $lintOutput.Trim()
        Write-Host "LINT_ERROR_END"
        $exitCode = 1
    } else {
        Write-Step "Lint" "PASS" "No lint errors"
    }
} else {
    Write-Step "Lint" "SKIP" "ESLint not installed"
}

# --------------------------------------------------
# Step 4: Dev server smoke test
# --------------------------------------------------
Write-Host ""
Write-Host "--- DEV SERVER SMOKE TEST ---"
$devTimeout = 12

try {
    $devProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $ProjectRoot -PassThru -NoNewWindow -RedirectStandardOutput "$ProjectRoot\.dev-stdout.tmp" -RedirectStandardError "$ProjectRoot\.dev-stderr.tmp"

    Start-Sleep -Seconds $devTimeout

    if ($devProcess.HasExited) {
        $stderr = Get-Content "$ProjectRoot\.dev-stderr.tmp" -ErrorAction SilentlyContinue | Out-String
        Write-Step "DevServer" "FAIL" "Dev server crashed within ${devTimeout}s"
        if ($stderr) {
            Write-Host "DEVSERVER_ERROR_START"
            Write-Host $stderr.Trim()
            Write-Host "DEVSERVER_ERROR_END"
        }
        $exitCode = 1
    } else {
        Write-Step "DevServer" "PASS" "Dev server ran for ${devTimeout}s without crashing"
        Stop-Process -Id $devProcess.Id -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Step "DevServer" "FAIL" "Could not start dev server: $_"
    $exitCode = 1
} finally {
    Remove-Item "$ProjectRoot\.dev-stdout.tmp" -ErrorAction SilentlyContinue
    Remove-Item "$ProjectRoot\.dev-stderr.tmp" -ErrorAction SilentlyContinue
}

# --------------------------------------------------
# Summary
# --------------------------------------------------
Write-Host ""
Write-Host "--- SUMMARY ---"
foreach ($r in $results) {
    Write-Step $r.Step $r.Status $r.Detail
}

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "RESULT: ALL CHECKS PASSED"
} else {
    Write-Host "RESULT: CHECKS FAILED"
}

exit $exitCode
