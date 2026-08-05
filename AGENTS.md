# Gambot — Discord Economy Bot

## Identity
- **Name**: always address user as "bro" (informal, friendly)
- **Bot**: Discord economy/gambling bot using discord.js v14
- **Prefix**: `v` / `ovo` / `A` (admin, owner only)
- **Owner ID**: 536278876247162882
- **Host**: Replit (free, no credit card) + UptimeRobot / `keepalive.ps1` ping for 24/7
- **DB**: SQLite via sql.js, backed up to GitHub every hour
- **Repo**: https://github.com/yhazmi170-jpg/gambot (branch `master`)
- **Current version**: see `package.json` (as of last docs sync: **1.2.7**)

## Agent docs (mandatory)
- **Always keep markdown in sync** after meaningful work:
  - Update `AGENTS.md` when rules, economy, deploy, or key files change
  - Update `HANDOFF.md` at end of a session / when switching tools (Cursor ↔ OpenCode)
- Do not leave stale todos in `HANDOFF.md` — mark done or remove
- Same repo is shared by Cursor and OpenCode — git is the source of truth

## Rules
1. Never lose user data — restore from GitHub backup only if DB doesn't exist
2. Owner has infinite bet cap, hidden from leaderboard, **no** balance-factor cut on rewards/wins
3. Pet/hunt/battle system (`v hunt`, `v zoo`, `v team`, `v battle`, `v sell`, `v rename`)
4. Perk customization: `v setbadge`, `v setlb`, `v autoreact`
5. Shop purchase log only if log channel is set (`Aovo log #channel`) — do not flood with every command
6. Admin: `Aovo add`, `Aovo remove`, `Aovo bal`, `Areward`, `Aremovereward`, `Arestart`, `Aovo shop add #channel`, `Aovo cmds`, `Aovo shutdown`

## Economy — progressive balance factor
- `getBalanceFactor(userId)` in `db/index.js`
- Every **500k** balance → **1%** less (caps at **60%** cut → floor **0.4**)
- Applies to: `daily`, `weekly`, `work`, and gambling wins via `payWin()`
- Games using `payWin`: coinflip, blackjack, slots, crash, dice, roulette, poker, mines, lottery, battle
- Losses stay full; PvP transfers (duel/rob/give/rain) are **not** scaled
- Owner ID always factor `1`

## Shop
- Prices live in `commands/shop.js` (`SHOP` array)
- Perks were bumped ~35% in v1.2.1, then ~2x more in v1.2.7 — adjust there if changing again

## Cards / UI
- Blackjack uses owo-style board: `Dealer [10+?]` + card back, `Name [19]` + cards (description embed, not field grid)
- Optional custom card art: `config.cardEmojis` map keys like `ah`, `10s`, `jh`, `cardback` → `<:name:id>`
- Poker uses Discord suit emojis + rank; hold buttons show the card
- Keep game text clean — no AI-sounding fluff

## Replit / single instance
- Atomic lock: `.gambot.lock` in project root (`index.js` `acquireLock`)
- **Do not** run Shell `node index.js` and Replit **Run** at the same time
- Preferred flow: `bash update.sh` (pull + kill) → let **Run** restart the bot
- Replit UI "not running" while Shell has the bot = expected (UI only tracks Run)
- `update.sh` does **not** start the bot — it only pulls/kills
- Local keepalive: `keepalive.ps1` pings `https://gambot--yhazmi170.replit.app`

## Restart on Replit
```bash
bash update.sh
# then press Run  (or Arestart if bot is already online)
```

## Key Files
- `index.js` — entry, lock, HTTP ping server, lottery draw, interaction routing
- `config.js` / `config.json` — token + settings
- `backup.js` — GitHub backup/restore
- `db/index.js` — schema, CRUD, `getBalanceFactor`, `payWin`
- `commands/shop.js` — shop prices + purchase flow
- `commands/poker.js` / `blackjack.js` — card games
- `utils/commandHandler.js` — routing, TOS, cooldowns
- `utils/logger.js` — Discord logging
- `update.sh` — pull + kill for deploy
- `HANDOFF.md` — cross-tool session state (keep current)
- `keepalive.ps1` + `keepalive.vbs` — uptime pinger

## Important
- `getMaxBet` returns Infinity for owner
- `getTop` excludes owner from leaderboard
- `addBalance` auto-creates users
- Restore only if DB file is missing/empty (not every restart)
- **EVERY PUSH (mandatory, do not skip):** bump `package.json` version, update `update_msg.txt` with a user-facing summary, verify new commands have `helpCategory` + `description` so they auto-appear in `v help`, update `gamehelp.js` when game rules/UI change, update `AGENTS.md` / `HANDOFF.md` if behavior or status changed

## Help (mandatory)
- `v help` auto-lists any command with `helpCategory` + `description` (+ optional `helpArgs`)
- **Always** set/update those fields when adding or changing a user-facing command
- **Always** update `commands/gamehelp.js` when a game’s rules, layout, or perks change (include aliases)
- Perk-only commands: add a line to `perkCmdMap` in `help.js` when relevant
- After help-related changes, mention it briefly in `update_msg.txt` if user-visible
