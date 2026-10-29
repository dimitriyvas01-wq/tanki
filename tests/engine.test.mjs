import assert from "node:assert/strict";
import test from "node:test";
import {
  COLS,
  TILE,
  UPGRADES,
  buyUpgrade,
  buyWeapon,
  createGame,
  defaultLoadout,
  normalizeLoadout,
  selectWeapon,
  syncLoadout,
  update,
} from "../wwwroot/js/engine.js";

const quiet = () => 0;

function bullet(partial) {
  return {
    vx: 0,
    vy: 0,
    owner: "player",
    tankId: 99,
    alive: true,
    ...partial,
  };
}

test("снаряд разрушает кирпич без прочности", () => {
  const brickGame = createGame(quiet);
  brickGame.enemies = [];
  brickGame.toSpawn = 3;
  const brickIndex = 2 * COLS + 4;
  brickGame.tiles[brickIndex] = "brick";
  brickGame.bullets = [bullet({ x: 4 * TILE + 16, y: 2 * TILE + 16 })];
  update(brickGame, { dir: null, fire: false }, 0.016);
  assert.equal(brickGame.tiles[brickIndex], "empty");
  assert.equal(brickGame.bullets.length, 0);
});

test("попадание по врагу даёт 100 очков", () => {
  const scoreGame = createGame(quiet);
  const enemy = scoreGame.enemies[0];
  assert.ok(enemy);
  enemy.speed = 0;
  scoreGame.toSpawn = 3;
  scoreGame.bullets = [bullet({ x: enemy.x + 8, y: enemy.y + 8, owner: "player" })];
  update(scoreGame, { dir: null, fire: false }, 0.016);
  assert.equal(scoreGame.score, 100);
  assert.equal(scoreGame.enemies.some((item) => item.id === enemy.id), false);
});

test("попадание в базу заканчивает бой", () => {
  const baseGame = createGame(quiet);
  baseGame.enemies = [];
  baseGame.toSpawn = 3;
  const baseIndex = baseGame.tiles.indexOf("base");
  baseGame.bullets = [
    bullet({
      x: (baseIndex % COLS) * TILE + 12,
      y: Math.floor(baseIndex / COLS) * TILE + 12,
    }),
  ];
  update(baseGame, { dir: null, fire: false }, 0.016);
  assert.equal(baseGame.phase, "gameover");
  assert.equal(baseGame.reason, "base");
});

test("танк не проходит сквозь стальную стену", () => {
  const wallGame = createGame(quiet);
  wallGame.enemies = [];
  wallGame.toSpawn = 3;
  wallGame.player.x = TILE;
  wallGame.player.y = TILE + 5;
  wallGame.player.invuln = 0;
  const startX = wallGame.player.x;
  update(wallGame, { dir: "left", fire: false }, 0.5);
  assert.equal(wallGame.player.x, startX);
});

test("последняя жизнь заканчивает бой", () => {
  const livesGame = createGame(quiet);
  livesGame.enemies = [];
  livesGame.toSpawn = 3;
  livesGame.lives = 1;
  livesGame.player.invuln = 0;
  livesGame.bullets = [
    bullet({
      x: livesGame.player.x + 8,
      y: livesGame.player.y + 8,
      owner: "enemy",
    }),
  ];
  update(livesGame, { dir: null, fire: false }, 0.016);
  assert.equal(livesGame.phase, "gameover");
  assert.equal(livesGame.reason, "lives");
});

test("танк едет в пустую клетку и держит один снаряд", () => {
  const moveGame = createGame(quiet);
  moveGame.enemies = [];
  moveGame.toSpawn = 3;
  const startMove = moveGame.player.x;
  update(moveGame, { dir: "left", fire: false }, 0.2);
  assert.ok(moveGame.player.x < startMove);

  const shotGame = createGame(quiet);
  shotGame.enemies = [];
  shotGame.toSpawn = 5;
  shotGame.player.dir = "left";
  update(shotGame, { dir: null, fire: true }, 0.016);
  assert.equal(shotGame.bullets.length, 1);
  update(shotGame, { dir: null, fire: true }, 0.016);
  assert.equal(shotGame.bullets.length, 1);
  assert.equal(shotGame.bullets[0].damage, 1);
  assert.equal(shotGame.bullets[0].size, 6);
});

