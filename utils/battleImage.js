const { Px, drawText } = require('./pixel');
const { getSpritePx } = require('./sprites');

const W = 320;
const H = 272;
const SCALE = 3;

const COL = {
  bg: '#1a1a1f',
  panel: '#242430',
  border: '#d8d8d8',
  red: '#e5484d',
  white: '#e8e8e8',
  gray: '#8a8a94',
  green: '#46d160',
  yellow: '#f2a33c',
  blue: '#4a9ef5',
  hp: '#e5484d',
  mp: '#4a9ef5',
};

function bar(px, x, y, w, h, pct, color) {
  px.rect(x, y, w, h, '#000000');
  const fill = Math.max(0, Math.min(w - 2, Math.round(pct * (w - 2))));
  if (fill > 0) px.rect(x + 1, y + 1, fill, h - 2, color);
  px.rectOutline(x, y, w, h, COL.border);
}

function miniSprite(species, size) {
  const src = getSpritePx(species);
  const m = new Px(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x / size) * 32);
      const sy = Math.floor((y / size) * 32);
      const [r, g, b, a] = src.get(sx, sy);
      if (a === 0) continue;
      const gray = Math.floor(r * 0.3 + g * 0.59 + b * 0.11);
      m.set(x, y, gray, gray, gray);
    }
  }
  return m;
}

function drawTeamPanel(px, x, y, name, pets) {
  drawText(px, name.toUpperCase(), x, y, COL.red, 1);
  let cy = y + 10;
  for (const p of pets) {
    const lv = `L.${p.level}`;
    drawText(px, lv, x, cy, COL.gray, 1);
    const m = miniSprite(p.species, 8);
    px.blit(m, x + 28, cy);
    drawText(px, p.species.toUpperCase().slice(0, 11), x + 38, cy + 1, COL.white, 1);
    cy += 12;
  }
}

function drawPetRow(px, x, y, pet, label) {
  const sprite = getSpritePx(pet.species);
  px.blit(sprite, x, y, 1);

  const nameX = x + 34;
  drawText(px, label, nameX, y, COL.gray, 1);
  drawText(px, pet.species.toUpperCase().slice(0, 12), nameX, y + 8, COL.white, 1);

  const hpMax = pet.max_hp || pet.hp || 1;
  const hpPct = Math.max(0, pet.hp) / hpMax;
  const hpColor = pet.hp <= 0 ? COL.gray : hpPct > 0.5 ? COL.green : hpPct > 0.25 ? COL.yellow : COL.hp;
  bar(px, nameX, y + 17, 100, 7, hpPct, hpColor);
  drawText(px, `${pet.hp}/${hpMax}`, nameX + 103, y + 17, COL.white, 1);

  const xpMax = Math.max(1, (pet.level || 1) * 100);
  const xpPct = Math.max(0, Math.min(1, (pet.exp || 0) / xpMax));
  bar(px, nameX, y + 26, 100, 7, xpPct, COL.mp);
  drawText(px, `LV ${pet.level}`, nameX + 103, y + 26, COL.gray, 1);

  drawText(px, `ATK ${pet.attack}`, nameX, y + 37, COL.white, 1);
  drawText(px, `DEF ${pet.defense}`, nameX, y + 45, COL.white, 1);
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

  drawText(px, `${playerName} GOES INTO BATTLE!`, W / 2, 8, COL.red, 1, 'center');

  drawTeamPanel(px, 8, 22, 'Your Team', myPets);
  drawTeamPanel(px, 160, 22, 'Enemy Team', theirPets);

  // battle rows
  const rowH = 62;
  const y0 = 56;
  for (let i = 0; i < 3; i++) {
    const y = y0 + i * rowH;
    const my = myPets[i];
    const th = theirPets[i];
    if (my) drawPetRow(px, 8, y, my, `YOU ${i + 1}`);
    if (th) drawPetRow(px, 160, y, th, `ENEMY ${i + 1}`);
  }

  const footerY = y0 + 3 * rowH + 12;
  drawText(px, result.toUpperCase(), W / 2, footerY, COL.red, 1, 'center');
  drawText(px, `TURNS: ${turns}`, W / 2, footerY + 10, COL.gray, 1, 'center');

  return upscale(px, SCALE).toPNG();
}

module.exports = { renderBattleImage };
