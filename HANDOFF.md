# Gambot handoff (Cursor ↔ OpenCode)

> Agents: rewrite this file when you finish a chunk of work or before the user switches tools.
> Read `AGENTS.md` first, then this.

## Status
- **Branch**: `master`
- **Version**: `1.4.2`
- **Last update_msg**: `v1.4.2 -- v help no longer crashes (too many pets commands · better layout) · v zoo now shows ALL your animals with ◀ ▶ page buttons (rarer pets sort first) · v blackjack now shows Hit/Stand buttons immediately`
- **Host migration**: Replit → Render (free, Blueprint from `render.yaml`). Replit repl was stopped by user. **Render URL: `https://gambot-o2o4.onrender.com`** — keepalive pinger repointed to it.
- **Keepalive**: `keepalive.ps1` pings every 240s; registered as Windows scheduled task `GambotKeepalive` (runs at logon). Pinger must be running on yazan's PC for this to work (now pinging the Render URL).

## Errors & trials (2026-08-06)
- [x] **Replit free tier sleeps on tab-close — pings don't help.** Reported: "close the tab → bot off after 5 min". Root cause: Replit free sleeps the repl ~5 min after the workspace closes; external HTTP pings do NOT prevent it anymore. Only Always On (paid) or moving hosts fixes this. Decided: move to Render.
- [x] **Pinger was never running.** `keepalive.ps1`/`keepalive.vbs` existed but had no scheduled task and no process — dead weight. Fixed: registered `GambotKeepalive` (AtLogOn) + started live.
- [x] **Ping interval race.** Old keepalive pinged every 300s = exactly Replit's 5-min sleep window → no margin. Lowered to 240s.
- [x] **render.yaml had a persistent disk → paid instance.** Render free tier does NOT support disks; a disk forces a paid instance ($7/mo + $0.25 disk = $7.25/mo). Removed the disk block, added `plan: free`.
- [x] **Blueprint read stale render.yaml.** The deploy page showed $7.25/mo because it loaded the OLD render.yaml (with disk) before the fix was pushed. Lesson: push config fixes BEFORE opening the Render Blueprint.
- [x] **Boot crash on fresh box (DB dir missing).** `db/index.js save()` and `backup.js restore()` did raw `writeFileSync` with no `mkdirSync` — with `DB_PATH` set on a fresh Render instance the parent dir doesn't exist → ENOENT → bot never logs in. Added `fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })` in both.
- [x] **Secrets check.** `config.json`, `gambot.db`, `.env` are all `.gitignore`d; only `config.example.json` is tracked (verified via `git ls-files`). Bot token stays out of the repo; Render uses `TOKEN` env var.

