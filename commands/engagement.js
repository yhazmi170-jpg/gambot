const config = require('../config');
const db = require('../db');
const { embed, error } = require('../utils/embed');
const { TIERS, wealthTier } = require('../utils/reEngagement');

const DAY = 86400;

module.exports = {
  name: 'engagement',
  helpCategory: 'Admin',
  helpArgs: '@user|stats',
  description: 'proactive-DM diagnostics (owner only)',
  aliases: ['eng', 'engage', 'reengage'],
  execute(message, args) {
    if (message.author.id !== config.ownerId) return;
    const mode = (args[0] || '').toLowerCase();
    if (mode === 'stats') return showStats(message);
    const target = message.mentions.users.first() || (args[0] || '');
    const uid = (target && target.id) || String(target || '');
    if (!uid) return message.channel.send({ embeds: [error('mention a user or give an id — `Aengagement @user` / `Aengagement stats`')] });
    return showUser(message, uid);
  },
};

function fmt(ts, now) {
  if (!ts) return 'never';
  const d = Math.floor((now - ts) / DAY);
  if (d < 1) return `${Math.floor((now - ts) / 3600)}h ago`;
  return `${d}d ago`;
}

function showStats(message) {
  const s = db.getReengageStats();
  return message.channel.send({ embeds: [embed('📊 Re-engagement stats', [
    ['Tips DMs', `${s.tipsGiven}`],
    ['Inactivity return DMs', `${s.returnDms}`],
    ['Return gifts generated', `${s.comebackGrants}`],
    ['Surprise gifts generated', `${s.surpriseGrants}`],
    ['Gifts claimed', `${s.claimedGifts}`],
    ['Proactive-DM failures', `${s.dmFailures}`],
    ['', 'no DM contents shown, numbers only'],
  ], 0xfee75c)] });
}

function showUser(message, uid) {
  const now = Math.floor(Date.now() / 1000);
  const u = db.ensureUser(uid);
  const act = db.getActivity(uid) || {};
  const st = db.getReengageState(uid) || {};
  const prefs = db.getNotifyPrefs(uid);
  const pending = (() => { try { return db.getPendingDeliveries(uid, 5).find(d => d.source === 'comeback') || null; } catch { return null; } })();

  const lastMeaningful = act.last_meaningful_at || 0;
  const idleDays = lastMeaningful ? (now - lastMeaningful) / DAY : null;
  const row = { status: 'active' };
  let tierSummary = 'none eligible';
  if (idleDays !== null && idleDays >= 7) {
    let t = null;
    for (let i = TIERS.length - 1; i >= 0; i--) if (idleDays >= TIERS[i].days) { t = TIERS[i]; break; }
    row.status = `idle ${Math.floor(idleDays)}d (tier ${t ? t.days : '?'}d)`;
    if (t) {
      const lastDm = st.last_inactivity_dm_at || 0;
      const nextDm = lastDm ? lastDm + t.dmCooldown : now;
      tierSummary = t.chance > 0
        ? `gift chance ${Math.round(t.chance * 100)}%, cooldown ${t.dmCooldown / DAY}d`
        : `no gift at this tier, DM cooldown ${t.dmCooldown / DAY}d`;
      row.reason = `last inactivity DM ${fmt(lastDm, now)},`;
      row.next = `next DM ${fmt(nextDm, now)} — ${now >= nextDm ? 'ELIGIBLE NOW' : 'still cooling'}`;
    }
  }

  const total = (u.balance || 0) + (u.bank || 0);
  return message.channel.send({ embeds: [embed('🔧 Engagement — ' + (uid === config.ownerId ? 'owner' : uid), [
    ['Status', `${row.status} · wealth tier **${wealthTier(total)}** (${total.toLocaleString()})`],
    ['Last meaningful activity', lastMeaningful ? fmt(lastMeaningful, now) : 'never', true],
    ['Inactivity', idleDays === null ? 'unknown (no activity row)' : `**${Math.floor(idleDays)}d** idle`, true],
    ['Tier', tierSummary, true],
    ['Inactivity DM', `last ${fmt(st.last_inactivity_dm_at || 0, now)} · tier ${st.last_inactivity_tier || 0}d`, true],
    ['Last tip', `${st.last_tip_type || 'none'}: ${fmt(st.last_tip_at || 0, now)} (${st.tip_count || 0} total)`, true],
    ['Last return/ surprise gift', `return ${fmt(st.last_return_gift_at || 0, now)} · surprise ${fmt(st.last_surprise_gift_at || 0, now)} (${st.surprise_count || 0})`, true],
    ['Notifications', `tips ${prefs.tips ? 'on' : 'off'} · inactivity ${prefs.inactivity ? 'on' : 'off'} · rewards ${prefs.rewards ? 'on' : 'off'}`, true],
    ['Pending comeback gift', pending ? `yes (${pending.amount.toLocaleString()}, ${fmt(pending.created_at, now)})` : 'none', true],
    ['Reason', row.reason ? row.reason.slice(0, -1) : (idleDays === null ? 'no activity history — nothing to reach out about yet.' : 'active — no re-engagement needed right now.')],
    ['Next eligibility', row.next || '—'],
  ], 0x2b2d31)] });
}