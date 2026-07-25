# Gambot — Discord Economy Bot

## Identity
- **Name**: always address user as "bro" (informal, friendly)
- **Bot**: Discord economy/gambling bot using discord.js v14
- **Prefix**: `v` / `ovo` / `A` (admin, owner only)
- **Owner ID**: 536278876247162882
- **Host**: Replit (free, no credit card) + UptimeRobot ping for 24/7
- **DB**: SQLite via sql.js, backed up to GitHub every hour

## Rules
1. Never lose user data — restore from GitHub backup only if DB doesn't exist
2. Owner has infinite bet cap, hidden from leaderboard
3. Pet/hunt/battle system (v hunt, v zoo, v team, v battle, v sell, v rename)
4. Perk customization: v setbadge, v setlb, v autoreact
5. All commands logged if log channel is set (Aovo log #channel)
6. Admin commands: Aovo add, Aovo remove, Aovo bal, Areward, Aremovereward

## Restart on Replit
- `bash update.sh` in Replit Shell

## Key Files
- `index.js` — entry point with HTTP server for pings
- `config.js` — shared config (reads config.json or env vars)
- `backup.js` — backup to github, restore on first boot
- `db/index.js` — schema and all CRUD
- `utils/commandHandler.js` — command routing, TOS, cooldowns
- `utils/logger.js` — logging to Discord channel
- `keepalive.ps1` + `keepalive.vbs` — Replit pinger (starts via shell:startup)

## Important
- `getMaxBet` returns Infinity for owner
- `getTop` excludes owner from leaderboard
- `addBalance` auto-creates users
- Restore only happens if DB file is missing/empty (not on every restart)
