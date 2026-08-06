# Gambot — Discord Economy Bot

## Identity
- **Name**: always address user as "bro" (informal, friendly)
- **Bot**: Discord economy/gambling bot using discord.js v14
- **Prefix**: `v` / `ovo` / `A` (admin, owner only)
- **Owner ID**: 536278876247162882
- **Host**: Render (free tier) — Blueprint from `render.yaml`. Replit retired as primary host (tab-close slept the repl). Local `keepalive.ps1` pings the Render URL to beat the 15-min idle spin-down.
- **DB**: SQLite via sql.js at `DB_PATH` (env, default `./data` on Render; ephemeral on free tier → hourly GitHub backup + boot-restore is the data safety net). Backed up to GitHub every hour.
- **Backups**: `backup.js` writes timestamped snapshots (`backups/gambot-<ts>.db`, never overwritten) + a mirror at `gambot.db`. Restore prefers the newest snapshot and only replaces a local DB that is OLDER than the snapshot (protects against a stale instance clobbering newer data). `index.js` logs backup failures loudly (no silent `.catch`). Backups run **every 10 min** + on **SIGTERM/SIGINT shutdown** (Render free tier wipes `./data` on every deploy — the shutdown backup ensures nothing newer than 10 min is lost).
- **Repo**: https://github.com/yhazmi170-jpg/gambot (branch `master`)
- **Current version**: see `package.json` (as of last docs sync: **1.4.3**)

## Agent docs (mandatory)
- **Always keep markdown in sync** after meaningful work:
  - Update `AGENTS.md` when rules, economy, deploy, or key files change
  - Update `HANDOFF.md` at end of a session / when switching tools (Cursor ↔ OpenCode)
- Do not leave stale todos in `HANDOFF.md` — mark done or remove
- Same repo is shared by Cursor and OpenCode — git is the source of truth

## Rules
1. Never lose user data — restore from GitHub backup only if DB doesn't exist
2. Owner has infinite bet cap, hidden from leaderboard, **no** balance-factor cut on rewards/wins
3. Pet/hunt/battle system (`v hunt`, `v zoo`, `v team`, `v battle`, `v sell`, `v rename`) — see "Pets / hunt economy" below
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

## Pets / hunt economy (v1.4.0, OwO-style)
- **Gems = hunt capacity.** `v hunt` hunts `1 + floor(gems / 5)` animals (cap **10**). No gem cost to multi-hunt — gems ARE the capacity. `v hunt <count>` caps at your capacity. Hunt costs **5 coins per animal** (`db.HUNT_COST_BASE`).
- **Essence** comes from `v sacrifice <species|rarity|all> [count]` — converts matching animals (team animals are always skipped). Values: common 1 / uncommon 3 / rare 8 / epic 25 / legendary 100 (`db.ESSENCE_VALUES`). `all` converts every animal.
- **Traits** (`v upgrade <trait>`): Efficiency (rare+ rarity weight), Gain (+2 coins/animal/level), Radar (+50% gem drop chance/level), Experience (+2 xp/animal/level). Costs `db.traitCost(level)` = `floor(20 * (level+1)^1.5)` essence. Trait columns on `users`: `hunt_eff/hunt_gain/hunt_radar/hunt_xp`.
- **Autohunt bot** (`v autohunt [mins]`, `v autohuntbot`): starts behind a math captcha (message collector, 45s), costs **50 coins/min**, grants 1 cycle/min. `autohunt_level` upgrade costs `db.autohuntUpgradeCost` = `floor(25*(level+1)^1.6)` essence → +1 animal/cycle, +15 min max run (base 30m), rank Bronze→Legend (`db.autohuntRank`).
- **Autohunt is lazy/passive** — cycles are granted in `db.catchUpAutohunt(userId)`, called from `utils/commandHandler.js` on every command (and `v huntbot`/`v autohunt`). It computes backlog from `autohunts` table timestamps, so it survives bot sleeps/restarts (grants all missed cycles, incl. after expiry). Run cadence: `AUTOHUNT_CYCLE = 60`s.
- **Snail garden** (`v garden`): buy snails 500 coins each, daily limit 20 (`SNAIL_DAILY_LIMIT`), breed 1 baby/snail/24h up to **100** capacity (`SNAIL_CAPACITY`), sell 400 each. Breeding catch-up in `db.breedSnails`, also hooked into commandHandler.
- `v huntbot` = OwO-style panel (essence, traits + progress bars, autohunt bot status, hunt yield). `v hunt` embed shows gems/coins/xp gained. Gems+essence shown in `v bal`, `v zoo`, `v profile`.
- `v sell <id|species|rarity|all> [count]` — sells by id, or a whole species/rarity, or everything (`all`), team animals always skipped.

