# Gambot � Discord Economy Bot

## Identity
- **Name**: always address user as "bro" (informal, friendly)
- **Bot**: Discord economy/gambling bot using discord.js v14
- **Prefix**: `v` / `ovo` / `A` (admin, owner only)
- **Owner ID**: 536278876247162882
- **Host**: Render (free tier) � Blueprint from `render.yaml`. Replit retired as primary host (tab-close slept the repl). Local `keepalive.ps1` pings the Render URL to beat the 15-min idle spin-down.
- **DB**: SQLite via sql.js at `DB_PATH` (env, default `./data` on Render; ephemeral on free tier ? hourly GitHub backup + boot-restore is the data safety net). Backed up to GitHub every hour.
- **Backups**: `backup.js` writes timestamped snapshots (`backups/gambot-<ts>.db`, never overwritten) + a mirror at `gambot.db`. Restore scans ALL snapshots newest?oldest and restores the first one with >0 users (`countUsers` via sql.js) � a bad/empty backup can never block recovery. Backup **refuses to upload** a 0-user DB (prevents an empty/corrupt instance from clobbering history). `index.js` logs backup failures loudly. Backups run **every 1 min** + on **SIGTERM/SIGINT shutdown** (Render free tier wipes `./data` on every deploy � shutdown backup caps loss at 1 min).
- **Backup repo**: `gambot-data-v3` on GitHub (old repos `gambot-data` and `gambot-data-v2` were corrupt � do NOT use them). `detectCorruption` in backup.js rejects snapshots with absurd balances (>1T), negative balances, or known-wiped users.
- **Balance corruption (Aug 2026)**: a bug drained multiple users' balances over time (@?? lost ~52M, @meimei lost ~28M). Root cause unknown � may be integer overflow in balance calculations. If balances look wrong again, check `db/index.js` `addBalance`/`payWin`/`getBalanceFactor` for overflow bugs.
- **Current version**: see `package.json` (as of last docs sync: **1.7.6**)
- **Change log**: every update ever shipped is documented in `CHANGELOG.md` (newest first) � update it whenever you release, right alongside the version bump + `update_msg.txt`

## Agent docs (mandatory)
- **Always keep markdown in sync** after meaningful work:
  - Update `AGENTS.md` when rules, economy, deploy, or key files change
  - Update `HANDOFF.md` at end of a session / when switching tools (Cursor ? OpenCode)
- Do not leave stale todos in `HANDOFF.md` � mark done or remove
- Same repo is shared by Cursor and OpenCode � git is the source of truth

## Two-agent workflow (Claude chai ? Claude Code CLI) � READ THIS FIRST
- **Roles:** The **chat agent** (this Claude, in the user's claude.ai/sidebar session) is the *orchestrator + ops*: the user talks to it about updates, it assigns/approves coding tasks, and it owns deploys (push ? Render auto-deploy ? poll `https://gambot-o2o4.onrender.com` until the new SHA is live), version bumps, `update_msg.txt`, `pending_updates.txt`, and this doc. The **CLI agent** (Claude Code, run via `claude -p "..."` with the repo's `AGENTS.md`/`HANDOFF.md` as context) is the *coder*: it writes the actual code changes.
- **How they talk:** git is the ONLY message bus. The orchestrator may invoke the CLI agent on demand with `claude -p "<task>"` (headless, `--dangerously-skip-permissions` in temp/sim scenarios). The CLI agent commits + pushes its work; the orchestrator reads `git log`/diff to review, then deploys. The user can also run Claude Code interactively in the repo � either way, everything lands in commits.
- **Shared memory files (both agents MUST keep fresh):**
  - `HANDOFF.md` = live session state + "Done recently" (+ current todos). Rewrite top "Status" after a push; append bullet to "Done recently".
  - `pending_updates.txt` = queued small-update notes that get flushed into `update_msg.txt` + one version bump later.
  - `AGENTS.md` = system + economy rules (the CLI agent auto-loads it).
- **Handoff direction:** orchestrator ? CLI agent: give a precise task brief (file paths + expected behavior), expect a commit back. CLI agent ? orchestrator: every code change is a pushed commit (git log is the proof + the memory). Running feature sims / battle-tests is mandatory for the coding agent before it commits.
- Never use this repo as a chat channel � chat happens in the orchestrator session; the repo only ever contains code + the shared .md state files above.

