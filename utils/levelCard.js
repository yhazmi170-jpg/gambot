const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const FONT_PATH = path.join(__dirname, '../assets/fonts/Nunito.ttf');
const BG_PATH = path.join(__dirname, '../assets/backgrounds/default_800x240.png');

let fontRegistered = false;
let cachedBg = null;

function initFont() {
  if (!fontRegistered && fs.existsSync(FONT_PATH)) {
    try {
      GlobalFonts.registerFromPath(FONT_PATH, 'Nunito');
      fontRegistered = true;
    } catch (err) {
      console.error('[levelCard] Failed to register Nunito font:', err);
    }
  }
}

async function getBg() {
  if (!cachedBg) {
    if (fs.existsSync(BG_PATH)) {
      cachedBg = await loadImage(BG_PATH);
    }
  }
  return cachedBg;
}

/**
 * Generates an 800x240 OwO-style level card banner.
 * @param {object} params
 * @param {string} params.username
 * @param {string} [params.title]
 * @param {number} params.level
 * @param {number} params.rank
 * @param {number} params.xp
 * @param {number} params.needed
 * @param {number} params.progress
 * @param {string} [params.avatarUrl]
 * @returns {Promise<Buffer>}
 */
async function generateLevelCard({ username, title, level, rank, xp, needed, progress, avatarUrl }) {
  initFont();

  const canvas = createCanvas(800, 240);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = await getBg();
  if (bg) {
    ctx.drawImage(bg, 0, 0, 800, 240);
  } else {
    // Fallback dark gradient
    const grad = ctx.createLinearGradient(0, 0, 800, 240);
    grad.addColorStop(0, '#2e124d');
    grad.addColorStop(1, '#0f051d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 240);
  }

  // User Avatar (200x200 square at x=20, y=20)
  let avatarLoaded = false;
  if (avatarUrl) {
    try {
      const av = await loadImage(avatarUrl);
      ctx.drawImage(av, 20, 20, 200, 200);
      avatarLoaded = true;
    } catch {}
  }
  if (!avatarLoaded) {
    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(20, 20, 200, 200);
  }

  // Translucent backdrop (x=220, y=20, w=560, h=200)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(220, 20, 560, 200);

  // Username
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Nunito, sans-serif';
  const name = username || 'Unknown';
  const displayUser = name.length > 20 ? name.slice(0, 19) + '…' : name;
  ctx.fillText(displayUser, 250, 70);

  // Title / Bio
  ctx.font = '400 22px Nunito, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title || 'A Gambot User', 250, 110);

  // Level
  ctx.font = 'bold 20px Nunito, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('LVL', 250, 190);
  const lvlMetrics = ctx.measureText('LVL');
  ctx.font = 'bold 42px Nunito, sans-serif';
  ctx.fillText(String(level), 250 + lvlMetrics.width + 10, 191);

  // Rank
  ctx.font = 'bold 20px Nunito, sans-serif';
  ctx.fillText('Rank: #' + Number(rank || 1).toLocaleString(), 390, 162);

  // XP
  const xpStr = 'XP:' + Number(xp || 0).toLocaleString() + '/' + Number(needed || 1).toLocaleString();
  const xpMetrics = ctx.measureText(xpStr);
  ctx.fillText(xpStr, 751 - xpMetrics.width, 162);

  // Progress Bar Outer Box (2px border)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(390, 172, 361, 21);

  // Progress Bar Inner Fill
  const clampedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  const fillWidth = Math.round(clampedProgress * 353);
  if (fillWidth > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(394, 176, fillWidth, 13);
  }

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateLevelCard,
};
