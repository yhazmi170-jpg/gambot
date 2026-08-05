const { Px } = require('./pixel');

const SIZE = 32;

const PAL = {
  rabbit: '#e8e2d8', rabbit2: '#f5c6c6', sq: '#c98a4b', sq2: '#e8c89a',
  mouse: '#b9b9c2', mouse2: '#e0a0a0', sparrow: '#a0703a', sparrow2: '#e0b060',
  frog: '#7cc94a', frog2: '#c8f0a0', chick: '#ffd84d', chick2: '#ffef9e',
  duckling: '#ffe066', duck2: '#fff0b0', hamster: '#e8a860', hamster2: '#f8dcb0',
  fish: '#ffa04d', fish2: '#ffd0a0', butterfly: '#a05ac8', butterfly2: '#e0a0f0',
  fox: '#ff8c4a', fox2: '#ffd8b0', owl: '#a07850', owl2: '#f0e0c0',
  raccoon: '#9a9aa4', raccoon2: '#d0d0d8', hedgehog: '#b08050', hedgehog2: '#e0c090',
  ferret: '#f0dcc0', ferret2: '#e8e8e8', parrot: '#38c048', parrot2: '#ff5040',
  turtle: '#4aa04a', turtle2: '#a8d868', lizard: '#58b048', lizard2: '#c0e888',
  wolf: '#8a8fa0', wolf2: '#c0c4d0', eagle: '#6a4a28', eagle2: '#f0f0e8',
  deer: '#c08a50', deer2: '#e8c890', panther: '#2e2e36', panther2: '#6e6e78',
  hawk: '#8a5a2a', hawk2: '#d0b080', lynx: '#b09870', lynx2: '#d8c098',
  cobra: '#3aa048', cobra2: '#98e068', boar: '#6a4a34', boar2: '#9a7a58',
  dragon: '#d84a4a', dragon2: '#f0a060', phoenix: '#ff8a2a', phoenix2: '#ffe060',
  griffin: '#d8b048', griffin2: '#f0e8c0', unicorn: '#f0f0f4', unicorn2: '#ffd0e8',
  pegasus: '#e8e8f0', pegasus2: '#d0d0ff', kraken: '#9040a8', kraken2: '#d080d8',
  basilisk: '#2a7a3a', basilisk2: '#68c058', leviathan: '#3868d0', leviathan2: '#88b0f0',
  thunderbird: '#5a5a68', thunderbird2: '#ffe040', kirin: '#e8d8a0', kirin2: '#ff8a3a',
  cerberus: '#b04840', cerberus2: '#d08858', fenrir: '#40404a', fenrir2: '#88889a',
  jorm: '#3a9a58', jorm2: '#a8e868', eye: '#1a1a1a', outline: '#20202a',
};

function newCanvas() {
  const c = new Px(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) c.set(x, y, 0, 0, 0, 0);
  return c;
}

// helpers
function body(c, cx, cy, rx, ry, main, belly) {
  c.ellipse(cx, cy, rx, ry, main);
  if (belly) c.ellipse(cx + 2, cy + 2, rx - 3, ry - 3, belly);
}
function leg(c, x, y, col) {
  c.rect(x, y, 3, 5, col);
  c.rect(x, y + 5, 3, 1, PAL.outline);
}
function eye(c, x, y, col = PAL.eye) {
  c.setHex(x, y, col);
  c.setHex(x + 1, y, col);
  c.setHex(x, y + 1, col);
  c.setHex(x + 1, y + 1, col);
}
function ear(c, x, y, col, inner) {
  c.triangle(x, y, x + 4, y, x + 2, y + 8, col);
  c.triangle(x + 1, y + 2, x + 3, y + 2, x + 2, y + 6, inner);
}
function earRound(c, x, y, col, inner) {
  c.circle(x + 2, y + 3, 4, col);
  c.circle(x + 2, y + 3, 2, inner);
}
function tail(c, x, y, col) {
  c.ellipse(x, y, 5, 3, col);
  c.ellipse(x - 2, y - 1, 3, 2, col);
}
function wing(c, x, y, col, down = false) {
  c.triangle(x, y, x + (down ? 6 : 10), y + (down ? 8 : 2), x + 2, y + (down ? 12 : 10), col);
}
function horn(c, x, y, col) {
  c.triangle(x, y, x + 2, y, x + 1, y + 6, col);
}
function outlineSprite(c) {
  const src = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) src.push(c.get(x, y));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [, , , a] = c.get(x, y);
      if (a === 0) {
        const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of nb) {
          const [, , , na] = c.get(nx, ny);
          if (na > 0) { c.setHex(x, y, PAL.outline); break; }
        }
      }
    }
  }
}

