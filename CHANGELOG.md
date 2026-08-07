# Gambot Changelog (full history)

Complete list of every update shipped, newest first. Source: git history (`master`) + release notes + `HANDOFF.md` session logs.

---

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