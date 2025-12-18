# Kill any existing processes on port 1420
$netstat = netstat -ano | Select-String ':1420.*LISTENING'
if ($netstat) {
    $pid = ($netstat -split '\s+')[-1]
    Write-Host "Killing process $pid on port 1420..."
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Run tauri dev
Set-Location D:\repos\ascii_dungeon\editor
npm run tauri dev