// ---- species drawers (each on 32x32 canvas) ----
const DRAW = {
  Rabbit(c) {
    body(c, 15, 20, 9, 7, PAL.rabbit, PAL.rabbit2);
    ear(c, 10, 6, PAL.rabbit, PAL.rabbit2); ear(c, 16, 5, PAL.rabbit, PAL.rabbit2);
    leg(c, 9, 25, PAL.rabbit); leg(c, 18, 25, PAL.rabbit);
    tail(c, 5, 20, PAL.rabbit2);
    eye(c, 20, 18); eye(c, 25, 18);
    c.setHex(22, 22, PAL.rabbit2); c.setHex(23, 23, PAL.eye);
  },
  Squirrel(c) {
    body(c, 15, 21, 8, 6, PAL.sq, PAL.sq2);
    ear(c, 10, 8, PAL.sq, PAL.sq2); ear(c, 16, 7, PAL.sq, PAL.sq2);
    leg(c, 10, 25, PAL.sq); leg(c, 17, 25, PAL.sq);
    tail(c, 5, 18, PAL.sq);
    eye(c, 19, 19); eye(c, 24, 19);
    c.setHex(21, 23, PAL.sq2); c.setHex(22, 24, PAL.eye);
  },
  Mouse(c) {
    body(c, 15, 21, 7, 6, PAL.mouse, PAL.mouse2);
    earRound(c, 10, 10, PAL.mouse, PAL.mouse2); earRound(c, 17, 10, PAL.mouse, PAL.mouse2);
    leg(c, 10, 25, PAL.mouse); leg(c, 17, 25, PAL.mouse);
    c.line(8, 25, 4, 28, PAL.mouse);
    eye(c, 18, 19); eye(c, 22, 19);
    c.setHex(19, 22, PAL.mouse2); c.setHex(20, 23, PAL.eye);
  },
  Sparrow(c) {
    body(c, 16, 20, 9, 7, PAL.sparrow, PAL.sparrow2);
    c.triangle(24, 17, 28, 19, 24, 21, '#f0a040');
    wing(c, 10, 18, PAL.sparrow2);
    leg(c, 14, 25, '#e0a050'); leg(c, 20, 25, '#e0a050');
    tail(c, 5, 19, PAL.sparrow);
    eye(c, 21, 18);
    c.setHex(22, 16, PAL.sparrow2);
  },
  Frog(c) {
    body(c, 15, 20, 9, 7, PAL.frog, PAL.frog2);
    c.circle(10, 13, 3, PAL.frog); c.circle(21, 13, 3, PAL.frog);
    c.circle(10, 13, 1, PAL.eye); c.circle(21, 13, 1, PAL.eye);
    c.setHex(12, 23, PAL.frog2); c.setHex(20, 23, PAL.frog2);
    c.line(14, 24, 18, 24, PAL.eye);
    c.rect(10, 25, 3, 2, PAL.frog); c.rect(18, 25, 3, 2, PAL.frog);
  },
  Chick(c) {
    body(c, 16, 20, 9, 8, PAL.chick, PAL.chick2);
    c.triangle(24, 19, 27, 21, 24, 23, '#f09820');
    wing(c, 9, 18, PAL.chick2);
    leg(c, 13, 26, '#f09820'); leg(c, 19, 26, '#f09820');
    eye(c, 21, 18);
    c.setHex(22, 14, PAL.chick2);
  },
  Duckling(c) {
    body(c, 16, 21, 9, 6, PAL.duckling, PAL.duck2);
    c.triangle(24, 18, 28, 20, 24, 22, '#f0a030');
    wing(c, 10, 18, PAL.duck2);
    leg(c, 14, 26, '#f0a030'); leg(c, 20, 26, '#f0a030');
    tail(c, 5, 19, PAL.duck2);
    eye(c, 22, 18);
  },
  Hamster(c) {
    body(c, 15, 21, 8, 7, PAL.hamster, PAL.hamster2);
    earRound(c, 10, 11, PAL.hamster, PAL.hamster2); earRound(c, 18, 11, PAL.hamster, PAL.hamster2);
    leg(c, 10, 26, PAL.hamster); leg(c, 17, 26, PAL.hamster);
    eye(c, 18, 19); eye(c, 23, 19);
    c.circle(17, 23, 2, PAL.hamster2); c.circle(23, 23, 2, PAL.hamster2);
    c.setHex(20, 24, PAL.eye);
  },
  Fish(c) {
    c.ellipse(16, 16, 10, 5, PAL.fish);
    c.triangle(5, 13, 2, 16, 5, 19, PAL.fish2);
    c.triangle(13, 11, 15, 14, 17, 11, PAL.fish2);
    c.triangle(20, 17, 22, 20, 24, 17, PAL.fish2);
    eye(c, 22, 15);
    c.rect(12, 14, 3, 1, PAL.fish2);
  },
  Butterfly(c) {
    c.ellipse(17, 16, 2, 6, PAL.butterfly);
    c.ellipse(11, 13, 6, 5, PAL.butterfly2); c.ellipse(23, 13, 6, 5, PAL.butterfly2);
    c.ellipse(10, 20, 4, 4, PAL.butterfly); c.ellipse(24, 20, 4, 4, PAL.butterfly);
    c.circle(9, 13, 1, PAL.butterfly); c.circle(25, 13, 1, PAL.butterfly);
    c.setHex(17, 12, PAL.butterfly); c.setHex(17, 14, PAL.butterfly); c.setHex(17, 16, PAL.butterfly); c.setHex(17, 18, PAL.butterfly);
    c.setHex(16, 21, PAL.eye); c.setHex(18, 21, PAL.eye);
  },
  Fox(c) {
    body(c, 15, 20, 8, 6, PAL.fox, PAL.fox2);
    ear(c, 9, 7, PAL.fox, PAL.fox2); ear(c, 17, 6, PAL.fox, PAL.fox2);
    c.triangle(25, 17, 29, 18, 26, 20, PAL.fox2);
    leg(c, 10, 24, PAL.fox); leg(c, 17, 24, PAL.fox);
    tail(c, 4, 18, PAL.fox);
    eye(c, 20, 18);
    c.setHex(21, 22, PAL.fox2); c.setHex(22, 23, PAL.eye);
  },
  Owl(c) {
    body(c, 16, 20, 9, 8, PAL.owl, PAL.owl2);
    ear(c, 9, 7, PAL.owl, PAL.owl); ear(c, 20, 7, PAL.owl, PAL.owl);
    c.circle(16, 16, 6, PAL.owl2);
    c.circle(13, 15, 2, PAL.eye); c.circle(19, 15, 2, PAL.eye);
    c.circle(13, 15, 1, '#f0c030'); c.circle(19, 15, 1, '#f0c030');
    c.triangle(14, 21, 18, 21, 16, 23, '#f0a040');
    wing(c, 8, 18, PAL.owl); wing(c, 24, 18, PAL.owl, true);
    leg(c, 13, 26, PAL.owl); leg(c, 18, 26, PAL.owl);
  },
  Raccoon(c) {
    body(c, 15, 21, 8, 6, PAL.raccoon, PAL.raccoon2);
    earRound(c, 10, 10, PAL.raccoon, PAL.raccoon); earRound(c, 18, 10, PAL.raccoon, PAL.raccoon);
    c.rect(12, 15, 9, 6, PAL.raccoon2);
    c.rect(14, 17, 2, 2, PAL.eye); c.rect(18, 17, 2, 2, PAL.eye);
    c.rect(15, 18, 4, 2, PAL.eye);
    c.rect(12, 20, 9, 2, PAL.raccoon);
    leg(c, 10, 25, PAL.raccoon); leg(c, 17, 25, PAL.raccoon);
    tail(c, 5, 19, PAL.raccoon);
    c.rect(3, 18, 3, 2, PAL.eye);
  },
  Hedgehog(c) {
    body(c, 16, 20, 9, 8, PAL.hedgehog, PAL.hedgehog2);
    c.triangle(10, 12, 13, 8, 16, 12, PAL.hedgehog);
    c.triangle(13, 8, 16, 5, 19, 8, PAL.hedgehog);
    c.triangle(16, 5, 20, 7, 22, 11, PAL.hedgehog);
    c.rect(14, 16, 6, 5, PAL.hedgehog2);
    eye(c, 20, 18);
    c.setHex(21, 21, PAL.hedgehog2); c.setHex(22, 22, PAL.eye);
    leg(c, 11, 26, PAL.hedgehog); leg(c, 18, 26, PAL.hedgehog);
  },
  Ferret(c) {
    body(c, 15, 21, 9, 5, PAL.ferret, PAL.ferret2);
    earRound(c, 11, 11, PAL.ferret, PAL.ferret2); earRound(c, 18, 11, PAL.ferret, PAL.ferret2);
    c.rect(14, 16, 6, 4, PAL.ferret2);
    eye(c, 17, 17); eye(c, 22, 17);
    c.setHex(19, 21, PAL.ferret2); c.setHex(20, 22, PAL.eye);
    leg(c, 10, 25, PAL.ferret); leg(c, 17, 25, PAL.ferret);
    c.line(8, 24, 4, 26, PAL.ferret);
  },
  Parrot(c) {
    body(c, 16, 20, 8, 7, PAL.parrot, PAL.parrot2);
    c.triangle(24, 17, 28, 18, 24, 20, '#f0a030');
    c.rect(9, 14, 6, 3, PAL.parrot2);
    wing(c, 9, 18, '#2a9038');
    c.setHex(21, 14, PAL.parrot2);
    eye(c, 22, 18);
    leg(c, 13, 26, '#6a4a2a'); leg(c, 19, 26, '#6a4a2a');
    tail(c, 6, 19, PAL.parrot2);
  },
  Turtle(c) {
    c.ellipse(16, 21, 9, 6, PAL.turtle2);
    c.ellipse(16, 19, 7, 5, PAL.turtle);
    c.rect(13, 18, 6, 1, PAL.turtle2);
    c.rect(13, 21, 6, 1, PAL.turtle2);
    c.ellipse(25, 17, 4, 3, PAL.turtle);
    c.circle(27, 16, 1, PAL.eye);
    c.rect(8, 20, 3, 2, PAL.turtle); c.rect(22, 22, 3, 2, PAL.turtle);
    c.rect(9, 24, 3, 2, PAL.turtle); c.rect(21, 24, 3, 2, PAL.turtle);
    c.triangle(6, 20, 3, 19, 5, 22, PAL.turtle2);
  },
  Lizard(c) {
    body(c, 16, 21, 9, 5, PAL.lizard, PAL.lizard2);
    earRound(c, 11, 12, PAL.lizard, PAL.lizard2); earRound(c, 19, 12, PAL.lizard, PAL.lizard2);
    c.triangle(24, 19, 28, 20, 25, 22, PAL.lizard);
    eye(c, 21, 19);
    leg(c, 10, 25, PAL.lizard); leg(c, 17, 25, PAL.lizard);
    tail(c, 5, 20, PAL.lizard);
  },
  Wolf(c) {
    body(c, 15, 20, 9, 6, PAL.wolf, PAL.wolf2);
    ear(c, 9, 6, PAL.wolf, PAL.wolf); ear(c, 17, 5, PAL.wolf, PAL.wolf);
    c.triangle(26, 16, 29, 17, 26, 19, PAL.wolf2);
    leg(c, 10, 24, PAL.wolf); leg(c, 17, 24, PAL.wolf);
    tail(c, 4, 18, PAL.wolf);
    eye(c, 21, 18);
    c.setHex(23, 22, PAL.wolf2); c.setHex(24, 23, PAL.eye);
  },
  Eagle(c) {
    body(c, 16, 20, 9, 7, PAL.eagle, PAL.eagle2);
    c.triangle(24, 17, 28, 18, 24, 20, '#f0a030');
    c.circle(20, 14, 4, PAL.eagle2);
    eye(c, 21, 14);
    wing(c, 9, 17, PAL.eagle);
    leg(c, 14, 26, '#f0c030'); leg(c, 20, 26, '#f0c030');
    tail(c, 5, 18, PAL.eagle);
  },
  Deer(c) {
    body(c, 15, 20, 9, 6, PAL.deer, PAL.deer2);
    ear(c, 9, 8, PAL.deer, PAL.deer2); ear(c, 17, 7, PAL.deer, PAL.deer2);
    horn(c, 8, 3, '#b08040'); horn(c, 10, 2, '#b08040');
    horn(c, 18, 2, '#b08040'); horn(c, 20, 3, '#b08040');
    c.triangle(26, 16, 29, 17, 26, 19, PAL.deer2);
    leg(c, 10, 24, PAL.deer); leg(c, 17, 24, PAL.deer);
    tail(c, 4, 19, PAL.deer2);
    eye(c, 21, 18);
    c.setHex(22, 22, PAL.deer2); c.setHex(23, 23, PAL.eye);
  },
  Panther(c) {
    body(c, 15, 20, 9, 6, PAL.panther, PAL.panther2);
    ear(c, 9, 7, PAL.panther, PAL.panther); ear(c, 17, 6, PAL.panther, PAL.panther);
    c.triangle(25, 17, 28, 18, 25, 20, PAL.panther2);
    leg(c, 10, 24, PAL.panther); leg(c, 17, 24, PAL.panther);
    tail(c, 4, 18, PAL.panther);
    eye(c, 21, 18);
    c.setHex(22, 22, PAL.panther2); c.setHex(23, 23, PAL.eye);
  },
  Hawk(c) {
    body(c, 16, 20, 9, 7, PAL.hawk, PAL.hawk2);
    c.triangle(24, 17, 28, 18, 24, 20, '#f0a030');
    c.circle(20, 14, 4, PAL.hawk2);
    eye(c, 21, 14);
    wing(c, 9, 17, PAL.hawk);
    leg(c, 14, 26, '#f0c030'); leg(c, 20, 26, '#f0c030');
    tail(c, 5, 18, PAL.hawk);
  },
  Lynx(c) {
    body(c, 15, 20, 9, 6, PAL.lynx, PAL.lynx2);
    ear(c, 9, 7, PAL.lynx, PAL.lynx); ear(c, 17, 6, PAL.lynx, PAL.lynx);
    c.setHex(10, 5, PAL.eye); c.setHex(18, 4, PAL.eye);
    c.triangle(26, 16, 29, 17, 26, 19, PAL.lynx2);
    leg(c, 10, 24, PAL.lynx); leg(c, 17, 24, PAL.lynx);
    tail(c, 4, 18, PAL.lynx);
    eye(c, 21, 18);
    c.setHex(23, 22, PAL.lynx2); c.setHex(24, 23, PAL.eye);
  },
  Cobra(c) {
    c.ellipse(13, 18, 7, 9, PAL.cobra);
    c.ellipse(13, 15, 5, 6, PAL.cobra2);
    c.triangle(8, 12, 18, 12, 13, 16, PAL.cobra2);
    eye(c, 11, 14); eye(c, 15, 14);
    c.setHex(13, 20, PAL.cobra); c.setHex(13, 22, PAL.cobra);
    c.setHex(13, 24, PAL.cobra); c.setHex(13, 26, PAL.cobra);
    c.setHex(12, 25, PAL.cobra); c.setHex(14, 25, PAL.cobra);
    c.triangle(13, 20, 16, 20, 15, 22, PAL.cobra2);
  },
  Boar(c) {
    body(c, 15, 20, 9, 7, PAL.boar, PAL.boar2);
    ear(c, 9, 8, PAL.boar, PAL.boar2); ear(c, 17, 7, PAL.boar, PAL.boar2);
    c.triangle(24, 19, 26, 20, 24, 22, PAL.boar2);
    c.rect(25, 19, 1, 3, PAL.eye);
    c.rect(24, 21, 2, 1, PAL.eye);
    c.rect(23, 22, 1, 2, PAL.eye);
    leg(c, 10, 25, PAL.boar); leg(c, 17, 25, PAL.boar);
    eye(c, 21, 18);
  },
  Dragon(c) {
    body(c, 15, 20, 9, 6, PAL.dragon, PAL.dragon2);
    ear(c, 9, 7, PAL.dragon, PAL.dragon); ear(c, 17, 6, PAL.dragon, PAL.dragon);
    horn(c, 10, 4, '#f0e0a0'); horn(c, 18, 3, '#f0e0a0');
    c.triangle(25, 17, 28, 18, 25, 20, PAL.dragon2);
    wing(c, 8, 15, PAL.dragon);
    wing(c, 24, 14, PAL.dragon, true);
    c.triangle(15, 24, 17, 24, 16, 27, '#f0e0a0');
    leg(c, 10, 24, PAL.dragon); leg(c, 17, 24, PAL.dragon);
    tail(c, 4, 17, PAL.dragon);
    c.triangle(3, 15, 5, 14, 5, 17, PAL.dragon2);
    eye(c, 21, 18);
  },
  Phoenix(c) {
    body(c, 16, 20, 8, 7, PAL.phoenix, PAL.phoenix2);
    c.triangle(24, 17, 28, 18, 24, 20, '#f0a030');
    c.setHex(12, 12, PAL.phoenix2); c.setHex(14, 11, PAL.phoenix2); c.setHex(16, 10, PAL.phoenix2);
    c.setHex(13, 10, PAL.phoenix2); c.setHex(15, 9, PAL.phoenix2);
    wing(c, 8, 17, PAL.phoenix);
    wing(c, 24, 15, PAL.phoenix2, true);
    leg(c, 13, 26, '#e09828'); leg(c, 19, 26, '#e09828');
    eye(c, 22, 18);
    tail(c, 5, 17, PAL.phoenix2);
    c.setHex(4, 15, PAL.phoenix2); c.setHex(3, 16, PAL.phoenix2);
  },
  Griffin(c) {
    body(c, 15, 20, 9, 6, PAL.griffin, PAL.griffin2);
    ear(c, 9, 8, PAL.griffin, PAL.griffin); ear(c, 17, 7, PAL.griffin, PAL.griffin);
    c.triangle(25, 17, 28, 18, 25, 20, '#f0a030');
    wing(c, 8, 15, PAL.griffin);
    wing(c, 24, 14, PAL.griffin, true);
    leg(c, 10, 24, '#e0c030'); leg(c, 17, 24, '#e0c030');
    tail(c, 4, 18, PAL.griffin);
    eye(c, 21, 18);
  },
  Unicorn(c) {
    body(c, 15, 20, 9, 6, PAL.unicorn, PAL.unicorn2);
    ear(c, 9, 8, PAL.unicorn, PAL.unicorn2); ear(c, 17, 7, PAL.unicorn, PAL.unicorn2);
    horn(c, 14, 3, '#f0a0c0');
    c.triangle(26, 16, 29, 17, 26, 19, PAL.unicorn2);
    leg(c, 10, 24, PAL.unicorn); leg(c, 17, 24, PAL.unicorn);
    tail(c, 4, 18, PAL.unicorn2);
    eye(c, 21, 18);
    c.setHex(22, 22, PAL.unicorn2); c.setHex(23, 23, PAL.eye);
  },
  Pegasus(c) {
    body(c, 15, 20, 9, 6, PAL.pegasus, PAL.pegasus2);
    ear(c, 9, 8, PAL.pegasus, PAL.pegasus2); ear(c, 17, 7, PAL.pegasus, PAL.pegasus2);
    wing(c, 8, 15, PAL.pegasus2);
    wing(c, 24, 14, PAL.pegasus2, true);
    leg(c, 10, 24, PAL.pegasus); leg(c, 17, 24, PAL.pegasus);
    tail(c, 4, 18, PAL.pegasus2);
    eye(c, 21, 18);
  },
  Kraken(c) {
    c.circle(16, 10, 6, PAL.kraken);
    c.circle(14, 9, 2, PAL.eye); c.circle(18, 9, 2, PAL.eye);
    c.circle(14, 9, 1, '#f0c040'); c.circle(18, 9, 1, '#f0c040');
    c.triangle(16, 14, 14, 17, 18, 17, PAL.kraken2);
    c.line(12, 16, 8, 20, PAL.kraken); c.line(13, 16, 10, 22, PAL.kraken);
    c.line(19, 16, 23, 20, PAL.kraken); c.line(18, 16, 21, 22, PAL.kraken);
    c.line(15, 16, 14, 23, PAL.kraken); c.line(17, 16, 18, 23, PAL.kraken);
    c.circle(8, 21, 2, PAL.kraken2); c.circle(23, 21, 2, PAL.kraken2);
    c.circle(14, 24, 2, PAL.kraken2); c.circle(18, 24, 2, PAL.kraken2);
    c.setHex(8, 20, PAL.eye); c.setHex(23, 20, PAL.eye);
    c.setHex(14, 23, PAL.eye); c.setHex(18, 23, PAL.eye);
  },
  Basilisk(c) {
    c.ellipse(13, 16, 6, 9, PAL.basilisk);
    c.ellipse(13, 13, 4, 5, PAL.basilisk2);
    eye(c, 11, 13); eye(c, 15, 13);
    c.setHex(13, 19, PAL.basilisk); c.setHex(13, 21, PAL.basilisk);
    c.setHex(13, 23, PAL.basilisk); c.setHex(13, 25, PAL.basilisk);
    c.setHex(12, 24, PAL.basilisk); c.setHex(14, 24, PAL.basilisk);
    c.circle(13, 8, 2, PAL.basilisk2);
    c.setHex(12, 8, PAL.eye); c.setHex(14, 8, PAL.eye);
  },
  Leviathan(c) {
    c.ellipse(16, 18, 10, 5, PAL.leviathan);
    c.ellipse(16, 17, 8, 3, PAL.leviathan2);
    c.triangle(5, 15, 2, 18, 5, 21, PAL.leviathan2);
    c.triangle(13, 13, 15, 16, 17, 13, PAL.leviathan2);
    c.triangle(21, 15, 23, 18, 25, 15, PAL.leviathan2);
    eye(c, 22, 16);
    c.setHex(13, 16, PAL.leviathan); c.setHex(18, 18, PAL.leviathan);
  },
  Thunderbird(c) {
    body(c, 16, 20, 9, 7, PAL.thunderbird, PAL.thunderbird2);
    c.triangle(24, 17, 28, 18, 24, 20, '#f0a030');
    c.circle(20, 14, 4, PAL.thunderbird2);
    eye(c, 21, 14);
    wing(c, 8, 16, PAL.thunderbird);
    wing(c, 24, 14, PAL.thunderbird, true);
    leg(c, 14, 26, '#f0c030'); leg(c, 20, 26, '#f0c030');
    tail(c, 5, 18, PAL.thunderbird);
    c.setHex(13, 12, PAL.thunderbird2); c.setHex(15, 10, PAL.thunderbird2);
  },
  Kirin(c) {
    body(c, 15, 20, 9, 6, PAL.kirin, PAL.kirin2);
    ear(c, 9, 8, PAL.kirin, PAL.kirin2); ear(c, 17, 7, PAL.kirin, PAL.kirin2);
    horn(c, 14, 4, PAL.kirin2);
    c.setHex(12, 3, PAL.kirin2); c.setHex(16, 3, PAL.kirin2);
    c.triangle(26, 16, 29, 17, 26, 19, PAL.kirin2);
    c.setHex(10, 14, PAL.kirin2); c.setHex(12, 15, PAL.kirin2); c.setHex(14, 16, PAL.kirin2);
    leg(c, 10, 24, PAL.kirin); leg(c, 17, 24, PAL.kirin);
    tail(c, 4, 18, PAL.kirin2);
    eye(c, 21, 18);
  },
  Cerberus(c) {
    body(c, 15, 20, 9, 6, PAL.cerberus, PAL.cerberus2);
    ear(c, 8, 7, PAL.cerberus, PAL.cerberus); ear(c, 15, 6, PAL.cerberus, PAL.cerberus);
    ear(c, 21, 7, PAL.cerberus, PAL.cerberus);
    c.circle(11, 13, 3, PAL.cerberus); c.circle(16, 13, 3, PAL.cerberus); c.circle(21, 13, 3, PAL.cerberus);
    eye(c, 11, 13); eye(c, 16, 13); eye(c, 21, 13);
    c.setHex(11, 15, PAL.cerberus2); c.setHex(16, 15, PAL.cerberus2); c.setHex(21, 15, PAL.cerberus2);
    c.setHex(11, 16, PAL.eye); c.setHex(16, 16, PAL.eye); c.setHex(21, 16, PAL.eye);
    leg(c, 10, 24, PAL.cerberus); leg(c, 17, 24, PAL.cerberus);
    tail(c, 4, 18, PAL.cerberus);
    c.triangle(3, 16, 5, 15, 5, 18, PAL.cerberus2);
  },
  Fenrir(c) {
    body(c, 15, 20, 9, 6, PAL.fenrir, PAL.fenrir2);
    ear(c, 9, 6, PAL.fenrir, PAL.fenrir); ear(c, 17, 5, PAL.fenrir, PAL.fenrir);
    c.triangle(26, 16, 29, 17, 26, 19, PAL.fenrir2);
    leg(c, 10, 24, PAL.fenrir); leg(c, 17, 24, PAL.fenrir);
    tail(c, 4, 18, PAL.fenrir);
    eye(c, 21, 18);
    c.setHex(22, 15, '#ff5040');
    c.setHex(23, 22, PAL.fenrir2); c.setHex(24, 23, PAL.eye);
  },
  Jormungandr(c) {
    c.ellipse(16, 18, 10, 4, PAL.jorm);
    c.ellipse(16, 17, 8, 2, PAL.jorm2);
    c.triangle(5, 15, 2, 18, 5, 21, PAL.jorm2);
    c.triangle(13, 14, 15, 16, 17, 14, PAL.jorm2);
    c.triangle(21, 16, 23, 18, 25, 16, PAL.jorm2);
    eye(c, 22, 17);
    c.setHex(13, 17, PAL.jorm); c.setHex(19, 18, PAL.jorm);
    c.setHex(11, 20, PAL.jorm); c.setHex(15, 21, PAL.jorm);
  },
};

const cache = {};
function getSprite(species) {
  if (cache[species]) return cache[species];
  const c = newCanvas();
  const fn = DRAW[species] || DRAW.Rabbit;
  fn(c);
  outlineSprite(c);
  const png = c.toPNG();
  cache[species] = { png, c };
  return cache[species];
}

function getSpritePNG(species) {
  return getSprite(species).png;
}

function getSpritePx(species) {
  return getSprite(species).c;
}

module.exports = { getSpritePNG, getSpritePx, SIZE };