test("дробь выпускает три снаряда, пулемёт держит очередь", () => {
  const shotgun = createGame(quiet);
  shotgun.enemies = [];
  shotgun.toSpawn = 5;
  shotgun.loadout.weapon = "shotgun";
  shotgun.player.dir = "left";
  update(shotgun, { dir: null, fire: true }, 0.016);
  assert.equal(shotgun.bullets.length, 3);
  assert.ok(shotgun.bullets.every((item) => item.ttl > 0.2 && item.ttl < 0.32));

  const mg = createGame(quiet);
  mg.enemies = [];
  mg.toSpawn = 5;
  mg.loadout.weapon = "mg";
  mg.player.dir = "left";
  update(mg, { dir: null, fire: true }, 0.016);
  assert.equal(mg.bullets.length, 1);
  mg.player.cooldown = 0;
  update(mg, { dir: null, fire: true }, 0.016);
  assert.equal(mg.bullets.length, 2);
});

test("гаубица сносит кирпич, рикошет отскакивает от стали", () => {
  const siege = createGame(quiet);
  siege.enemies = [];
  siege.toSpawn = 3;
  const brickIndex = 2 * COLS + 4;
  siege.tiles[brickIndex] = "brick";
  siege.brickHp[brickIndex] = 2;
  siege.bullets = [bullet({ x: 4 * TILE + 16, y: 2 * TILE + 16, brick: 4, damage: 3, size: 11 })];
  update(siege, { dir: null, fire: false }, 0.016);
  assert.equal(siege.tiles[brickIndex], "empty");

  const bounce = createGame(quiet);
  bounce.enemies = [];
  bounce.toSpawn = 5;
  bounce.bullets = [bullet({ x: 8, y: TILE + 16, vx: -200, vy: 0, bounce: 1, size: 6 })];
  update(bounce, { dir: null, fire: false }, 0.016);
  assert.equal(bounce.bullets.length, 1);
  assert.ok(bounce.bullets[0].vx > 0);
});

test("модификаторы усиливают выстрел и не пробивают базу", () => {
  const powered = createGame(quiet);
  powered.enemies = [];
  powered.toSpawn = 5;
  powered.player.dir = "left";
  powered.loadout.damage = 2;
  powered.mods.power = 8;
  powered.mods.rapid = 8;
  update(powered, { dir: null, fire: true }, 0.016);
  assert.equal(powered.bullets[0].damage, 5);
  assert.ok(Math.abs(powered.player.cooldown - 0.32 * 0.45) < 0.001);

  const pickup = createGame(quiet);
  pickup.enemies = [];
  pickup.toSpawn = 5;
  pickup.mods.power = 3;
  pickup.pickups.push({
    x: pickup.player.x,
    y: pickup.player.y,
    w: 16,
    h: 16,
    kind: "power",
    life: 10,
  });
  update(pickup, { dir: null, fire: false }, 0.016);
  assert.ok(pickup.mods.power > 7.5);
  assert.equal(pickup.pickups.length, 0);

  const baseGame = createGame(quiet);
  baseGame.enemies = [];
  baseGame.toSpawn = 3;
  const baseIndex = baseGame.tiles.indexOf("base");
  baseGame.bullets = [
    bullet({
      x: (baseIndex % COLS) * TILE + 12,
      y: Math.floor(baseIndex / COLS) * TILE + 12,
      pierce: 1,
    }),
  ];
  update(baseGame, { dir: null, fire: false }, 0.016);
  assert.equal(baseGame.phase, "gameover");
  assert.equal(baseGame.reason, "base");
  assert.equal(baseGame.bullets.length, 0);
});

