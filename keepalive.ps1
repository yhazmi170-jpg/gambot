$url = "https://gambot--yhazmi170.replit.app"
while ($true) {
  try { Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 10 | Out-Null } catch {}
  Start-Sleep -Seconds 240
}
