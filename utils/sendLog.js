const runtime = require('./runtime');

// Outbound [SEND] instrumentation. Every outbound sent message via the common
// text paths logs one line so a double-response episode (source vs source) is
// provable: one command execution should produce exactly one [SEND] line with
// the same out_msg. reply() wraps channel.send() internally — the wrapped
// channel.send is skipped when the reply line already covered that out_msg,
// so one response = one [SEND] line (type=reply).
const coveredOutMsg = new Set();
const COVERED_MAX = 100;

function logSend(label, target, outbound, sourceMsgId) {
  try {
    const channelId = (target && (target.id || target.channelId)) || '?';
    const src = sourceMsgId || (target && target.reference && target.reference.messageId) || '';
    if (!outbound || typeof outbound.then !== 'function') return;
    outbound.then((m) => {
      const outId = (m && (m.id || (m.message && m.message.id))) || '';
      if (!outId) {
        console.log(`[SEND] ${runtime.tag()} type=${label} channel=${channelId} source_msg=${src} out_msg=?`);
        return;
      }
      if (coveredOutMsg.has(outId)) {
        coveredOutMsg.delete(outId);
        return;
      }
      coveredOutMsg.add(outId);
      if (coveredOutMsg.size > COVERED_MAX) coveredOutMsg.delete(coveredOutMsg.values().next().value);
      console.log(`[SEND] ${runtime.tag()} type=${label} channel=${channelId} source_msg=${src} out_msg=${outId}`);
    }).catch(() => {});
  } catch (e) {}
}

// Patch the discord.js prototype methods. Defensive: any failure leaves the
// methods untouched and this module becomes a silent no-op.
function instrument() {
  try {
    const { TextChannel, DMChannel, NewsChannel, ThreadChannel, Message } = require('discord.js');
    const targets = [
      [TextChannel, 'send', 'channel.send', null],
      [DMChannel, 'send', 'dm.send', null],
      [NewsChannel, 'send', 'channel.send', null],
      [ThreadChannel, 'send', 'channel.send', null],
      [Message, 'reply', 'reply', 'MESSAGE_SOURCE'],
    ];
    for (const [Ctor, method, label, flag] of targets) {
      const proto = Ctor && Ctor.prototype;
      if (!proto || typeof proto[method] !== 'function') continue;
      const orig = proto[method];
      proto[method] = function (...args) {
        const outbound = orig.apply(this, args);
        let src = '';
        if (flag === 'MESSAGE_SOURCE') src = this.id;
        logSend(label, this, outbound, src);
        return outbound;
      };
    }
  } catch (e) {
    console.error(`[SENDLOG] instrument failed: ${e && e.message}`);
  }
}

module.exports = { instrument, logSend };