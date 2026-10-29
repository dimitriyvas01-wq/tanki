export const TILE = 40;
export const COLS = 17;
export const ROWS = 13;
export const TANK = 30;
export const FIELD_W = COLS * TILE;
export const FIELD_H = ROWS * TILE;

const MARGIN = (TILE - TANK) / 2;
const BULLET = 6;
const BULLET_SPEED = 340;
const PLAYER_SPEED = 128;
const ENEMY_SPEED = 78;

const MAP = [
  "SSSSSSSSSSSSSSSSS",
  "S...............S",
  "S.##.##.##.##.#.S",
  "S.#...#...#...#.S",
  "S.#.S.#.S.#.S.#.S",
  "S...............S",
  "S.##.##...##.##.S",
  "S....#.....#....S",
  "S.#..#..#..#..#.S",
  "S...............S",
  "S.##.##.#.##.##.S",
  "S....###B###....S",
  "SSSSSSSSSSSSSSSSS",
];

const SPAWNS = [
  [4, 1],
  [10, 1],
  [15, 1],
];

export function createGame(rng = Math.random) {
  if (MAP.length !== ROWS || MAP.some((row) => row.length !== COLS)) {
    throw new Error("Карта боя имеет неверный размер");
  }

  const tiles = [];
  const brickHp = [];
  for (const row of MAP) {
    for (const ch of row) {
      if (ch === "S") {
        tiles.push("steel");
        brickHp.push(0);
      } else if (ch === "#") {
        tiles.push("brick");
        brickHp.push(2);
      } else if (ch === "B") {
        tiles.push("base");
        brickHp.push(0);
      } else {
        tiles.push("empty");
        brickHp.push(0);
      }
    }
  }

  const game = {
    tiles,
    brickHp,
    player: placeTank(0, 2, 11, "up", PLAYER_SPEED, true),
    enemies: [],
    bullets: [],
    fx: [],
    score: 0,
    lives: 3,
    wave: 1,
    age: 0,
    toSpawn: 4,
    spawnCooldown: 2,
    phase: "playing",
    reason: null,
    banner: "Волна 1",
    bannerTime: 2.2,
    nextId: 1,
    rng,
  };

  spawnAt(game, 4, 1, "down");
  spawnAt(game, 15, 1, "down");
  return game;
}

export function update(game, input, dt) {
  if (game.phase !== "playing") return;

  const step = Math.min(Math.max(dt, 0), 0.05);
  game.age += step;
  game.bannerTime = Math.max(0, game.bannerTime - step);
  game.player.cooldown = Math.max(0, game.player.cooldown - step);
  game.player.invuln = Math.max(0, game.player.invuln - step);

  if (input.dir) {
    game.player.dir = input.dir;
    slide(game, game.player, input.dir, step);
  }
  if (input.fire) fire(game, game.player, "player");

  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    enemy.cooldown = Math.max(0, enemy.cooldown - step);
    enemy.turnTimer -= step;
    if (enemy.turnTimer <= 0) {
      enemy.dir = chooseEnemyDir(game, enemy);
      enemy.turnTimer = 0.55 + game.rng() * 1.15;
    }
    const moved = slide(game, enemy, enemy.dir, step);
    if (!moved) {
      enemy.dir = chooseEnemyDir(game, enemy);
      enemy.turnTimer = 0.35 + game.rng() * 0.4;
    }
    if (shouldShoot(game, enemy)) fire(game, enemy, "enemy");
  }

  for (const bullet of game.bullets) {
    if (!bullet.alive) continue;
    bullet.x += bullet.vx * step;
    bullet.y += bullet.vy * step;
    resolveBullet(game, bullet);
  }

  game.spawnCooldown -= step;
  const cap = Math.min(4, 1 + game.wave);
  const aliveEnemies = game.enemies.filter((enemy) => enemy.alive).length;
  if (game.toSpawn > 0 && aliveEnemies < cap && game.spawnCooldown <= 0) {
    if (spawnEnemy(game)) {
      game.toSpawn -= 1;
      game.spawnCooldown = 1.7;
    } else {
      game.spawnCooldown = 0.35;
    }
  }

  const enemiesLeft = game.enemies.some((enemy) => enemy.alive);
  if (game.toSpawn === 0 && !enemiesLeft && game.phase === "playing") {
    game.wave += 1;
    game.toSpawn = 3 + game.wave * 2;
    game.spawnCooldown = 1.1;
    game.banner = `Волна ${game.wave}`;
    game.bannerTime = 2;
  }

  game.bullets = game.bullets.filter((bullet) => bullet.alive);
  game.enemies = game.enemies.filter((enemy) => enemy.alive);
  for (const fx of game.fx) fx.life -= step;
  game.fx = game.fx.filter((fx) => fx.life > 0);
}

