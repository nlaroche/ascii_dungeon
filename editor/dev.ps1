$env:PATH = "C:\Users\nlaroche\.cargo\bin;" + $env:PATH
$env:RUST_BACKTRACE = "1"
Set-Location D:\repos\ascii_dungeon\editor
npm run tauri dev
