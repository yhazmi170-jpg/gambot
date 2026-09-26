# Gambot Changelog (full history)
## v2.0.5 — Bot usage analytics (`v activity`)

- **NEW `v activity`** (`aliases: usage, analytics`) — cross-user usage boards built on the existing `user_feature_usage` tracking (every command already records its name per user). Subcommands: `v activity` (overview with active-today/week + top users/gamblers/winners), `v activity users|active|mostactive` (users by total commands + distinct features), `v activity gamble|gambled` (total wagered), `v activity wins|won` (total won), `v activity commands|cmd|used` (most-used commands bot-wide). Owner excluded from all boards (mirrors `v lb`).
- **New DB helpers** in `db/index.js`: `getTopCommandUsers(limit, exclude)`, `getMostUsedCommands(limit)`, `getTopWinners(limit, exclude)`, `getActivitySummary()` (active today / this week / total commands / total users), shared `capLimit(1..20)`.
- **Tests**: `scripts/test-activity.js` (16/16 — ranking, owner exclusion, caps, summary) and `scripts/test-activity-cmd.js` (18/18 end-to-end render via stub). Verified no regression: full suite matches baseline (5 pre-existing Node-26 failures untouched).
- **No data risk**: purely read-only aggregation over usage counters; no migration, no schema change.

## v2.0.4 — Leaderboard counts unclaimed inbox money + empty-giveaway refund

- **`v lb` / `db.getTop` count pending inbox deliveries** (wallet + bank + unclaimed inbox money): giveaway prizes and `v give` transfers land in the recipient's inbox as pending until claimed, and the board previously showed the stale old total for hours/days — users saw "won 100m but not on lb" or "gave 25m but shows 18m". The money was never at risk (`safeClaim` refund/cancel bonuses keep it from dropping), it was purely a display gap. `commands/slb.js` (server lb) updated to match. Regression test in `scripts/test-leaderboard.js` (8/8).
- **Empty giveaways now refund the host in full** — Phase-1 sweep in `index.js` returned early on 0-entry giveaways without reimbursing the hostCost (split = prize, full = prize × winners); hosts silently lost the whole pot if nobody clicked join.
- **sql.js long-uptime crash recovered** (2026-09-25 ~05:20–11:02Z): after ~3 days of uptime the in-memory sql.js WASM module started throwing `RuntimeError: memory access out of bounds` on every query, freezing the DB at the 05:40 backup; backups stalled (5-min cadence) and commands failed for ~6h. Redeploy restored the latest healthy snapshot (749 users, hash `cc47bd43…`), no player data lost beyond the corruption window. Backups resumed (`11-07-09` snapshot onward, hash `fdc2947a`).

## v2.0.3 — Social GIF Expansion

- **Dedicated GIF pools** for all social commands: bonk, facepalm, tease, wave, poke, tickle, blush, cry, laugh, dance, stare — hand-curated from verified anime-reaction database
- **kill** gets standalone pool (4 clips) instead of reusing punch category — resolves “kill reuses punch” complaint
- **22 dead GIF URLs removed** from production — all HTTP 404 at GitHub; bot will never randomly select a broken link
- **Preserved** all existing approved GIF pools (hug, kiss, slap, pat, cuddle, bite, punch, lick)
- **Contact sheets generated** under `~/.agents/reports/socialgifs-review/new/` with numbered manifests for each action
- **test-social.js** updated to validate 21 social actions (was 9); **test-try.js** passes 13/13
- **Fixed** duplicate `nowSec` declaration in commandHandler.js (Node.js v26 compatibility)

## 2.0.2 - Lucky cleanup and summon system (pending deploy)

Complete list of every update shipped, newest first. Source: git history (`master`) + release notes + `HANDOFF.md` session logs.

---

## v2.0.1 — Multi-Winner Giveaways + Inbox Payouts

