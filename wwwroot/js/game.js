import {
  COLS,
  FIELD_H,
  FIELD_W,
  MODIFIERS,
  ROWS,
  TILE,
  UPGRADES,
  WEAPON_ORDER,
  WEAPONS,
  buyUpgrade,
  buyWeapon,
  createGame,
  normalizeLoadout,
  selectWeapon,
  syncLoadout,
  update,
} from "./engine.js";

const KEY_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
};

const canvas = document.querySelector("#field");
const context = canvas.getContext("2d");
const scoreNode = document.querySelector("#score");
const waveNode = document.querySelector("#wave");
const livesNode = document.querySelector("#lives");
const recordNode = document.querySelector("#record");
const partsNode = document.querySelector("#parts");
const weaponNode = document.querySelector("#weapon");
const modsNode = document.querySelector("#mods");
const weaponsNode = document.querySelector("#weapons");
const garageNode = document.querySelector("#garage");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const overlayAction = document.querySelector("#overlay-action");

const keyDirs = new Set();
const pointerDirs = new Set();
let recent = null;
let keyFire = false;
let pointerFire = false;
let best = 0;
let bestLoaded = false;
let loadout = normalizeLoadout(readLoadout());
let game = createGame(Math.random, loadout);
let hud = { score: -1, lives: -1, wave: -1, phase: "menu", reason: null };
let arsenalKey = "";

function readLoadout() {
  try {
    return JSON.parse(localStorage.getItem("tanki-loadout") || "null");
  } catch {
    return null;
  }
}

function saveLoadout() {
  try {
    localStorage.setItem("tanki-loadout", JSON.stringify(loadout));
  } catch {
    // Прокачка останется до перезагрузки страницы.
  }
}

function applyScale() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = FIELD_W * dpr;
  canvas.height = FIELD_H * dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function readInput() {
  const down = new Set([...keyDirs, ...pointerDirs]);
  let dir = null;
  if (recent && down.has(recent)) dir = recent;
  else dir = ["up", "left", "down", "right"].find((item) => down.has(item)) ?? null;
  return { dir, fire: keyFire || pointerFire };
}

function publish() {
  if (
    hud.score === game.score &&
    hud.lives === game.lives &&
    hud.wave === game.wave &&
    hud.phase === game.phase &&
    hud.reason === game.reason
  ) {
    return;
  }
  hud = {
    score: game.score,
    lives: game.lives,
    wave: game.wave,
    phase: game.phase,
    reason: game.reason,
  };
  scoreNode.textContent = `Счёт: ${hud.score}`;
  scoreNode.dataset.score = String(hud.score);
  waveNode.textContent = `Волна: ${hud.wave}`;
  livesNode.textContent = `Жизни: ${hud.lives}`;
  renderOverlay();
  refreshArsenal();
}

function renderOverlay() {
  if (hud.phase === "playing") {
    overlay.hidden = true;
    return;
  }
  overlay.hidden = false;
  if (hud.phase === "paused") {
    overlayTitle.textContent = "Пауза";
    overlayText.textContent = "Бой остановлен";
    overlayAction.textContent = "Дальше";
    return;
  }
  overlayTitle.textContent = "Бой окончен";
  overlayText.textContent = `${hud.reason === "base" ? "База уничтожена" : "Жизни закончились"}. Счёт: ${hud.score}. Детали сохранены.`;
  overlayAction.textContent = "Ещё раз";
}

function togglePause() {
  if (game.phase === "playing") game.phase = "paused";
  else if (game.phase === "paused") game.phase = "playing";
  else return;
  publish();
}

function restart() {
  game = createGame(Math.random, loadout);
  hud = { score: -1, lives: -1, wave: -1, phase: "menu", reason: null };
  publish();
}