test("бронебойный снаряд проходит кирпич и оставляет его повреждённым", () => {
  const pierced = createGame(quiet);
  pierced.enemies = [];
  pierced.toSpawn = 5;
  const index = 2 * COLS + 2;
  assert.equal(pierced.tiles[index], "brick");
  assert.equal(pierced.brickHp[index], 2);
  pierced.bullets = [
    bullet({ x: 2 * TILE + 10, y: 2 * TILE + 10, vx: 100, vy: 0, pierce: 1, brick: 1, size: 6 }),
  ];
  update(pierced, { dir: null, fire: false }, 0.016);
  assert.equal(pierced.brickHp[index], 1);
  assert.equal(pierced.tiles[index], "brick");
  assert.equal(pierced.bullets.length, 1);
  assert.equal(pierced.bullets[0].pierce, 0);
});

test("убийство приносит детали, а ангар тратит их на танк и оружие", () => {
  const hunt = createGame(quiet);
  const enemy = hunt.enemies[0];
  enemy.speed = 0;
  enemy.hp = 3;
  hunt.toSpawn = 3;
  hunt.bullets = [bullet({ x: enemy.x + 8, y: enemy.y + 8, damage: 1 })];
  update(hunt, { dir: null, fire: false }, 0.016);
  assert.equal(hunt.score, 0);
  assert.equal(enemy.hp, 2);
  assert.equal(enemy.alive, true);

  hunt.bullets = [bullet({ x: enemy.x + 8, y: enemy.y + 8, damage: 3 })];
  update(hunt, { dir: null, fire: false }, 0.016);
  assert.equal(hunt.score, 100);
  assert.equal(hunt.parts, 10);

  const rich = { ...defaultLoadout(), parts: 100 };
  const tuned = buyUpgrade(rich, "engine");
  assert.equal(tuned.engine, 1);
  assert.equal(tuned.parts, 100 - UPGRADES.engine.cost(0));
  assert.equal(rich.engine, 0);
  assert.equal(buyUpgrade({ ...rich, parts: 0 }, "engine"), null);
  assert.equal(buyUpgrade({ ...rich, engine: UPGRADES.engine.max }, "engine"), null);

  const armed = buyWeapon({ ...defaultLoadout(), parts: 40 }, "mg");
  assert.equal(armed.weapon, "mg");
  assert.equal(armed.parts, 0);
  assert.ok(armed.unlocked.includes("mg"));
  assert.equal(buyWeapon(armed, "mg"), null);
  assert.equal(selectWeapon(armed, "cannon").weapon, "cannon");
  assert.equal(selectWeapon(defaultLoadout(), "howitzer"), null);

  const messy = normalizeLoadout({
    engine: 99,
    armor: -3,
    weapon: "nope",
    unlocked: ["mg", "fake"],
    parts: 12.9,
  });
  assert.equal(messy.engine, 4);
  assert.equal(messy.armor, 0);
  assert.equal(messy.weapon, "cannon");
  assert.equal(messy.parts, 12);
  assert.ok(messy.unlocked.includes("cannon"));
  assert.ok(messy.unlocked.includes("mg"));
  assert.equal(normalizeLoadout(null).weapon, "cannon");

  const fast = createGame(quiet, { ...defaultLoadout(), engine: 2 });
  assert.equal(fast.player.speed, 128 * 1.24);
  const plated = createGame(quiet, { ...defaultLoadout(), armor: 2, parts: 200 });
  assert.equal(plated.lives, 5);
  plated.player.x = 123;
  syncLoadout(plated, buyUpgrade(plated.loadout, "armor"));
  assert.equal(plated.player.x, 123);
  assert.equal(plated.lives, 6);
  assert.equal(plated.maxLives, 6);
  assert.equal(plated.parts, 200 - UPGRADES.armor.cost(2));
});
