$url = "https://gambot-o2o4.onrender.com"
while ($true) {
  try { Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 10 | Out-Null } catch {}
  Start-Sleep -Seconds 240
}
