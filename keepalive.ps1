# keepalive.ps1 — keep Render free-tier services awake (15 min idle spin-down).
# Pings every 4 min. Runs from Windows as scheduled task "GambotKeepalive" (AtLogOn).
$urls = @(
    "https://gambot-ovib.onrender.com/",
    "https://discord-selfy.onrender.com/health"
)
while ($true) {
    foreach ($u in $urls) {
        try { Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 60 | Out-Null } catch {}
    }
    Start-Sleep -Seconds 240
}