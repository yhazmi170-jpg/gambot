const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, StreamType, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');
const { embed, error } = require('../utils/embed');
const config = require('../config');

const queues = new Map();

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, { tracks: [], player: null, connection: null, channel: null, current: null, loop: false });
  }
  return queues.get(guildId);
}

function clearQueue(guildId) {
  queues.delete(guildId);
}

function durationStr(ms) {
  if (!ms || isNaN(ms)) return 'live/unknown';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

async function resolveSpotify(url) {
  const u = new URL(url);
  const parts = u.pathname.split('/').filter(Boolean); // e.g. ["track", "ID"] or ["album", "ID"]
  const type = parts[0];
  const id = parts[1];
  if (!type || !id) throw new Error('spotify: bad link');

  // Spotify embed page exposes og:title (track/album name) + og:description (artist · album) with no auth
  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`).catch(() => null);
  if (res && res.ok) {
    const html = await res.text().catch(() => '');
    const title = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || '';
    const desc = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] || '';
    if (title) return desc && desc !== title ? `${title} ${desc}` : `${title} song`;
  }

  // fallback: oembed
  const ores = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`).catch(() => null);
  if (ores && ores.ok) {
    const json = await ores.json().catch(() => null);
    if (json && json.title) return `${json.title} song`;
  }

  throw new Error('spotify: could not read that link');
}

async function playTrack(guildId) {
  const q = getQueue(guildId);
  if (!q.tracks.length || !q.connection) return;

  const track = q.tracks.shift();
  q.current = track;

  try {
    const stream = await play.stream(track.url, { discordPlayerCompatibility: true });
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type === 'opus' ? StreamType.Opus : StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume.setVolume(q.volume ?? 1);
    q.player.play(resource);
    if (q.channel) {
      q.channel.send({ embeds: [embed('🎵 Now Playing', [['Song', track.title], ['Requested by', `<@${track.requestedBy}>`]], 0x57f287)] }).catch(() => {});
    }
  } catch (err) {
    console.error('playTrack error:', err);
    if (q.channel) q.channel.send({ embeds: [error(`could not play that track — \`${String(err.message).slice(0, 200)}\``)] }).catch(() => {});
    q.current = null;
    playTrack(guildId);
  }
}

function setupPlayer(guildId) {
  const q = getQueue(guildId);
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  q.player = player;

  player.on('stateChange', (oldS, newS) => {
    if (newS.status === AudioPlayerStatus.Idle && oldS.status !== AudioPlayerStatus.Idle) {
      if (q.tracks.length) {
        playTrack(guildId);
      } else {
        q.current = null;
        const conn = getVoiceConnection(guildId);
        if (conn) {
          setTimeout(() => {
            if (!getQueue(guildId).tracks.length) conn.destroy();
          }, 30000);
        }
      }
    }
  });

  return player;
}

