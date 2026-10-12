' keepalive.vbs — hidden launcher for keepalive.ps1 (no console window).
' Register: schtasks /create /tn GambotKeepalive /tr "wscript \"C:\path\keepalive.vbs\"" /sc onlogon
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & Replace(WScript.ScriptFullName, "keepalive.vbs", "keepalive.ps1") & """", 0, False