## Rules
1. Never lose user data � restore from GitHub backup only if DB doesn't exist
2. Owner has infinite bet cap, hidden from leaderboard, **no** balance-factor cut on rewards/wins
3. Pet/hunt/battle system (`v hunt`, `v zoo`, `v team`, `v battle`, `v sell`, `v rename`) � see "Pets / hunt economy" below
4. Perk customization: `v setbadge`, `v setlb`, `v autoreact`
- Custom roles (`v customrole`): name, single color, or 2 colors = animated gradient (`color_a`/`color_b` cols in `custom_roles`, animated by a 3s interval in index.js). `v customrole delete` removes the role. Roles are always stacked directly under anchor role `1535224349965942884` (`positionToAnchor`).
5. Shop purchase log only if log channel is set (`Aovo log #channel`) � do not flood with every command
6. Admin: `Aovo add`, `Aovo remove`, `Aovo bal`, `Areward`, `Aremovereward`, `Arestart`, `Aovo shop add #channel`, `Aovo cmds`, `Aovo shutdown`, `v luckylist` (list lucky users)
7. Disabled commands: non-admin users can't run disabled cmds in a channel/guild � but the **owner bypasses all disabled checks** on any prefix (`v`/`ovo`, not just `A`). The message says "disabled in this channel" or "disabled in this server" depending on scope.

## Economy � progressive balance factor
- `getBalanceFactor(userId)` in `db/index.js`
- Every **500k** balance ? **1%** less (caps at **60%** cut ? floor **0.4**)
- Applies to: `daily`, `weekly`, `work`, and gambling wins via `payWin()`
- Games using `payWin`: coinflip, blackjack, slots, crash, dice, roulette, poker, mines, lottery, battle
- Losses stay full; PvP transfers (duel/rob/give/rain) are **not** scaled
- Owner ID always factor `1`
- v1.5.0: crash + mines now display the real effective multiplier after the cut (`db.effectiveMult`) � upfront warning in crash, inline notes in mines � so players see the true payout instead of feeling "rigged"

## Shop
- Prices live in `commands/shop.js` (`SHOP` array)
- Perks were bumped ~35% in v1.2.1, then ~2x more in v1.2.7 � adjust there if changing again