module.exports = {
  name: 'play',
  aliases: ['music', 'song'],
  helpCategory: 'Music',
  helpArgs: '<song or url> | skip | stop | queue | pause | resume | volume <0-100> | np',
  description: 'play music in your voice channel (YouTube)',
  clearQueue,
  async execute(message, args) {
    const sub = (args[0] || '').toLowerCase();
    const guildId = message.guild?.id;

    if (sub === 'stop' || sub === 'leave' || sub === 'dc') {
      const conn = getVoiceConnection(guildId);
      if (!conn) return message.channel.send({ embeds: [error('not in a voice channel')] });
      queues.delete(guildId);
      conn.destroy();
      return message.channel.send({ embeds: [embed('🎵 Music', [['', 'left the voice channel and cleared the queue']])] });
    }

    if (sub === 'skip' || sub === 'next') {
      const q = getQueue(guildId);
      if (!q.player) return message.channel.send({ embeds: [error('nothing is playing')] });
      const wasIdle = q.player.state.status === AudioPlayerStatus.Idle;
      const conn = getVoiceConnection(guildId);
      if (conn) conn.state.subscription?.player.stop();
      if (wasIdle && q.tracks.length) playTrack(guildId);
      return message.channel.send({ embeds: [embed('🎵 Music', [['', q.tracks.length ? `skipped — up next: **${q.tracks[0].title}**` : 'skipped — queue is empty']])] });
    }

    if (sub === 'queue' || sub === 'q') {
      const q = getQueue(guildId);
      if (!q.tracks.length && !q.current) return message.channel.send({ embeds: [error('queue is empty')] });
      const lines = [];
      if (q.current) lines.push(`**Now playing:** ${q.current.title}`);
      q.tracks.slice(0, 10).forEach((t, i) => lines.push(`${i + 1}. ${t.title} (${durationStr(t.duration)})`));
      if (q.tracks.length > 10) lines.push(`...and ${q.tracks.length - 10} more`);
      return message.channel.send({ embeds: [embed('🎵 Queue', [['', lines.join('\n')]])] });
    }

    if (sub === 'pause') {
      const q = getQueue(guildId);
      if (!q.player) return message.channel.send({ embeds: [error('nothing is playing')] });
      q.player.pause();
      return message.channel.send({ embeds: [embed('🎵 Music', [['', 'paused — use `v play resume`']])] });
    }

    if (sub === 'resume' || sub === 'unpause') {
      const q = getQueue(guildId);
      if (!q.player) return message.channel.send({ embeds: [error('nothing is playing')] });
      q.player.unpause();
      return message.channel.send({ embeds: [embed('🎵 Music', [['', 'resumed']])] });
    }

    if (sub === 'volume' || sub === 'vol') {
      const q = getQueue(guildId);
      const vol = parseInt(args[1], 10);
      if (isNaN(vol) || vol < 0 || vol > 100) return message.channel.send({ embeds: [error('volume must be 0-100')] });
      q.volume = vol / 100;
      const r = q.player?.state?.resource;
      if (r && r.volume) r.volume.setVolume(vol / 100);
      return message.channel.send({ embeds: [embed('🎵 Music', [['volume', `${vol}%`]])] });
    }

    if (sub === 'np' || sub === 'now') {
      const q = getQueue(guildId);
      if (!q.current) return message.channel.send({ embeds: [error('nothing is playing')] });
      return message.channel.send({ embeds: [embed('🎵 Now Playing', [['Song', q.current.title]])] });
    }

    const voice = message.member?.voice?.channel;
    if (!voice) return message.channel.send({ embeds: [error('join a voice channel first')] });

    const query = args.join(' ');
    if (!query) return message.channel.send({ embeds: [error('usage: `v play <song or url>`')] });

    const channel = message.channel;
    const q = getQueue(guildId);
    q.channel = channel;
    q.volume = q.volume ?? 1;

    if (!getVoiceConnection(guildId)) {
      const connection = joinVoiceChannel({
        channelId: voice.id,
        guildId,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true,
      });
      q.connection = connection;
      const player = setupPlayer(guildId);
      connection.subscribe(player);
    } else if (!q.player) {
      const connection = getVoiceConnection(guildId);
      if (connection) {
        const player = setupPlayer(guildId);
        connection.subscribe(player);
      }
    }

    const statusMsg = await message.channel.send({ embeds: [embed('🎵 Music', [['', 'searching for that...']])] }).catch(() => null);

    try {
      let trackUrl, title, duration;
      const lower = query.toLowerCase();

      if (/youtube\.com|youtu\.be/.test(lower)) {
        trackUrl = query;
        const info = await play.video_info(query).catch(() => null);
        title = info?.video_details?.title || query;
        duration = info?.video_details?.durationInSec ? info.video_details.durationInSec * 1000 : 0;
      } else if (/open\.spotify\.com/.test(lower)) {
        const searchQuery = await resolveSpotify(query);
        const results = await play.search(searchQuery, { limit: 1 });
        if (!results.length) throw new Error('spotify: no match on YouTube');
        trackUrl = results[0].url;
        title = `${searchQuery} — YouTube: ${results[0].title}`;
        duration = results[0].durationInSec ? results[0].durationInSec * 1000 : 0;
      } else if (/^https?:\/\//.test(query)) {
        const info = await play.video_info(query).catch(() => null);
        trackUrl = query;
        title = info?.video_details?.title || query;
        duration = info?.video_details?.durationInSec ? info.video_details.durationInSec * 1000 : 0;
      } else {
        const results = await play.search(query, { limit: 1 });
        if (!results.length) {
          if (statusMsg) statusMsg.edit({ embeds: [error('no results found for that')] }).catch(() => {});
          return;
        }
        trackUrl = results[0].url;
        title = results[0].title;
        duration = results[0].durationInSec ? results[0].durationInSec * 1000 : 0;
      }

      const track = { url: trackUrl, title, duration, requestedBy: message.author.id };
      const position = q.tracks.length + 1;

      if (q.player?.state?.status === AudioPlayerStatus.Playing || q.player?.state?.status === AudioPlayerStatus.Paused || q.current) {
        q.tracks.push(track);
        if (statusMsg) statusMsg.edit({ embeds: [embed('🎵 Music', [['', `added to queue (position **${position}**) — **${title}**`]])] }).catch(() => {});
      } else {
        q.tracks.push(track);
        playTrack(guildId);
        if (statusMsg) statusMsg.edit({ embeds: [embed('🎵 Music', [['', `starting — **${title}**`]])] }).catch(() => {});
      }
    } catch (err) {
      console.error('play error:', err.message);
      if (statusMsg) statusMsg.edit({ embeds: [error('could not find or play that — try a more specific title')] }).catch(() => {});
    }
  },
};
