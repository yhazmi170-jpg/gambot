$url = "https://6af23634-5758-4906-a44f-1a3904fec27d-00-oop2i9idjokv.sisko.replit.dev"
while ($true) {
  try { Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 10 | Out-Null } catch {}
  Start-Sleep -Seconds 300
}
