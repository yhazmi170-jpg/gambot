# Gambot handoff (Cursor ↔ OpenCode)

> Agents: rewrite this file when you finish a chunk of work or before the user switches tools.
> Read `AGENTS.md` first, then this.

## Status
- **Branch**: `master`
- **Version**: `1.2.23`
- **Last update_msg**: Moved to a faster, more reliable host. Uptime should be way better now.
- **Host migration**: Replit → Render (free, Blueprint from `render.yaml`). Replit repl was stopped by user. Keepalive pinger needs repointing to the Render URL once the service is live.
- **Keepalive**: `keepalive.ps1` pings every 240s; registered as Windows scheduled task `GambotKeepalive` (runs at logon). Pinger must be running on yazan's PC for this to work (Render URL once deployed).

## Errors & trials (2026-08-06)
- [x] **Replit free tier sleeps on tab-close — pings don't help.** Reported: "close the tab → bot off after 5 min". Root cause: Replit free sleeps the repl ~5 min after the workspace closes; external HTTP pings do NOT prevent it anymore. Only Always On (paid) or moving hosts fixes this. Decided: move to Render.
- [x] **Pinger was never running.** `keepalive.ps1`/`keepalive.vbs` existed but had no scheduled task and no process — dead weight. Fixed: registered `GambotKeepalive` (AtLogOn) + started live.
- [x] **Ping interval race.** Old keepalive pinged every 300s = exactly Replit's 5-min sleep window → no margin. Lowered to 240s.
- [x] **render.yaml had a persistent disk → paid instance.** Render free tier does NOT support disks; a disk forces a paid instance ($7/mo + $0.25 disk = $7.25/mo). Removed the disk block, added `plan: free`.
- [x] **Blueprint read stale render.yaml.** The deploy page showed $7.25/mo because it loaded the OLD render.yaml (with disk) before the fix was pushed. Lesson: push config fixes BEFORE opening the Render Blueprint.
- [x] **Boot crash on fresh box (DB dir missing).** `db/index.js save()` and `backup.js restore()` did raw `writeFileSync` with no `mkdirSync` — with `DB_PATH` set on a fresh Render instance the parent dir doesn't exist → ENOENT → bot never logs in. Added `fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })` in both.
- [x] **Secrets check.** `config.json`, `gambot.db`, `.env` are all `.gitignore`d; only `config.example.json` is tracked (verified via `git ls-files`). Bot token stays out of the repo; Render uses `TOKEN` env var.

## Done recently
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
- [ ] Deploy on Render: Blueprint from `render.yaml`, set `TOKEN` + `GITHUB_TOKEN`, hit Deploy (should show **free**, NOT $7.25/mo)
- [ ] After deploy: confirm bot live (`v version` / DM restart message)
- [ ] Repoint `keepalive.ps1` URL from `gambot--yhazmi170.replit.app` → `https://gambot.onrender.com`
- [ ] **Do NOT restart the Replit repl** (double instance = double responses)

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
