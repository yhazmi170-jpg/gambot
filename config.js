let config;
try { config = require('./config.json'); } catch { config = require('./config.example.json'); }
if (process.env.TOKEN) config.token = process.env.TOKEN;
config.selfbotUrl = process.env.SELFBOT_URL || config.selfbotUrl || 'https://discord-selfy.onrender.com';
config.selfbotServiceId = process.env.SELFBOT_SERVICE_ID || config.selfbotServiceId || '';
config.renderApiKey = process.env.RENDER_API_KEY || config.renderApiKey || '';
module.exports = config;
