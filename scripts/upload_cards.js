const fs = require('fs');
const path = require('path');
const Discord = require('discord.js');
const config = require('../config');

const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildEmojisAndStickers] });

const dir = path.join(__dirname, '..', 'assets', 'cards');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

client.login(config.token).then(async () => {
  client.once('clientReady', async () => {
    try {
      console.log('Logged in. Fetching current app emojis and guild emojis...');
      const appEmojis = await client.application.emojis.fetch();
      console.log(`Current app emojis: ${appEmojis.size}`);
      const guild = client.guilds.cache.get('1536125380438663259');
      console.log(`Guild ${guild.name} static emojis: ${guild.emojis.cache.filter(e => !e.animated).size}`);

      const mapping = {};

      // Index existing
      for (const [id, e] of appEmojis) {
        if (e.name.startsWith('c_')) {
          const key = e.name.slice(2);
          mapping[key] = `<:${e.name}:${id}>`;
        }
      }
      for (const [id, e] of guild.emojis.cache) {
        if (e.name.startsWith('c_') && !e.animated) {
          const key = e.name.slice(2);
          mapping[key] = `<:${e.name}:${id}>`;
        }
      }

      console.log(`Already uploaded: ${Object.keys(mapping).length}/53`);

      let appCount = appEmojis.size;

      for (const file of files) {
        const key = path.basename(file, '.png');
        if (mapping[key]) continue;

        const emojiName = `c_${key}`;
        const filePath = path.join(dir, file);

        try {
          if (appCount < 50) {
            console.log(`Uploading ${key} as app emoji...`);
            const created = await client.application.emojis.create({
              attachment: filePath,
              name: emojiName
            });
            mapping[key] = `<:${created.name}:${created.id}>`;
            appCount++;
            console.log(`Uploaded app emoji ${key}: ${mapping[key]}`);
          } else {
            console.log(`Uploading ${key} as guild emoji...`);
            const created = await guild.emojis.create({
              attachment: filePath,
              name: emojiName
            });
            mapping[key] = `<:${created.name}:${created.id}>`;
            console.log(`Uploaded guild emoji ${key}: ${mapping[key]}`);
          }
          await sleep(1500);
        } catch (err) {
          console.error(`Failed to upload ${key}:`, err.message);
          if (err.message && err.message.includes('rate limit')) {
            console.log('Rate limited, waiting 10s...');
            await sleep(10000);
          }
        }
      }

      const outPath = path.join(__dirname, '..', 'utils', 'card_emojis.json');
      fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2));
      console.log(`Done! Saved ${Object.keys(mapping).length} emojis to ${outPath}`);
    } catch (e) {
      console.error('Fatal error:', e);
    }
    client.destroy();
  });
});
