<#
.SYNOPSIS
    Agentic spec evolution loop. Runs Aider repeatedly to research and
    iterate on a design spec, with each iteration building on the previous.

.PARAMETER Spec
    Spec filename in docs/ (without .md extension). Required.

.PARAMETER Iterations
    Number of iterations to run (default 5).

.PARAMETER StartFrom
    Iteration number to start from (default 1).

.PARAMETER ReadOnly
    Additional read-only context files (optional).

.EXAMPLE
    .\aider-evolve.ps1 -Spec item-system-spec -Iterations 5
    .\aider-evolve.ps1 -Spec item-system-spec -Iterations 3 -StartFrom 4
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Spec,
    [int]$Iterations = 5,
    [int]$StartFrom = 1,
    [string[]]$ReadOnly = @()
)

$env:PYTHONUTF8 = "1"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$specFile = "docs\$Spec.md"
if (-not (Test-Path $specFile)) {
    Write-Host "ERROR: Spec not found: $specFile" -ForegroundColor Red
    exit 1
}

$logFile = ".claude\evolve-log.jsonl"
$claudeDir = Join-Path $ProjectRoot ".claude"
if (-not (Test-Path $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null }

for ($i = $StartFrom; $i -lt ($StartFrom + $Iterations); $i++) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  ITERATION $i / $($StartFrom + $Iterations - 1)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    $iterStart = Get-Date

    $message = @"
You are iterating on a design spec for an ASCII dungeon crawler game.

READ the spec file $specFile carefully. It contains:
- The project context and constraints
- A reward function with scoring axes that you MUST score yourself against
- The iteration protocol you MUST follow
- All previous iterations and their scores

YOUR TASK FOR ITERATION ${i}:
1. Read the current spec and all previous iterations carefully
2. If this is iteration 1: Research and propose an initial design. Think deeply and explore novel approaches. Do NOT copy existing games.
3. If this is iteration 2+: Read the weaknesses from the previous iteration. Address them. Evolve the design. Be bold.
4. Write your iteration as a new section appended to the spec file following the iteration protocol.
5. Be HONEST in self-scoring. Inflated scores waste iterations.
6. Be CONCRETE. Show JavaScript data structures and function signatures, not abstract prose.
7. Be BOLD. If the previous design was boring, try something radically different.
8. Think about what would make a player say "holy shit, that's cool".
"@

    $msgFile = Join-Path $claudeDir "evolve-msg-$i.tmp"
    [System.IO.File]::WriteAllText($msgFile, $message, [System.Text.Encoding]::UTF8)

    $aiderArgs = @(
        "--no-gitignore", "--yes-always", "--no-stream", "--no-pretty", "--no-fancy-input",
        "--no-auto-test", "--edit-format", "diff",
        $specFile
    )

    $defaultReadOnly = @("src/lib/player.js", "src/lib/combat.js", "src/lib/dungeon.js")
    foreach ($f in ($defaultReadOnly + $ReadOnly)) {
        if (Test-Path $f) {
            $aiderArgs += "--read"
            $aiderArgs += $f
        }
    }

    $aiderArgs += "--message-file"
    $aiderArgs += $msgFile

    Write-Host "Running Aider iteration $i..."
    $output = ""
    try {
        $output = aider @aiderArgs 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
    } catch {
        $output = $_.Exception.Message
        $exitCode = 1
    }

    $iterEnd = Get-Date
    $duration = ($iterEnd - $iterStart).TotalSeconds

    $totalScore = "unknown"
    if ($output -match "Total[:\s]*[\=\s]*(\d+)") {
        $totalScore = $Matches[1]
    }

    $committed = ($output -match "Commit [a-f0-9]") -or ($output -match "Applied edit")

    Write-Host ""
    Write-Host "ITERATION $i COMPLETE" -ForegroundColor Green
    Write-Host "  Duration: $([math]::Round($duration, 1))s"
    Write-Host "  Exit code: $exitCode"
    Write-Host "  Committed: $committed"
    Write-Host "  Score: $totalScore"

    $logEntry = @{
        timestamp = $iterStart.ToString("o")
        iteration = $i
        spec = $Spec
        duration_s = [math]::Round($duration, 1)
        exit_code = $exitCode
        committed = $committed
        score = $totalScore
    } | ConvertTo-Json -Compress
    Add-Content -Path $logFile -Value $logEntry -Encoding UTF8

    Remove-Item $msgFile -ErrorAction SilentlyContinue

    if ($i -lt ($StartFrom + $Iterations - 1)) {
        Write-Host "  Pausing 3s before next iteration..."
        Start-Sleep -Seconds 3
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ALL ITERATIONS COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (Test-Path $logFile) {
    Write-Host ""
    Write-Host "Score progression for '$Spec':"
    Get-Content $logFile | ForEach-Object {
        try {
            $entry = $_ | ConvertFrom-Json
            if ($entry.spec -eq $Spec) {
                Write-Host "  Iteration $($entry.iteration): Score=$($entry.score) ($($entry.duration_s)s)"
            }
        } catch {}
    }
}
