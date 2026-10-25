const { Px, drawText } = require('./pixel');
const { getSpritePx } = require('./sprites');

const W = 340;
const H = 250;
const SCALE = 3;

const COL = {
  bg: '#141419',
  panel: '#1f1f28',
  panelBorder: '#2e2e3e',
  border: '#3a3a4c',
  red: '#ff4a55',
  white: '#ffffff',
  gray: '#8a8a9a',
  green: '#4cd964',
  yellow: '#ffcc00',
  blue: '#4a9eff',
  hp: '#ff4a55',
  mp: '#4a9eff',
  faint: '#40404c',
};

function bar(px, x, y, w, h, pct, color) {
  px.rect(x, y, w, h, '#0a0a0e');
  const fill = Math.max(0, Math.min(w - 2, Math.round(pct * (w - 2))));
  if (fill > 0) px.rect(x + 1, y + 1, fill, h - 2, color);
  px.rectOutline(x, y, w, h, '#3a3a4c');
}

function drawPetCard(px, x, y, pet, label, isEnemy) {
  const w = 158;
  const h = 58;

  // Background card with subtle border
  px.rect(x, y, w, h, COL.panel);
  px.rectOutline(x, y, w, h, COL.panelBorder);

  // Pet sprite (32x32)
  const sprite = getSpritePx(pet.species);
  px.blit(sprite, x + 4, y + 13, 1);

  // If fainted, draw faint X over sprite
  if (pet.hp <= 0) {
    px.line(x + 8, y + 17, x + 32, y + 41, COL.red);
    px.line(x + 32, y + 17, x + 8, y + 41, COL.red);
  }

  const nameX = x + 40;

  // Label & Level
  const labelCol = isEnemy ? '#ff7b72' : '#79c0ff';
  drawText(px, label, nameX, y + 6, labelCol, 1);
  drawText(px, `LV ${pet.level || 1}`, x + w - 38, y + 6, COL.yellow, 1);

  // Species Name
  const speciesName = (pet.species || 'Unknown').toUpperCase().slice(0, 16);
  drawText(px, speciesName, nameX, y + 16, COL.white, 1);

  // HP Bar & text
  const hpMax = Math.max(1, pet.max_hp || pet.hp || 1);
  const curHp = Math.max(0, pet.hp || 0);
  const hpPct = curHp / hpMax;
  const hpColor = curHp <= 0 ? COL.faint : hpPct > 0.5 ? COL.green : hpPct > 0.25 ? COL.yellow : COL.hp;
  
  bar(px, nameX, y + 27, 62, 5, hpPct, hpColor);
  drawText(px, `${curHp}/${hpMax}`, nameX + 66, y + 26, curHp <= 0 ? COL.faint : COL.white, 1);

  // Stats
  drawText(px, `ATK ${pet.attack || 0}  DEF ${pet.defense || 0}`, nameX, y + 39, COL.gray, 1);
}

function upscale(px, factor) {
  const out = new Px(px.w * factor, px.h * factor);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const [r, g, b, a] = px.get(Math.floor(x / factor), Math.floor(y / factor));
      out.set(x, y, r, g, b, a);
    }
  }
  return out;
}

function renderBattleImage({ playerName, enemyName, myPets, theirPets, turns, result }) {
  const px = new Px(W, H);
  px.fillHex(COL.bg);
  px.rectOutline(0, 0, W, H, COL.border);

  // Header
  const title = `${(playerName || 'YOU').toUpperCase()}  VS  ${(enemyName || 'WILD FOES').toUpperCase()}`;
  drawText(px, title, W / 2, 7, COL.red, 1, 'center');
  px.line(8, 19, W - 8, 19, '#2a2a3a');
  px.line(170, 23, 170, 212, '#2a2a3a');

  // Battle rows
  const rowH = 64;
  const y0 = 24;
  for (let i = 0; i < 3; i++) {
    const y = y0 + i * rowH;
    const my = myPets[i];
    const th = theirPets[i];
    if (my) drawPetCard(px, 8, y, my, `YOU ${i + 1}`, false);
    if (th) drawPetCard(px, 174, y, th, `ENEMY ${i + 1}`, true);
  }

  // Footer divider & results
  px.line(8, 218, W - 8, 218, '#2a2a3a');
  const win = /win/i.test(result);
  const resCol = win ? COL.green : COL.red;
  drawText(px, result.toUpperCase(), W / 2, 224, resCol, 1, 'center');
  drawText(px, `TURNS: ${turns}`, W / 2, 236, COL.gray, 1, 'center');

  return upscale(px, SCALE).toPNG();
}

module.exports = { renderBattleImage };