function placeTank(id, col, row, dir, speed, player) {
  return {
    id,
    x: col * TILE + MARGIN,
    y: row * TILE + MARGIN,
    w: TANK,
    h: TANK,
    dir,
    speed,
    cooldown: 0,
    alive: true,
    turnTimer: 0.8,
    player,
    invuln: player ? 1.4 : 0,
  };
}

function spawnAt(game, col, row, dir) {
  const tank = placeTank(game.nextId++, col, row, dir, enemySpeed(game), false);
  tank.turnTimer = 0.7 + game.rng() * 0.6;
  game.enemies.push(tank);
}

function spawnEnemy(game) {
  const spots = [...SPAWNS].sort(() => game.rng() - 0.5);
  for (const [col, row] of spots) {
    const tank = placeTank(game.nextId, col, row, "down", enemySpeed(game), false);
    if (blocked(game, tank.x, tank.y, tank.w, tank.h, tank)) continue;
    tank.turnTimer = 0.45 + game.rng() * 0.7;
    game.nextId += 1;
    game.enemies.push(tank);
    return true;
  }
  return false;
}

function enemySpeed(game) {
  return ENEMY_SPEED + Math.min(game.wave - 1, 6) * 8;
}

function slide(game, tank, dir, dt) {
  align(game, tank, dir, dt);
  const dist = tank.speed * dt;
  let dx = 0;
  let dy = 0;
  if (dir === "left") dx = -dist;
  else if (dir === "right") dx = dist;
  else if (dir === "up") dy = -dist;
  else dy = dist;

  if (blocked(game, tank.x + dx, tank.y + dy, tank.w, tank.h, tank)) return false;
  tank.x += dx;
  tank.y += dy;
  return true;
}

function align(game, tank, dir, dt) {
  const centerX = tank.x + tank.w / 2;
  const centerY = tank.y + tank.h / 2;
  const tileCenterX = Math.floor(centerX / TILE) * TILE + TILE / 2;
  const tileCenterY = Math.floor(centerY / TILE) * TILE + TILE / 2;
  const max = tank.speed * dt;

  if (dir === "left" || dir === "right") {
    const off = tileCenterY - centerY;
    if (Math.abs(off) > 0.5 && Math.abs(off) < TILE * 0.45) {
      const step = Math.sign(off) * Math.min(Math.abs(off), max);
      if (!blocked(game, tank.x, tank.y + step, tank.w, tank.h, tank)) tank.y += step;
    }
  } else {
    const off = tileCenterX - centerX;
    if (Math.abs(off) > 0.5 && Math.abs(off) < TILE * 0.45) {
      const step = Math.sign(off) * Math.min(Math.abs(off), max);
      if (!blocked(game, tank.x + step, tank.y, tank.w, tank.h, tank)) tank.x += step;
    }
  }
}

function blocked(game, x, y, w, h, self) {
  for (const cell of coveredTiles(x, y, w, h)) {
    const tile = tileAt(game, cell.c, cell.r);
    if (tile === "brick" || tile === "steel" || tile === "base") return true;
  }
  const tanks = [game.player, ...game.enemies];
  for (const other of tanks) {
    if (!other.alive || other === self) continue;
    if (overlap(x, y, w, h, other.x, other.y, other.w, other.h)) return true;
  }
  return false;
}

function fire(game, tank, owner) {
  if (!tank.alive || tank.cooldown > 0) return;
  if (game.bullets.some((bullet) => bullet.alive && bullet.tankId === tank.id)) return;

  tank.cooldown = owner === "player" ? 0.32 : 1.05;
  const cx = tank.x + tank.w / 2;
  const cy = tank.y + tank.h / 2;
  let vx = 0;
  let vy = 0;
  if (tank.dir === "left") vx = -BULLET_SPEED;
  else if (tank.dir === "right") vx = BULLET_SPEED;
  else if (tank.dir === "up") vy = -BULLET_SPEED;
  else vy = BULLET_SPEED;

  const muzzle = tank.w / 2 + 2;
  game.bullets.push({
    x: cx + Math.sign(vx) * muzzle - BULLET / 2,
    y: cy + Math.sign(vy) * muzzle - BULLET / 2,
    vx,
    vy,
    owner,
    tankId: tank.id,
    alive: true,
  });
}