- **Multi-winner giveaways:** `v giveaway <time> <prize> <winners> <split|full>` (up to 50 winners). `split` divides the pot across winners (`100m 10 split` = 10m each); `full` gives every winner the whole prize (`100m 10 full` = 100m each). Defaults to `split` when a winner count is supplied. The original `v giveaway <time> <prize>` 1-winner syntax is unchanged.
- **Correct host economics:** split charges the pot; full charges prize × winners. Underfilled giveaways refund unused slots (full) or leftovers (split) to the host.
- **Unique winner drawing:** winners are drawn without replacement; the final embed lists up to 10 winners (+N more) and points winners to `v inbox`.
- **Inbox delivery:** giveaway prizes are created as `giveaway` inbox deliveries (`db.createDelivery`) so winners claim via `v inbox` / Claim All instead of being credited instantly. `giveaway` added to `INBOX_SOURCES` and the inbox 🎉 marker.
- **Schema:** `giveaways` gains `winner_count` + `mode` columns (additive migrations, existing rows default to 1 / `split`).
- **Tests:** `scripts/test-giveaway.js` — 19/19 passing (migration, persistence, split/full math + refunds, inbox delivery/claim, unique draws).

## v2.0.0 — Social Commands + `v try` + Community Events + Server Lore (big update)

- **NEW social command family (`v hug/kiss/pat/slap/cuddle/bite/punch/lick`):** each posts a real 2D-anime GIF clip matched to the action from a verified pool (82 clips live-checked at build time), replies charmingly to a mentioned target, and reacts once with an action emoji. A self-line plays when no target is mentioned (`v hug` alone). Reaction permission failures never drop the GIF (`utils/social.js` `safeSelfReact`). Tied into stats/titles: `social_used` feeds `cuddle bug` (1) + `influencer` (5) titles. **Caution flag:** `v kill` uses 4 verified non-graphic comedic stand-ins (punch-category clips) instead of true defeat kills — flagged as unfinished content polish; quality-over-quantity, a real pool is planned later.
- **NEW silly justice system (Fun):** `v case [@user]` opens a legally-fictional case file (occupation, record from REAL harmless Gambot stats, suspected crime, evidence); `v judge [@user]` passes a non-binding sentence (counts `judged`, unlocks hidden 🕵️ "Alright What Is Going On"); `v compare [@user]` pits two players' real stats against certified commentary. Never appearance/intelligence-sensitive.
- **NEW server lore:** `v incidents [n]` (aliases `lore`/`history`/`eventslog`) shows the guild's light rolling history — achievements, titles, raid resolutions, giveaway wins, community events. Capped at 60/guild, stores event text only, never message content.
- **NEW `v try` (recommendation engine):** recommends what you have NOT done — never-tried features, must-act contexts (unclaimed quest/bounty, unhatched eggs, inbox deliveries), gaps (dex completion, marriage, clan, pets without battle team), stale features, live community events. `v try list` = full 43-feature tracker with ✨/✔️; `v try tip` = mechanic tips with numbers derived from real runtime constants (hunt cost 5/animal, egg drop 8%, weapon crate 15k, insurance tiers, balance factor floor, etc.). Zero gambling-behavior targeting.
- **NEW community events (rare, non-gambling):** auto-starts up every 4h — The Button (`v button`, $2500 reward ramping every 5th press), Roll Call (`v here`, 1500), Creature Sighting (`v creature`, 2500 + wanted mark), Quest Rush, Double Pet XP. Each unlocks a hidden achievement (🔘 The Button, 🫡 Roll Call Veteran, 🚨 Wanted).
- **NEW rare proactive summons:** if a user has been generally inactive 3+ days, Gambot may DM one gentle nudge (max 3 per 30 min globally) — `v summon off` opts out permanently per-user; never based on gambling activity.
- **NEW `v new`:** "what's new in this release" overview + search.
- **NEW update-DM rollout:** the 2.0 announcement is delivered to every player who opted into DMs, one-time-only, tracked in `update_dm_delivery` (sent/failed, batched, persisted so it can never re-fire after restart). Failed/open DMs are retired, not retried forever.
- **Profile stat card expanded** (`v profile`): level/xp, pets+team, bank, eggs & seals, battle wins, daily streak, lucky status, insurance tier, free bet, credit score, loan/clan/plot/jail (when active), member since.
- **Credit-score bug fixed:** profile showed a raw timestamp (wrong column). `ensureUser` now maps by column name; jail state + rob-cooldown reads fixed.
- **8ball expanded:** 45 → 120 diabolical/casual answers, compact reply quoting your question (auto-truncate), one vibe-matched self-reaction (😭/☠️ etc.), never random.
- **`v give` to owner:** owner gets a DM approval card (Keep / Decline / Mute 30m); money moves only on confirm. Owner-only feature.
- **Alias cleanup (zero collisions):** `market` → shop; `stats` → profile; `wheel`/`spin` → wheel; `snailgarden` → snailgarden command; `blackmarket` → `bm`. Roulette drops the ambiguous `wheel` alias; slots drops `spin`; animal drops `stats`; garden drops `snailgarden`; blackmarket self-alias removed. gamehelp alias lists synced.
- **Stale mechanic text fixed:** help no longer claims rob is 50/50 (real: 30% success / 20% steal capped 3M) or that balance cuts "cap at 30%" (real: per-500k 1%, floor at 40% payout). AGENTS.md insurance tiers corrected to 10/15/20/25%.
- **`v gamehelp` new entries/aliases** for the Fun commands and event commands; `v help` bucket & command count refreshed.

