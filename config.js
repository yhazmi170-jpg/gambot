let config;
try { config = require('./config.json'); } catch { config = require('./config.example.json'); }
if (process.env.TOKEN) config.token = process.env.TOKEN;
module.exports = config;
