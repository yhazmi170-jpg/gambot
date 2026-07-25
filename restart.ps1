$gambotDir = "C:\Users\yazan\gambot"
$gambotPid = $null

Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*index.js*" -and $_.CommandLine -notlike "*discord-selfy*" } | ForEach-Object { $gambotPid = $_.ProcessId }

if ($gambotPid) { Stop-Process -Id $gambotPid -Force }
Start-Sleep 2
Start-Process -WindowStyle Hidden -FilePath node -ArgumentList "index.js" -WorkingDirectory $gambotDir
Start-Sleep 5
Write-Host "gambot restarted"