## Done recently
- [x] **v1.4.2 UI fixes (2026-08-06):** `v help` crashed with "an error occurred" because the Pets category exceeded Discord's 1024-char per-field limit — help now chunks long categories across multiple fields. `v zoo` only showed the first 10 of N animals (no pagination, worse-sorted) — now sorts by rarity (legendary → common) and adds ◀ ▶ pagination buttons (10/page). `v blackjack` buttons were only attached via a second `msg.edit` — now the initial deal message already includes Hit/Stand buttons so they can't be missing.
- [x] **v1.4.1 safety patch (2026-08-06):** `v sacrifice` / `v sell` accept `all`; one-time announcements moved from ephemeral flag FILES to the `notifications` table (`db.wasNotified`/`markNotified`) so the custom-role DM / version embed stop re-firing on every Render restart; backup errors now log loudly instead of silent `.catch`; `backup.js` rewritten to timestamped snapshots (`backups/gambot-<ts>.db`) + restore guard (only replaces a local DB OLDER than the newest snapshot).
- [x] **v1.4.0 OwO-style hunting build (2026-08-06):** gems are now hunt capacity (1 + 1 per 5 gems held, max 10) — `v hunt` uses your full capacity, no gem cost to multi-hunt; `v sacrifice <species|rarity> [count]` turns animals into essence (common 1 / uncommon 3 / rare 8 / epic 25 / legendary 100, skips team animals); `v upgrade <trait>` spends essence on hunt traits (Efficiency = rare+ weight, Gain = coins/animal, Radar = gem drop ×(1+0.5·lvl), Experience = xp/animal); `v autohunt [mins]` starts auto-hunting behind a math captcha (collector, 45s), grants 1 cycle/min and catch-up grants backlog even after bot sleep/offline; `v autohuntbot` upgrades it with essence (level → +1 animal/cycle, +15m max run, Bronze→Legend ranks); `v huntbot` is the OwO-style panel; `v garden` = snail garden (buy 500 coins, daily limit 20, breed 1/snail/24h up to 100 cap, sell 400 each). Gems+essence shown in `v bal`/`v zoo`/`v profile`/hunt embed; `v autoreact` with no args shows current emoji; `v sell` accepts species/rarity names + count.
- [x] Host migration prep: `render.yaml` free-safe (`plan: free`, no disk, `DB_PATH=./data`, `TOKEN` + `GITHUB_TOKEN` slots), DB-dir mkdir fix, docs synced, version bumped 1.2.22 → 1.2.23.
- [x] Keepalive fix — pinger wasn't running at all (no scheduled task / no process). Lowered interval to 240s, registered `GambotKeepalive` task, started it live.
- [x] Shop perks raised ~2x (v1.2.7) — custom_role 1.5M, rob 15M, double_work 6M, bet_cap 2M, lottery_ticket 7M, vip_games 8M, vip_role_sub 1M/mo, insurance 300k/mo, daily_cap 600k/mo, auto_react 1.5M, sponsored_footer 2.5M, rain 3M, duel 2M, colored_lb 750k, badge 500k, profile 600k, rep 300k
- [x] Poker UI cleaned (Unicode cards, no AI fluff)
- [x] Blackjack Unicode card emojis
- [x] Progressive economy on daily / weekly / work
- [x] Same factor on gambling wins via `db.payWin`
- [x] Shop perks ~35% more expensive (v1.2.1)
- [x] Docs: `AGENTS.md` + this `HANDOFF.md` kept in sync
- [x] Poker/blackjack → Discord suit emojis
- [x] Blackjack owo-style board (`Dealer [10+?]`, cardback, `Name [total]`)
- [x] Help descriptions on all cmds + gamehelp poker/bj + standing “always update help” rule

## Next / open
- [x] Confirm bot live on Render — DONE (`logged in as ovo#7700`), v1.3.0 deploy pushes update embed
- [x] Repoint `keepalive.ps1` URL — DONE (`https://gambot-o2o4.onrender.com`), pinger restarted
- [ ] Confirm v1.4.2 deploy live on Render (update embed in `v version`)
- [ ] **Restore friend's lost ~30m** (`554257220523655199`, @伤害): live bal was 2,445,528 (10:06Z snapshot); last good snapshot `1802448` (2026-08-05T22:50:48Z) = 32,220,527. Restore via `Aovo add @伤害 <diff>` AFTER the fix deploy (so a fresh snapshot protects it). Diff from live-as-of-10:06Z: 32,220,527 − 2,445,528 = **29,774,999** (recheck current bal before adding — target 32,220,527).
- [ ] **Do NOT restart the Replit repl** (double instance = double responses)
- [ ] "Self react" report from user is still unexplained — user hasn't described the exact symptom yet; last known: `auto_react` perk reacts with the user's set emoji or ⭐ (index.js:183-187), autoreact costs 1.5M in shop.

## Agent prefs (Cursor)
- Elite coding bar + OpenCode-style compact via `~/.cursor/rules/elite-compact.mdc`
- Hooks: `~/.cursor/hooks.json` (sessionStart / preCompact warn / stop handoff nudge)
- CLI statusline warns at 70%+ / 85%+ context
- Plan billing usage: check Cursor Settings → Usage (agent cannot meter it live)

## Notes for next agent
- Address user as **bro**
- Prefer Run-button deploy; don’t fight Shell + Run + `.gambot.lock`
- Owner `536278876247162882` is exempt from balance factor and bet cap
- After any behavior change: bump version, `update_msg.txt`, push, refresh this file + `AGENTS.md`
- OpenCode Claude Fable adapter installed at `~/.config/opencode/plugins/` + `reference/`
- Cursor port of that style: `~/.cursor/rules/claude-fable-adapter.mdc` (alwaysApply)
- Compact plugin (OpenCode): `~/.config/opencode/plugins/compact-like-opencode.ts`