## Cards / UI
- Blackjack uses owo-style board: `Dealer [10+?]` + card back, `Name [19]` + cards (description embed, not field grid)
- Optional custom card art: `config.cardEmojis` map keys like `ah`, `10s`, `jh`, `cardback` → `<:name:id>`
- Poker uses Discord suit emojis + rank; hold buttons show the card
- Keep game text clean — no AI-sounding fluff

## Host / single instance
- **Host: Render** (free web service, `plan: free` in `render.yaml`) — deploys from this repo via Blueprint. Auto-deploys on `git push` to `master`.
- **Do NOT run on Replit anymore** — stop the Replit repl (press Stop / `Aovo shutdown`) so there's no double instance. The `.gambot.lock` is per-machine, so two hosts = two bots = double responses.
- Free tier spins down after **15 min idle** → keepalive pinger must keep hitting the Render URL (`https://gambot-o2o4.onrender.com`) every 4 min. It wakes on request (~30-50s).
- Data persistence: free tier has **no persistent disk** — `./data` is ephemeral. `GITHUB_TOKEN` env enables hourly backup + boot restore to `yhazmi170-jpg/gambot-data`. Without it, a fresh instance starts an empty DB (max ~1h of player data lost).
- `update.sh` is Replit-only legacy — **ignore it**. Deploy = `git push`.

## Restart / deploy
```bash
git add -A; git commit -m "..."; git push origin master   # Render auto-redeploys
# or in Discord: Arestart (if bot already online)
```

## Known issues / lessons (learned the hard way)
- **Replit free sleeps on tab-close; pings don't prevent it.** Only paid "Always On" or a different host fixes it. Do not move back to Replit free.
- **render.yaml + disk = paid instance.** Render free has no persistent disks; any disk in the Blueprint forces paid ($7.25/mo). Keep `plan: free` and NO disk. Data persistence on free = GitHub backup via `GITHUB_TOKEN`.
- **Blueprint reads render.yaml at creation time** — push render.yaml changes to GitHub BEFORE opening/refreshing the Blueprint, or the page shows the stale (paid) config.
- **`db.save()` / `backup.restore()` must mkdir the DB dir first** (already fixed). Any future code writing to `DB_PATH` must `fs.mkdirSync(path.dirname(...), { recursive: true })` or it ENOENT-crashes on a fresh box.
- **One-time announcements must NOT use flag FILES** — Render free FS is ephemeral, so `.notified_*` files vanish on every restart and the DM/announcement re-fires each boot. Use the `notifications` table (`db.wasNotified(key)` / `db.markNotified(key)`). This bit us: custom-role holders got re-DM'd on every restart.
- **Never swallow backup errors with `.catch(() => {})`** — a silently failing hourly backup looks fine while data goes unprotected (lost ~3h once). `index.js` logs `BACKUP FAILED` to console/bot.err. Check `gambot-data` commit timestamps if data seems at risk.
- **keepalive must actually be scheduled** — the .ps1/.vbs files do nothing until a scheduled task runs them. Registered task: `GambotKeepalive` (AtLogOn). Keep the ping interval under the host's sleep window (Render = 15 min, so 4 min is safe).
- **Secrets are gitignored on purpose** — never `git add` `config.json`, `gambot.db`, or `.env`. Render secrets come from env vars.

## Key Files
- `index.js` — entry, lock, HTTP ping server, lottery draw, interaction routing
- `config.js` / `config.json` — token + settings
- `backup.js` — GitHub backup/restore
- `db/index.js` — schema, CRUD, `getBalanceFactor`, `payWin`, essence/traits/autohunt/snail-garden functions
- `commands/shop.js` — shop prices + purchase flow
- `commands/hunt.js` / `sacrifice.js` / `upgrade.js` / `autohunt.js` / `autohuntbot.js` / `huntbot.js` / `garden.js` — hunting + OwO-style upgrades
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