---

## v1.8.1 — Coinflip clarity fix

- **Coinflip reply now shows the player's pick AND the landed side** (`🪙 picked **heads** — landed **tails** — lost **100**`). Root cause of the "tails always loses / it ignored my heads pick" reports: the old reply only printed the **landed** side (`🪙 **heads** — ...`), so every loss looked like the bot had switched the player's selection. The RNG and settlement were always correct (`result === side`); only the display omitted the choice. Fixed in `commands/coinflip.js`; help text in `commands/gamehelp.js` now states the amount-first syntax and picked/landed display.
- **Coinflip win amount corrected**: old reply printed `won amount+paid` (double-counting the stake, e.g. "won 200 (+100)" for a 100 bet whose real credit is 100); now prints the real credited amount, matching dice/roulette.
- Added integration/regression test `scripts/test-coinflip.js` — drives the real command handler (prefix → alias → args → wager parse → side parse → forced RNG → settlement → reply) through all four logical outcomes plus lucky mode, against a throwaway `/tmp` DB.

## v1.8.0 — Pet Weapons

- **NEW weapon system (OwO-style, adapted to Gambot's battle loop)**: `v weaponcrate` (buy 15k / open), `v weapon` (list/equip/upgrade). 8 weapon types — Great Sword (splash all), Poison Dagger (3-turn DoT), Flame Staff (burn DoT), Vampiric Staff (lifesteal), Healing Staff (heal weakest teammate), Defender Aegis (DEF lean + taunt draw), Bow, Rune of Power (balanced ATK/DEF). 7 rarities (common→fabled) with quality % scaling; weapons add flat ATK/DEF on top of trait/fed % modifiers.
- **Drops**: weapon crates drop ~8% (`WEAPON_BATTLE_DROP_CHANCE`) per animal from `v hunt` and on `v battle` wins. Shop has a `Weapon Crate` item.
- **DB**: new tables `weapons_inv`, `animals_weapon` (animal→weapon), `weapon_crates`; helpers `openWeaponCrate`, `getWeaponInv`, `getWeapon`, `equipWeapon`, `getAnimalWeapon`, `upgradeWeapon`, `weaponUpgradeCost`, `weaponBattleMods`. Weapons only equip on battle-team pets.
- **Team display**: equipped weapons show in `v team` (`· ⚔️ Great Sword Lv.1`).
- **Help/docs**: `v help` auto-lists both commands (helpCategory Pets); `v gamehelp weapon` + `v gamehelp weaponcrate` added.

## v1.7.9 — Lucky perk toggle + UI polish

- **NEW `v lucky` (player-facing)**: self-service toggle for the lucky perk — 90% coinflip win rate with 3× payouts while on (see `commands/lucky.js`). Powered by the existing `users.lucky` column + `db.toggleLucky` (was previously owner-set only). `v help` auto-lists it; coinflip tips in `gamehelp.js` now mention the toggle.
- **`v rob` shop desc corrected**: now reflects the reworked mechanics — 30% chance to steal 20% (max 3M) / 70% chance you lose 20% (max 3M) + 30m jail + insurance downgrade + -50 credit. The old text still described the legacy 50/50 odds.
- **Custom role polish**: success messages now carry 🗑️/✅/🎨 emojis.

## v1.7.8 — Rob rework (shipped via deploy churn; docs synced 2026-09-05)

- **Rob nerf**: `v rob` now 30% success — steal 20% of target up to 3M; on failure you lose 20% up to 3M, get 30m jail, insurance downgrade, and -50 credit (commit dd10226).
- **Rob cooldown persisted to DB** so it survives restarts; fixed a duplicate variable declaration crash (commit 1c91378).
- **Misc fixes**: `v bal` now shows bank balance, slots fixed silent +0 payout, `v sacrifice <id>` lookup fixed.

---

## v1.7.6 — Bet cap rework + explicit-bet enforcement

- **Max bet capped at 2M everywhere**: removed `bet_cap_4` (5M) and `bet_cap_5` (10M) tiers from `getMaxBet` and the shop. `getMaxBet` top tier is now `bet_cap_3` (2M).
- **Bet caps now enforced on explicit amounts too** (bug fix): previously only the `all` keyword capped bets, so `v blackjack 10000000` bypassed the cap entirely. Added `db.parseBet(userId, input)` and switched blackjack, coinflip, crash, dice, poker, roulette, slots, snailgarden, wheel to it (mines already had its own cap check). Numeric bets above the cap now get rejected with the `max bet is X — upgrade with bet cap perks` message.
- **One-time migration `bet_cap_cleanup_v1`**: on boot, holders of removed `bet_cap_4`/`bet_cap_5` are fully refunded (20M / 50M) and promoted to `bet_cap_3`. Idempotent (guarded by `notifications` table).
- **Selfbot health alert spam fix (owner-only, no version bump in that commit)**: `selfbotWatch.js` now only reports a "new deploy" when the selfbot VERSION actually changed, and every alert type has a 6h cooldown. Same-version uptime resets no longer DM the owner (was spamming every ~30 min).

---

## Intel sync (internal, no version bump)

- **24/7 passive message intel**: `intel.js` records every guild message + DM the bot sees into an in-memory ring buffer (dedup by message id, 20k cap, 24h prune). The selfbot (`discord-selfy`) pulls it via `GET /intel?since=<ts>&key=...` every ~2 min and merges it into its big-brother tracker (alt-link detection, last moves, co-presence), and pushes its own events back via `POST /intel` so both sides share the same feed.
- **Auth**: optional `INTEL_KEY` (env or `config.intelKey`) — `/intel` returns 403 without the right `key` param. Unset = open (local only).
- **Ephemeral by design**: Render free tier wipes `./data` on deploy, so the buffer is memory-only; the PC selfbot is the durable store.

## v1.7.5 — Corruption Fix & Cleanup

- **Economy corruption resolved**: drained balances restored (@极极 84M, @meimei 41M, @Aruh 50.7M, @nini 8.7M, @Claire 2.3M, @apzz 2.2M). Two exploit alt accounts deleted.
- **Backup system rebuilt**: switched to fresh `gambot-data-v3` repo after old backups were corrupt. New `detectCorruption` guard catches absurd balances (>1T), negative balances, and wiped-user states.
- **Owner bypass**: you can now use disabled commands on any prefix (v/ovo), not just `A`. "Disabled in this channel" vs "disabled in this server" now shows the correct scope.
- **Merchant interval**: first arrival is now 60min after boot (was 5min) to prevent spam on every deploy.
- **DM on boot**: bot always DMs you when it finishes starting up.
- **Update announcements**: marked v1.7.4 as notified to stop re-posting on every boot.

## v1.7.1 — Bounties & Fixes
- Player-funded PvP bounties: `v bounty create @player <goal> <amount>` — fund a prize, first to the duel-win goal takes the pot; `v bounty list|info|cancel`; duel wins show live progress and auto-pay the winner (7-day expiry refunds the poster)
- `v wheel <amount>` — weighted wheel of fortune, x0 → x10 jackpot, ~1.3% house edge, timeout refunds
- `v streak` — daily logon streak bonus scaling to day 7 (`streaks` table, 48h grace, refund-reset rules)
- `v loan take|shark|pay` — bank loan (30%, max 2x balance+bank) and loan-shark (50%, up to 2M); `payWin` auto-repays loans (backend existed, command was missing)
- `Aovo events #channel` — dedicated channel for random server events (falls back to update channels); event announcements show real duration
- Random events expanded 4 → 15 (Hot Streak, Gem Bonanza, Geode Storm, Hatch Madness, Essence Flood, Double Payday/Payday Plus boost daily+weekly via `rewardMult`)
- Mines fix: 4th row only had 3 tiles (cell 15 unclickable) → proper 4x4 with dedicated cash-out row; unplayed games now refund the bet (5 min window) instead of silently eating it
- Giveaways persisted to DB + background sweep always draws/pays/announces a winner even after a restart (the "no winner" bug)
- `v zooshop buy` matches multi-word item names (`flower garden` → garden)
- PvP battle 'your team is empty' fix (accept flow was reading the bot's team)
- Owner boot-DM now fires once per version instead of on every restart

---

## v1.7.0 — The Pet Evolution Update
- Loot crates: `v crate <common|premium|mythic>` with a per-user **pity counter** that guarantees a top-rarity drop
- Free bets: `v freebet [amount]` — claim 500 free house coins/day, cap 2500; lose = house money, win = real coins
- Clans: `v clan create|join|leave|info|deposit|withdraw|kick|top` — 5M to create, 20 members, shared treasury
- Boss raids: `v raid <stake>` — server-wide boss, stake adds to the pot, split by damage on the kill
- Auctions + bidding: `v auction <id> <min> [hours]` / `v bid <id> <amount>` — 5% fee, 5% min increment
- Plots: `v plot buy|upgrade|claim` — own land paying coin income every hour
- Evolutions: `v evolve <id>` — next rarity for essence (v2 lvl 10+, +15% stats)
- Pet feeding: `v feed <id>` — +10% battle buff for 2 hours
- Pet fusion: `v fuse <id1> <id2>` — merge two into one stronger pet (100k, mythic excluded)
- Family tree: `v family` — partner, parents, kids
- Zoo decor shop: `v zooShop` — decorations shown at the top of your zoo
- **Shiny pets** (1/200, sell for 2x) + **MYTHIC tier** (Odin, Tiamat, Bahamut, Cthulhu, Godzilla)
- 20+ new species (Otter, Penguin, Capybara, Jaguar, Sphinx, more)
- Pet personalities: Brave / Chill / Eager / Lucky / Calm — small battle edges
- Random server events: Gold Rush (+25% wins), Lucky Hour (x2 gems), Egg Mania (x2 eggs), Essence Surge (x2 sacrifice)
- Loss streak protection: lose 5+ in a row → losses start refunding extra
- Vaults earn 0.4% interest per hour
- Married bonus: +10% on daily / weekly / work
- Pet achievements (first battle, level milestones, evolutions, fusion, shinies)
- `v dex` now tracks the full collection including mythic
- Fix: PvP battle accept-button read the bot's team instead of the challenger's → "your team is empty" (`1697cba`)

## v1.6.2
- `Aovo transfer @old @new` — move ALL of a user's data onto another account (used for banned-account migrations)
- Joke line in the update message

## v1.6.0 —  The Music Update + July fix batch
- Music command: `v play <YouTube/Spotify link/name>`, queue, `v per-channel disable/enable`
- Battle requests survive restarts (DB-persisted `pending_battles`)
- Fix `v team add` wiping slots 2/3
- Per-channel command disable / enable
- Dig Commands now disable always-usable
- Slave triple-7 jackpot flair; help paginated like the shop (category buttons)
- `v rob` DMs the victim (successful + failed attempts)

## v1.5.0 — heist / race / tournament / quests / vault / achievements / black market wave
- Wave 1: stocks market (`v stocks market/buy/sell/port`) + loan shark (`v bank shark`)
- Wave 2: pet eggs (`v hatch`, 8% drop in hunt + autohunt) + pet trading (`v trade @user <id> [price]`)
- Wave 3+4: heist (`v heist`), pet racing (`v race`), daily quests (`v quest`), weekly bounties (`v bounty`), clan vault (`v vault`)
- Wave 5: achievements (`v achievements`, auto-unlock + payouts) + black market (`v blackmarket`, 4 rotating slots / 6h) + shop revamp (category nav buttons)
- Wave 6: tournament brackets (`v tournament <fee>`, winner 90% / house 10%)
- Custom role bug fixes (positioning, name/color subcommands, stale-role recreate)
- Animal dex (`v dex` + `db.getOwnedSpecies`)
- Crash/mines fairness transparency — real effective multiplier shown after balance cut (`db.effectiveMult`)
- Insurance tiers (30 / 40 / 50% loss refund) + `egg_luck` / `double_quest` perks
- gamehelp entries for all new games; version bump 1.4.7 → 1.5.0

## v1.4.7
- Giveaway command (`v giveaway <prize>` — entry button + random winner)
- `v autoreact remove` / `off` / `clear`
- `v zoo green`, `v sacrifice say/no` color shortcuts

## v1.4.6 — fix batch
- Battle requests stuck on "expired" — `_yes/_no` suffix strip + 60s window
- `wasNotified` / `markNotified` were missing from exports — fixed update announcements
- auto-react resolves `<:name:id>` / custom emojis + error logging

## v1.4.5
- Restore scans ALL snapshots newest→oldest, first with >0 users (skips bad/empty backup)

## v1.4.4
- Never back up or restore an empty / corrupt DB; backups every 1 min

## v1.4.3
- Backup on shutdown (SIGTERM/SIGINT) + every 10 min; level-up embed pings the user

## v1.4.2
- Fix `v help` crash (1024-char field limit — categories chunked)
- `v zoo` pagination + rarity sort
- Blackjack buttons on the initial deal

## v1.4.1
- `v sacrifice` / `v sell` accept `all`
- DB-backed one-time announcements (notifications table) — no restart re-fires
- Hardened snapshot backups + loud errors

## v1.4.0 — OwO-style hunting
- Gems = hunt capacity (1 + 1/5 gems, cap 10) — multi-hunt
- `v sacrifice <species|rarity|all>` — essence (1 / 3 / 8 / 25 / 100)
- `v upgrade <trait>` — efficiency / gain / radar / experience
- `v autohunt [mins]` + `v autohuntbot` (essence upgrades, Bronze→Legend)
- `v huntbot` panel + `v garden` snail garden

## v1.3.0
- Moved to new host (Render) for better uptime

## v1.2.x series (economy + UI + reliability)
- v1.2.23 — migrate hosting to Render(free): `plan: free`, db-dir mkdir fix, keepalive 240s
- v1.2.22 — battle requires the opponent to accept (Fight/Cancel buttons)
- v1.2.21 — gems economy, multi-hunt (`v hunt <n>`), gem drops
- v1.2.20 — battle renders retro pixel-art screen (sprites, HP bars, stats)
- v1.2.19 — battle shows real pet images + health bars (owo style)
- v1.2.18 — fix `v team add` crash when no team exists
- v1.2.17 — disabled commands always pass (no lockout)
- v1.2.16 — disabled commands send an auto-deleting notice
- v1.2.15 — supervisor-based restart widget (no orphaned process), crash log to `bot.err`, mines bet refund
- v1.2.14 — `grantXp` wrapped in try/catch (leveling can't crash)
- v1.2.13 — user level system with xp + rewards
- v1.2.12 / 11 — mines button labels + embed fix, real crash odds
- v1.2.10 — `v team add` by species/name
- v1.2.9 / 8 — mines visual tiles (blank / dark)
- v1.2.7 — shop perks ~2x more expensive
- v1.2.6 — admin cmds (`Acmds`), economy balance factor, insurance refund, profile gate, leaderboard badge

## v1.2.0 / split-era
- Atomic lock file (single instance), video poker VIP game, Arestart fix, split logging (shop log + cmd log)
- Blackjack owo-style board + custom card emojis; poker/blackjack Discord suit emojis
- Progressive VIP action: betting each 500k balance → +1% reduction on wins/daily/weekly/work (capped)

## v1.1.x series
- v1.1.6 — fix help display, owner unrobbable, shop log fetch fallback
- v1.1.5 — presence shows version + random tips for owner
- v1.1.4 — Asrestart git pull + restart, DM owner on restart/startup
- v1.1.3 / 1.1.2 — update_msg fixes + bump
- v1.1.1 — semver fixes; v1.1.0 — banking system (deposit/withdraw/loans)

## v1.0.x (early pet economy + core)
- Pet system: hunt, zoo, team, battle, sell, rename
- Bank + loans (`v bank`)
- Give, rob, rain, duel, gamble games (coins/int, blackjack, slots, crash, mines, roulette, dice, lottery, video poker)
- Badge/leaderboard customization (`v setbadge`, `v setlb`)
- Custom roles (`v customrole name | #color`)
- Gamehelp + auto-built help

## v0.x — founding
- Initial commit: command handler, config, a single Hunting + pet system, GitHub auto-backup, the HTTP uptime server
- Later: reward command, per-owner DM banner, custom emojis, repeal; economy balance factor, buy scaling of wins

---

> Low-level work and infra-only tweaks are omitted below the listed versions; everything user-facing or gate-affecting is here.