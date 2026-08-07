# Sync C:\Users\yazan\gambot -> D:\gambot (USB backup / runnable copy)
# Run after every change, or double-click anytime.
# Mirror (keeps USB identical), skipping logs, lock, and stray downloaded junk.

$src = 'C:\Users\yazan\gambot'
$dst = 'D:\gambot'

if (-not (Test-Path $dst)) {
  Write-Host 'USB drive not found (D:\gambot missing). Plug in the USB and try again.' -ForegroundColor Red
  exit 1
}

robocopy $src $dst /MIR /XF *.log .gambot.lock bot.err *-player-script.js /NFL /NDL /NJH /NP
$code = $LASTEXITCODE

if ($code -le 7) {
  Write-Host "Synced OK (robocopy exit $code). USB copy is current." -ForegroundColor Green
} else {
  Write-Host "Sync had errors (robocopy exit $code)." -ForegroundColor Red
}
exit $code