function acceptLoadout(next) {
  if (!next) return;
  const earned = Math.max(0, game.parts - loadout.parts);
  loadout = earned > 0 ? { ...next, parts: next.parts + earned } : next;
  saveLoadout();
  syncLoadout(game, loadout);
  arsenalKey = "";
  refreshArsenal();
  refreshWallet();
  publish();
}

function refreshArsenal() {
  const weaponName = WEAPONS[loadout.weapon]?.name ?? "Пушка";
  const label = `Оружие: ${weaponName}`;
  if (weaponNode.textContent !== label) weaponNode.textContent = label;
  const key = JSON.stringify(loadout);
  if (key === arsenalKey) return;
  arsenalKey = key;
  weaponsNode.replaceChildren();
  garageNode.replaceChildren();

  for (const id of WEAPON_ORDER) {
    const weapon = WEAPONS[id];
    const owned = loadout.unlocked.includes(id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = loadout.weapon === id ? "active" : "";
    button.disabled = !owned && loadout.parts < weapon.price;
    button.textContent = owned ? weapon.name : `${weapon.name} · ${weapon.price}`;
    button.addEventListener("click", () => {
      if (owned) acceptLoadout(selectWeapon(loadout, id));
      else acceptLoadout(buyWeapon(loadout, id));
    });
    weaponsNode.append(button);
  }

  for (const id of Object.keys(UPGRADES)) {
    const spec = UPGRADES[id];
    const level = loadout[id];
    const button = document.createElement("button");
    button.type = "button";
    const maxed = level >= spec.max;
    const price = maxed ? 0 : spec.cost(level);
    button.disabled = maxed || loadout.parts < price;
    button.textContent = maxed ? `${spec.name} ${level}/${spec.max}` : `${spec.name} ${level}/${spec.max} · ${price}`;
    button.title = spec.blurb;
    button.addEventListener("click", () => acceptLoadout(buyUpgrade(loadout, id)));
    garageNode.append(button);
  }
}

function refreshWallet() {
  if (game.parts !== loadout.parts) {
    loadout = { ...loadout, parts: game.parts };
    saveLoadout();
    arsenalKey = "";
    refreshArsenal();
  }
  if (partsNode.textContent !== `Детали: ${game.parts}`) partsNode.textContent = `Детали: ${game.parts}`;
  const mods = Object.entries(game.mods)
    .filter(([, time]) => time > 0)
    .map(([id, time]) => `${MODIFIERS[id].name} ${Math.ceil(time)}с`)
    .join(" · ");
  const text = mods || "Модификаторы выпадают с танков";
  if (modsNode.textContent !== text) modsNode.textContent = text;
}

function rememberBest() {
  if (!bestLoaded) {
    bestLoaded = true;
    try {
      const stored = Number(localStorage.getItem("tanki-best") || "0");
      if (Number.isFinite(stored) && stored > 0) best = stored;
    } catch {
      // Рекорд необязателен: приватный режим может запретить localStorage.
    }
  }
  if (game.phase === "gameover" && game.score > best) {
    best = game.score;
    try {
      localStorage.setItem("tanki-best", String(game.score));
    } catch {
      // Игра продолжается и без сохранённого рекорда.
    }
  }
  const text = `Рекорд: ${Math.max(best, game.score)}`;
  if (recordNode.textContent !== text) recordNode.textContent = text;
}

function holdDir(dir, down) {
  if (down) {
    pointerDirs.add(dir);
    recent = dir;
  } else {
    pointerDirs.delete(dir);
  }
}

applyScale();
window.addEventListener("resize", applyScale);

window.addEventListener("keydown", (event) => {
  const dir = KEY_DIR[event.code];
  if (dir) {
    event.preventDefault();
    keyDirs.add(dir);
    recent = dir;
  }
  if (event.code === "Space" || event.code === "KeyJ") {
    event.preventDefault();
    keyFire = true;
  }
  if ((event.code === "KeyP" || event.code === "Escape") && !event.repeat) {
    event.preventDefault();
    togglePause();
  }
  if (event.code === "Enter" && !event.repeat && game.phase === "gameover") restart();
  const weaponIndex = Number(event.code.slice(5)) - 1;
  if (event.code.startsWith("Digit") && WEAPON_ORDER[weaponIndex]) {
    event.preventDefault();
    const id = WEAPON_ORDER[weaponIndex];
    if (loadout.unlocked.includes(id)) acceptLoadout(selectWeapon(loadout, id));
  }
});

window.addEventListener("keyup", (event) => {
  const dir = KEY_DIR[event.code];
  if (dir) keyDirs.delete(dir);
  if (event.code === "Space" || event.code === "KeyJ") keyFire = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.phase === "playing") {
    game.phase = "paused";
    publish();
  }
});