function shouldShoot(game, enemy) {
  if (enemy.cooldown > 0) return false;
  const playerCenter = {
    x: game.player.x + game.player.w / 2,
    y: game.player.y + game.player.h / 2,
  };
  if (facing(enemy, playerCenter.x, playerCenter.y)) return true;
  if (game.age < 8) return false;
  const base = baseCenter(game);
  return facing(enemy, base.x, base.y);
}

function facing(tank, x, y) {
  const cx = tank.x + tank.w / 2;
  const cy = tank.y + tank.h / 2;
  if ((tank.dir === "left" || tank.dir === "right") && Math.abs(cy - y) < 12) {
    return tank.dir === "left" ? x < cx : x > cx;
  }
  if ((tank.dir === "up" || tank.dir === "down") && Math.abs(cx - x) < 12) {
    return tank.dir === "up" ? y < cy : y > cy;
  }
  return false;
}

function chooseEnemyDir(game, enemy) {
  const options = ["up", "down", "left", "right"];
  if (game.rng() < 0.62) {
    const base = baseCenter(game);
    const playerX = game.player.x + game.player.w / 2;
    const playerY = game.player.y + game.player.h / 2;
    const target = game.age < 8 || game.rng() < 0.55 ? { x: playerX, y: playerY } : base;
    const dx = target.x - (enemy.x + enemy.w / 2);
    const dy = target.y - (enemy.y + enemy.h / 2);
    const toward = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    if (toward !== opposite(enemy.dir) || game.rng() < 0.35) return toward;
  }
  const turned = options.filter((dir) => dir !== enemy.dir);
  return turned[Math.floor(game.rng() * turned.length)] ?? "down";
}

function opposite(dir) {
  if (dir === "up") return "down";
  if (dir === "down") return "up";
  if (dir === "left") return "right";
  return "left";
}

function resolveBullet(game, bullet) {
  if (bullet.x < 0 || bullet.y < 0 || bullet.x + BULLET > FIELD_W || bullet.y + BULLET > FIELD_H) {
    bullet.alive = false;
    return;
  }

  for (const cell of coveredTiles(bullet.x, bullet.y, BULLET, BULLET)) {
    const tile = tileAt(game, cell.c, cell.r);
    if (tile === "steel") {
      bullet.alive = false;
      return;
    }
    if (tile === "brick") {
      const index = cell.r * COLS + cell.c;
      const left = (game.brickHp[index] || 1) - 1;
      game.brickHp[index] = Math.max(0, left);
      boom(game, cell.c * TILE + TILE / 2, cell.r * TILE + TILE / 2, false);
      bullet.alive = false;
      if (left <= 0) game.tiles[index] = "empty";
      return;
    }
    if (tile === "base") {
      bullet.alive = false;
      boom(game, cell.c * TILE + TILE / 2, cell.r * TILE + TILE / 2, true);
      game.phase = "gameover";
      game.reason = "base";
      return;
    }
  }

  if (bullet.owner === "enemy" && game.player.alive && game.player.invuln <= 0 && hitsTank(bullet, game.player)) {
    bullet.alive = false;
    boom(game, game.player.x + game.player.w / 2, game.player.y + game.player.h / 2, true);
    game.lives -= 1;
    if (game.lives <= 0) {
      game.player.alive = false;
      game.phase = "gameover";
      game.reason = "lives";
    } else {
      const fresh = placeTank(game.player.id, 3, 11, "up", PLAYER_SPEED, true);
      game.player.x = fresh.x;
      game.player.y = fresh.y;
      game.player.dir = fresh.dir;
      game.player.invuln = 1.8;
      game.player.alive = true;
    }
    return;
  }

  if (bullet.owner === "player") {
    for (const enemy of game.enemies) {
      if (!enemy.alive || !hitsTank(bullet, enemy)) continue;
      enemy.alive = false;
      bullet.alive = false;
      game.score += 100;
      boom(game, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, true);
      return;
    }
  }
}

function hitsTank(bullet, tank) {
  return overlap(bullet.x, bullet.y, BULLET, BULLET, tank.x, tank.y, tank.w, tank.h);
}

function boom(game, x, y, big) {
  game.fx.push({ x, y, life: big ? 0.45 : 0.28, max: big ? 0.45 : 0.28, big });
}

function baseCenter(game) {
  const index = game.tiles.indexOf("base");
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function tileAt(game, c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return "steel";
  return game.tiles[r * COLS + c] ?? "steel";
}

function coveredTiles(x, y, w, h) {
  const c0 = Math.floor(x / TILE);
  const c1 = Math.floor((x + w - 0.001) / TILE);
  const r0 = Math.floor(y / TILE);
  const r1 = Math.floor((y + h - 0.001) / TILE);
  const cells = [];
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) cells.push({ c, r });
  }
  return cells;
}

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
