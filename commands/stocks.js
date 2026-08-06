const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');

const TREND_EMOJI = { OVO: '🪙', CRYPTO: '🪙', PIXEL: '🎮', CASH: '💵', CLOWN: '🤡', GAMBL: '🎰' };

module.exports = {
  name: 'stocks',
  helpCategory: 'Economy',
  helpArgs: '[buy|sell|port] [symbol] [shares]',
  aliases: ['stock', 'market'],
  description: 'buy and sell stocks — the market drifts every hour',
  execute(message, args) {
    const uid = message.author.id;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'buy' || sub === 'sell') {
      const symbol = (args[1] || '').toUpperCase();
      const shares = (args[2] || '').toLowerCase() === 'all' ? Infinity : parseInt(args[2], 10);
      if (!db.STOCKS[symbol] || (sub === 'buy' && (isNaN(shares) || shares <= 0))) {
        return message.channel.send({ embeds: [error(`usage: \`v stocks ${sub} <SYMBOL> <shares|all>\` — symbols: ` + Object.keys(db.STOCKS).join(', '))] });
      }
      if (sub === 'buy') {
        const r = db.buyStock(uid, symbol, shares);
        if (!r) return message.channel.send({ embeds: [error(`you can't afford **${shares}** ${symbol} @ **${db.stockPrice(symbol).toLocaleString()}** each`)] });
        return message.channel.send({ embeds: [success(`bought **${r.shares}** ${symbol} @ **${r.price.toLocaleString()}** for **${r.cost.toLocaleString()}** ${config.currency}`)] });
      }
      if (isNaN(shares) || shares <= 0) {
        const held = db.getStockShares(uid, symbol);
        if (held <= 0) return message.channel.send({ embeds: [error(`you don't own any ${symbol} shares`)] });
        return message.channel.send({ embeds: [error(`you own **${held}** ${symbol} — \`v stocks sell ${symbol} all\` to sell them all`)] });
      }
      const r = db.sellStock(uid, symbol, shares);
      if (!r) return message.channel.send({ embeds: [error(`you don't own that many ${symbol} shares`)] });
      return message.channel.send({ embeds: [success(`sold **${r.shares}** ${symbol} @ **${r.price.toLocaleString()}** for **${r.proceeds.toLocaleString()}** ${config.currency}`)] });
    }

    if (sub === 'port' || sub === 'portfolio' || sub === 'my') {
      const port = db.getPortfolio(uid);
      if (!port.length) return message.channel.send({ embeds: [error('you don\'t own any stocks — `v stocks buy <SYMBOL> <shares>`')] });
      const lines = port.map(s => `${TREND_EMOJI[s.symbol] || '📈'} **${s.symbol}** — ${s.shares} @ **${s.price.toLocaleString()}** = **${s.value.toLocaleString()}**`);
      const total = port.reduce((a, b) => a + b.value, 0);
      return message.channel.send({ embeds: [embed('📈 Your Portfolio', [
        ['', lines.join('\n')],
        ['Total Value', `**${total.toLocaleString()}** ${config.currency}`],
      ], 0x57f287)] });
    }

    const prices = db.getStockPrices();
    const lines = Object.entries(prices).map(([sym, p]) => `${TREND_EMOJI[sym] || '📈'} **${sym}** — **${p.toLocaleString()}** ${config.currency}`);
    const bal = db.getBalance(uid);
    return message.channel.send({ embeds: [embed('📊 Stock Market', [
      ['', lines.join('\n')],
      ['', 'prices change every hour — `v stocks buy <SYMBOL> <shares>` to invest · `v stocks port` for your portfolio'],
      ['Wallet', `**${bal.toLocaleString()}** ${config.currency}`],
    ], 0x2b2d31)] });
  },
};
