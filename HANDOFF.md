# Gambot handoff (Cursor ↔ OpenCode)

> Agents: rewrite this file when you finish a chunk of work or before the user switches tools.
> Read `AGENTS.md` first, then this.

## Status
- **Branch**: `master` @ `82b0929`
- **Version**: `1.2.2`
- **Last update_msg**: High balances get slightly smaller gambling wins (same curve as daily/work)

## Done recently
- [x] Poker UI cleaned (Unicode cards, no AI fluff)
- [x] Blackjack Unicode card emojis
- [x] Progressive economy on daily / weekly / work
- [x] Same factor on gambling wins via `db.payWin`
- [x] Shop perks ~35% more expensive (v1.2.1)
- [x] Docs: `AGENTS.md` + this `HANDOFF.md` kept in sync

## Next / open
- [ ] User still needs to deploy on Replit: `bash update.sh` then **Run** (or `Arestart`)
- [ ] Confirm bot is on latest (`v version` / DM restart message)

## Notes for next agent
- Address user as **bro**
- Prefer Run-button deploy; don’t fight Shell + Run + `.gambot.lock`
- Owner `536278876247162882` is exempt from balance factor and bet cap
- After any behavior change: bump version, `update_msg.txt`, push, refresh this file + `AGENTS.md`
