# Gambot handoff (Cursor ↔ OpenCode)

> Agents: rewrite this file when you finish a chunk of work or before the user switches tools.
> Read `AGENTS.md` first, then this.

## Status
- **Branch**: `master`
- **Version**: `1.2.5`
- **Last update_msg**: Help + gamehelp updated for all games

## Done recently
- [x] Poker UI cleaned (Unicode cards, no AI fluff)
- [x] Blackjack Unicode card emojis
- [x] Progressive economy on daily / weekly / work
- [x] Same factor on gambling wins via `db.payWin`
- [x] Shop perks ~35% more expensive (v1.2.1)
- [x] Docs: `AGENTS.md` + this `HANDOFF.md` kept in sync
- [x] Poker/blackjack → Discord suit emojis (`A♠️` style) + card on hold buttons
- [x] Blackjack owo-style board (`Dealer [10+?]`, cardback, `Name [total]`)
- [x] Help descriptions on all cmds + gamehelp poker/bj + standing “always update help” rule

## Next / open
- [ ] User still needs to deploy on Replit: `bash update.sh` then **Run** (or `Arestart`)
- [ ] Confirm bot is on latest (`v version` / DM restart message)

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