for (const button of document.querySelectorAll("[data-dir]")) {
  const dir = button.dataset.dir;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    holdDir(dir, true);
  });
  button.addEventListener("pointerup", () => holdDir(dir, false));
  button.addEventListener("pointercancel", () => holdDir(dir, false));
}

const fireButton = document.querySelector("#fire");
fireButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  fireButton.setPointerCapture(event.pointerId);
  pointerFire = true;
});
fireButton.addEventListener("pointerup", () => {
  pointerFire = false;
});
fireButton.addEventListener("pointercancel", () => {
  pointerFire = false;
});

document.querySelector("#pause").addEventListener("click", togglePause);
overlayAction.addEventListener("click", () => {
  if (game.phase === "paused") togglePause();
  else restart();
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  rememberBest();
  refreshWallet();
  if (game.phase === "playing") {
    let left = dt;
    while (left > 0) {
      const step = Math.min(left, 1 / 60);
      update(game, readInput(), step);
      left -= step;
    }
  }
  draw(context, game);
  publish();
  requestAnimationFrame(loop);
}
publish();
refreshWallet();
requestAnimationFrame(loop);

function draw(ctx, current) {
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);
  ctx.fillStyle = "#1a2818";
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const tile = current.tiles[r * COLS + c];
      const x = c * TILE;
      const y = r * TILE;
      if ((c + r) % 2 === 0) {
        ctx.fillStyle = "#20341c";
        ctx.fillRect(x, y, TILE, TILE);
      }
      if (tile === "brick") drawBrick(ctx, x, y, current.brickHp[r * COLS + c] === 1);
      else if (tile === "steel") drawSteel(ctx, x, y);
      else if (tile === "base") drawBase(ctx, x, y, current.phase !== "gameover" || current.reason !== "base");
    }
  }

  for (const pickup of current.pickups) drawPickup(ctx, pickup);
  for (const enemy of current.enemies) {
    drawTank(ctx, enemy, "#d4534a", "#7d241f");
    if (enemy.maxHp > 1) drawHp(ctx, enemy);
  }
  if (current.player.alive && (current.player.invuln <= 0 || Math.floor(current.player.invuln * 12) % 2 === 0)) {
    drawTank(ctx, current.player, "#c6ef63", "#3d6b18");
  }

  for (const bullet of current.bullets) {
    ctx.fillStyle = bulletColor(bullet);
    const size = bullet.size ?? 6;
    ctx.fillRect(bullet.x, bullet.y, size, size);
  }

  for (const fx of current.fx) {
    const t = 1 - fx.life / fx.max;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 186, 92, ${1 - t})`;
    ctx.arc(fx.x, fx.y, (fx.big ? 8 : 4) + t * (fx.big ? 22 : 12), 0, Math.PI * 2);
    ctx.fill();
  }

  if (current.bannerTime > 0) {
    ctx.fillStyle = "rgba(214, 239, 154, 0.92)";
    ctx.font = "700 28px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(current.banner, FIELD_W / 2, 78);
  }
}

function bulletColor(bullet) {
  if (bullet.owner === "enemy") return "#ffb089";
  const weapon = game.loadout?.weapon;
  if (weapon === "mg") return "#fff4c2";
  if (weapon === "howitzer") return "#ff9a3c";
  if (weapon === "shotgun") return "#f0d060";
  if (weapon === "ricochet") return "#8fd4ff";
  return "#ffe27a";
}

function drawPickup(ctx, pickup) {
  const colors = { rapid: "#7CFF6B", pierce: "#8fd4ff", power: "#ff9a3c" };
  ctx.fillStyle = colors[pickup.kind] ?? "#ffffff";
  ctx.fillRect(pickup.x, pickup.y, pickup.w, pickup.h);
  ctx.fillStyle = "#172214";
  ctx.font = "700 11px ui-monospace, monospace";
  ctx.textAlign = "center";
  const mark = { rapid: "С", pierce: "Б", power: "У" }[pickup.kind] ?? "";
  ctx.fillText(mark, pickup.x + pickup.w / 2, pickup.y + 12);
}

function drawHp(ctx, tank) {
  const ratio = Math.max(0, tank.hp / tank.maxHp);
  ctx.fillStyle = "#24180f";
  ctx.fillRect(tank.x, tank.y - 5, tank.w, 3);
  ctx.fillStyle = "#ff6b57";
  ctx.fillRect(tank.x, tank.y - 5, tank.w * ratio, 3);
}

function drawBrick(ctx, x, y, damaged) {
  ctx.fillStyle = "#8a3d28";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = damaged ? "#a8563a" : "#c46a45";
  ctx.fillRect(x + 2, y + 2, 16, 14);
  ctx.fillRect(x + 22, y + 2, 16, 14);
  ctx.fillRect(x + 2, y + 22, 16, 14);
  ctx.fillRect(x + 22, y + 22, 16, 14);
  if (damaged) {
    ctx.strokeStyle = "#4a2018";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 6);
    ctx.lineTo(x + 30, y + 28);
    ctx.stroke();
  }
}

function drawSteel(ctx, x, y) {
  ctx.fillStyle = "#8e98a3";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = "#5e6770";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
  ctx.fillStyle = "#e7edf2";
  for (const [rx, ry] of [
    [6, 6],
    [TILE - 9, 6],
    [6, TILE - 9],
    [TILE - 9, TILE - 9],
  ]) {
    ctx.fillRect(x + rx, y + ry, 3, 3);
  }
}

function drawBase(ctx, x, y, alive) {
  ctx.fillStyle = alive ? "#e2b34d" : "#6a5a3b";
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 18);
  ctx.lineTo(x + 20, y + 6);
  ctx.lineTo(x + 34, y + 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x + 10, y + 18, 20, 14);
  ctx.fillStyle = alive ? "#fff4cc" : "#8c7b58";
  ctx.fillRect(x + 17, y + 22, 6, 10);
}

function drawTank(ctx, tank, body, track) {
  ctx.save();
  ctx.translate(tank.x + tank.w / 2, tank.y + tank.h / 2);
  const rotation = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[tank.dir];
  ctx.rotate(rotation);
  const w = tank.w;
  const h = tank.h;
  ctx.fillStyle = track;
  ctx.fillRect(-w / 2, -h / 2, 6, h);
  ctx.fillRect(w / 2 - 6, -h / 2, 6, h);
  ctx.fillStyle = "#24180f";
  for (let i = -h / 2; i < h / 2; i += 5) {
    ctx.fillRect(-w / 2, i, 6, 2);
    ctx.fillRect(w / 2 - 6, i, 6, 2);
  }
  ctx.fillStyle = body;
  ctx.fillRect(-w / 2 + 6, -h / 2 + 4, w - 12, h - 8);
  ctx.fillStyle = "#f4f7ea";
  ctx.beginPath();
  ctx.arc(0, 3, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-2, -h / 2 - 4, 4, h / 2);
  ctx.restore();
}