## Pets / hunt economy (v1.4.0, OwO-style)
- **Gems = hunt capacity.** `v hunt` hunts `1 + floor(gems / 5)` animals (cap **10**). No gem cost to multi-hunt � gems ARE the capacity. `v hunt <count>` caps at your capacity. Hunt costs **5 coins per animal** (`db.HUNT_COST_BASE`).
- **Essence** comes from `v sacrifice <species|rarity|all> [count]` � converts matching animals (team animals are always skipped). Values: common 1 / uncommon 3 / rare 8 / epic 25 / legendary 100 (`db.ESSENCE_VALUES`). `all` converts every animal.
- **Traits** (`v upgrade <trait>`): Efficiency (rare+ rarity weight), Gain (+2 coins/animal/level), Radar (+50% gem drop chance/level), Experience (+2 xp/animal/level). Costs `db.traitCost(level)` = `floor(20 * (level+1)^1.5)` essence. Trait columns on `users`: `hunt_eff/hunt_gain/hunt_radar/hunt_xp`.
- **Autohunt bot** (`v autohunt [mins]`, `v autohuntbot`): starts behind a math captcha (message collector, 45s), costs **50 coins/min**, grants 1 cycle/min. `autohunt_level` upgrade costs `db.autohuntUpgradeCost` = `floor(25*(level+1)^1.6)` essence ? +1 animal/cycle, +15 min max run (base 30m), rank Bronze?Legend (`db.autohuntRank`).
- **Autohunt is lazy/passive** � cycles are granted in `db.catchUpAutohunt(userId)`, called from `utils/commandHandler.js` on every command (and `v huntbot`/`v autohunt`). It computes backlog from `autohunts` table timestamps, so it survives bot sleeps/restarts (grants all missed cycles, incl. after expiry). Run cadence: `AUTOHUNT_CYCLE = 60`s.
- **Snail garden** (`v snailgarden <amt>`): step-by-step planting game. Failure chance starts at 20% and increases by 7% per step (max 95%). Cash out before a row fails. Harder to prevent abuse.
- `v huntbot` = OwO-style panel (essence, traits + progress bars, autohunt bot status, hunt yield). `v hunt` embed shows gems/coins/xp gained. Gems+essence shown in `v bal`, `v zoo`, `v profile`.
- `v sell <id|species|rarity|all> [count]` � sells by id, or a whole species/rarity, or everything (`all`), team animals always skipped.
- **Eggs & trading (v1.5.0):** `v hunt`/autohunt have an 8% egg drop per animal (`db.rollEggDrop`, doubled by `egg_luck` perk); `v hatch [all]` opens eggs (`db.hatchEgg` � captures `last_insert_rowid()` BEFORE `save()`, since `save()` resets it; also increments `hatched`). `v trade @user <id> [price]` transfers animals with confirm buttons (`db.transferAnimal` auto-removes from team slots).
- **Heist / race / tournament (v1.5.0):** `v heist <fee>` (crew joins, success roll, no house cut), `v race <fee>` (best pet vs others, pot split), `v tournament <fee>` (up to 16, bracket sim, winner 90% / house 10%). All use join buttons + 60s window, refund if <2 joiners.
- **Quests / bounties / vault (v1.5.0):** `v quest` daily + `v bounty` weekly (`quests`/`bounties` tables, progress via `addQuestProgress`/`addBountyProgress` hooked into hunt/sacrifice/work/give/battle; `double_quest` perk = 2x reward). `v vault deposit/withdraw` = per-guild shared pot (`vaults` + `vault_deposits`, withdraw only your own deposited amount).
- **Achievements / black market (v1.5.0):** `v achievements` + auto-unlock check hooked into `utils/commandHandler.js` after every command (19 in `db.ACHIEVEMENTS`). `v blackmarket` = 4 rotating slots refreshed every 6h (`db.refreshBlackMarket`), 6 item types.
- **Animal dex:** `v dex [rarity]` shows all 35 species bold=owned / struck=missing via `db.getOwnedSpecies`.
- **Insurance tiers (v1.5.0):** base `insurance` = 20% loss refund; shop upgrades `insurance2/3/4` = 30/40/50% (highest owned wins, `db.getInsuranceLevel`). Auto-applied in all games via `db.getInsuranceRefund`.
- **Streak / Wheel / Loans:** `v streak` = daily logon bonus, `STREAK_BASE` 5k/day scaling to day 7 (`streaks` table, resets after 48h, `claimStreak`). `v wheel <amt>` = weighted wheel, `SEGMENTS` in commands/wheel.js (EV ~0.99, pays via `payWin`). `v loan take|shark|pay` = bank loan 30% up to 2x (balance+bank) or loan-shark 50% up to 2M; winnings auto-repay via `payWin`'s loan logic.
- **Player-based clans (v1.7.1 rework):** clans are tied to a PLAYER, not a server � `v clan create` makes a clan owned by you (one clan per player, `clan_id` = owner's user id; one membership per player enforced by unique index on `clan_members.user_id`). `v clan join @member|name` to join anyone's clan across servers; `v clan leave/kick/deposit/withdraw/info/top/delete`. Old guild-scoped clan rows wiped once on boot via `notifications` key `clan_v2_wipe`. `CLAN_CREATE_COST` 5M.
- **Poker tournament:** `v pokertournament <buy-in>` � 9-seat 5-card showdown, join via button (60s), best hand wins the pot (90% / house 10%), entries feed the gambling `addGambled`, winner via `addBalance`. Hand evaluator in `pokertournament.js` (evalHand/compareHands).
- **Travelling merchant:** arrives every ~90 min (first **60 min** after boot), posts to **events channels only** (no fallback to update channels); `v merchant` shows 3 one-time slots (rare pet grab-bag + gems�10 + essence�25) with buttons `mer_<slot>` (`handleInteraction` routed from index.js). DB: `merchant_state` (next_at) + `merchant_stock` (slot, kind, label, price, sold_to, extra). Pets spawn owned by `MERCHANT_OWNER_ID = '__merchant__'` and transfer to buyer via `UPDATE animals`.
- **Checklists + seals + battle pass (v1.7.2):** `v checklist [weekly|claim]` = multi-task daily/weekly lists (`checklist_daily`/`checklist_weekly` tables; tasks hunt/battle/eggs/gamble/gems; rewards coins + **seals**). `seals` is a per-user currency (`users.seals`, `getSeals`/`addSeals`). `v battlepass` (`pass`/`bp`/`season`) = 14-day seasonal progression: XP earned from hunt/battle/hatch/sacrifice/give/work/gambled/wins/quest+bounty+checklist claims; 25 levels, free + premium track (unlock premium for `PASS_PREM_COST`=25 seals); rewards per tier via `passReward(level, premium)` = coins (+gems on premium, bonus seal every 5th premium tier). DB: `battlepass` (user_id, season, xp, premium, free_claimed, prem_claimed) + `pass_state` (current season number + ends_at, auto-rolls). Helpers: `currentSeason`, `addPassXp`, `passProgress`, `buyPassPremium`, `claimPassLevel`, `claimAllPass`, `passTop`. XP curve `passXpForLevel(level)=level*150`.

## Cards / UI
- Blackjack uses owo-style board: `Dealer [10+?]` + card back, `Name [19]` + cards (description embed, not field grid)
- Optional custom card art: `config.cardEmojis` map keys like `ah`, `10s`, `jh`, `cardback` ? `<:name:id>`
- Poker uses Discord suit emojis + rank; hold buttons show the card
- Keep game text clean � no AI-sounding fluff

## Host / single instance
- **Host: Render** (free web service, `plan: free` in `render.yaml`) � deploys from this repo via Blueprint. Auto-deploys on `git push` to `master`.
- **Do NOT run on Replit anymore** � stop the Replit repl (press Stop / `Aovo shutdown`) so there's no double instance. The `.gambot.lock` is per-machine, so two hosts = two bots = double responses.
- Free tier spins down after **15 min idle** ? keepalive pinger must keep hitting the Render URL (`https://gambot-o2o4.onrender.com`) every 4 min. It wakes on request (~30-50s).
- Data persistence: free tier has **no persistent disk** � `./data` is ephemeral. `GITHUB_TOKEN` env enables hourly backup + boot restore to `yhazmi170-jpg/gambot-data`. Without it, a fresh instance starts an empty DB (max ~1h of player data lost).
- `update.sh` is Replit-only legacy � **ignore it**. Deploy = `git push`.

## Restart / deploy
```bash
git add -A; git commit -m "..."; git push origin master   # Render auto-redeploys
# or in Discord: Arestart (if bot already online)
```

## Known issues / lessons (learned the hard way)
- **Replit free sleeps on tab-close; pings don't prevent it.** Only paid "Always On" or a different host fixes it. Do not move back to Replit free.
- **render.yaml + disk = paid instance.** Render free has no persistent disks; any disk in the Blueprint forces paid ($7.25/mo). Keep `plan: free` and NO disk. Data persistence on free = GitHub backup via `GITHUB_TOKEN`.
- **Blueprint reads render.yaml at creation time** � push render.yaml changes to GitHub BEFORE opening/refreshing the Blueprint, or the page shows the stale (paid) config.
- **`db.save()` / `backup.restore()` must mkdir the DB dir first** (already fixed). Any future code writing to `DB_PATH` must `fs.mkdirSync(path.dirname(...), { recursive: true })` or it ENOENT-crashes on a fresh box.
- **One-time announcements must NOT use flag FILES** � Render free FS is ephemeral, so `.notified_*` files vanish on every restart and the DM/announcement re-fires each boot. Use the `notifications` table (`db.wasNotified(key)` / `db.markNotified(key)`). This bit us: custom-role holders got re-DM'd on every restart.
- **Update announcements (v1.5.0 lesson):** the boot **DM** to the owner always fires with the update message on every restart (`index.js` � unconditional), but the **channel** posts only happen if the version isn't in the `notifications` table. The old ready-handler read channels from `client.channels.cache` (empty right after login) ? silently skipped ? then called `markNotified()` anyway ? the channel NEVER got the post while the owner still got the DM. Fix: fetch channels via `client.channels.fetch()` and only `markNotified` when `sent === channels.length` (`postUpdateAnnouncement` helper). `Aovo announce` force-reposts `update_msg.txt` to all update channels and now reports per-channel success/failure � use it to diagnose stale channel IDs.
- **Never swallow backup errors with `.catch(() => {})`** � a silently failing hourly backup looks fine while data goes unprotected (lost ~3h once). `index.js` logs `BACKUP FAILED` to console/bot.err. Check `gambot-data` commit timestamps if data seems at risk.
- **keepalive must actually be scheduled** � the .ps1/.vbs files do nothing until a scheduled task runs them. Registered task: `GambotKeepalive` (AtLogOn). Keep the ping interval under the host's sleep window (Render = 15 min, so 4 min is safe).
- **Secrets are gitignored on purpose** � never `git add` `config.json`, `gambot.db`, or `.env`. Render secrets come from env vars.

## Key Files
- `index.js` � entry, lock, HTTP ping server, lottery draw, interaction routing
- `intel.js` � passive 24/7 message intel: records guild msgs + DMs into an in-memory ring buffer; served to / pulled by the selfbot (discord-selfy) via `GET/POST /intel?key=` (optional `INTEL_KEY` auth). Memory-only (Render disk is ephemeral); the selfbot is the durable store.
- `config.js` / `config.json` � token + settings
- `backup.js` � GitHub backup/restore
- `db/index.js` � schema, CRUD, `getBalanceFactor`, `payWin`, essence/traits/autohunt/snail-garden functions
- `commands/shop.js` � shop prices + purchase flow
- `commands/hunt.js` / `sacrifice.js` / `upgrade.js` / `autohunt.js` / `autohuntbot.js` / `huntbot.js` / `garden.js` � hunting + OwO-style upgrades
- `commands/poker.js` / `blackjack.js` � card games
- `utils/commandHandler.js` � routing, TOS, cooldowns
- `utils/logger.js` � Discord logging
- `update.sh` � pull + kill for deploy
- `HANDOFF.md` � cross-tool session state (keep current)
- `keepalive.ps1` + `keepalive.vbs` � uptime pinger

## Update announcement policy (v1.5.0 rule)
- **Big updates** (new game / major feature / rework / bug that players noticed): bump `package.json` version + write `update_msg.txt` + push ? the boot announcement posts it once (gated by the `notifications` table).
- **Small updates** (minor fixes, tiny tweaks, internal changes): commit + push WITHOUT bumping the version and WITHOUT touching `update_msg.txt`. Instead append a one-line note to `pending_updates.txt`. Only when ~10 small updates have piled up (or the user asks), flush them all at once: merge into `update_msg.txt` as ONE combined log + one version bump + push. This keeps versions from jumping fast.
- The boot announcement only fires when `db.wasNotified('v<ver>')` is false � so small pushes with the same version stay silent automatically.

## Important
- `getMaxBet` returns Infinity for owner
- `getTop` excludes owner from leaderboard
- `addBalance` auto-creates users
- Restore only if DB file is missing/empty (not every restart)
- **EVERY PUSH (mandatory, do not skip):** bump `package.json` version, update `update_msg.txt` with a user-facing summary, verify new commands have `helpCategory` + `description` so they auto-appear in `v help`, update `gamehelp.js` when game rules/UI change, update `AGENTS.md` / `HANDOFF.md` if behavior or status changed. **Exception:** small updates skip the version bump + `update_msg.txt` and go into `pending_updates.txt` instead (see "Update announcement policy").

## Help (mandatory)
- `v help` auto-lists any command with `helpCategory` + `description` (+ optional `helpArgs`)
- **Always** set/update those fields when adding or changing a user-facing command
- **Always** update `commands/gamehelp.js` when a game�s rules, layout, or perks change (include aliases)
- Perk-only commands: add a line to `perkCmdMap` in `help.js` when relevant
- After help-related changes, mention it briefly in `update_msg.txt` if user-visible
