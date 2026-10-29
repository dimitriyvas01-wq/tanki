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

export const WEAPONS = {
  cannon: {
    id: "cannon",
    name: "Пушка",
    cooldown: 0.32,
    damage: 1,
    speed: 340,
    size: 6,
    max: 1,
    spread: 0,
    pellets: 1,
    ttl: null,
    bounce: 0,
    brick: 1,
    price: 0,
  },
  mg: {
    id: "mg",
    name: "Пулемёт",
    cooldown: 0.12,
    damage: 1,
    speed: 480,
    size: 4,
    max: 4,
    spread: 0,
    pellets: 1,
    ttl: null,
    bounce: 0,
    brick: 1,
    price: 40,
  },
  howitzer: {
    id: "howitzer",
    name: "Гаубица",
    cooldown: 0.72,
    damage: 3,
    speed: 230,
    size: 11,
    max: 1,
    spread: 0,
    pellets: 1,
    ttl: null,
    bounce: 0,
    brick: 4,
    price: 80,
  },
  shotgun: {
    id: "shotgun",
    name: "Дробовик",
    cooldown: 0.55,
    damage: 1,
    speed: 300,
    size: 5,
    max: 3,
    spread: 0.38,
    pellets: 3,
    ttl: 0.32,
    bounce: 0,
    brick: 1,
    price: 110,
  },
  ricochet: {
    id: "ricochet",
    name: "Рикошет",
    cooldown: 0.4,
    damage: 1,
    speed: 360,
    size: 6,
    max: 1,
    spread: 0,
    pellets: 1,
    ttl: null,
    bounce: 1,
    brick: 1,
    price: 150,
  },
};

export const WEAPON_ORDER = ["cannon", "mg", "howitzer", "shotgun", "ricochet"];

export const UPGRADES = {
  engine: { name: "Двигатель", max: 4, blurb: "Скорость танка", cost: (level) => 20 + level * 15 },
  armor: { name: "Броня", max: 3, blurb: "Дополнительная жизнь", cost: (level) => 25 + level * 20 },
  reload: { name: "Перезарядка", max: 4, blurb: "Короче пауза между выстрелами", cost: (level) => 20 + level * 15 },
  damage: { name: "Снаряды", max: 4, blurb: "Больше урон каждого выстрела", cost: (level) => 30 + level * 20 },
};

export const MODIFIERS = {
  rapid: { name: "Скорострельность", seconds: 8 },
  pierce: { name: "Бронебойные", seconds: 8 },
  power: { name: "Усиленный урон", seconds: 8 },
};

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

export function defaultLoadout() {
  return {
    engine: 0,
    armor: 0,
    reload: 0,
    damage: 0,
    weapon: "cannon",
    parts: 0,
    unlocked: ["cannon"],
  };
}

export function normalizeLoadout(raw) {
  const base = defaultLoadout();
  if (!raw || typeof raw !== "object") return base;
  const unlocked = Array.isArray(raw.unlocked) ? raw.unlocked.filter((id) => WEAPONS[id]) : ["cannon"];
  if (!unlocked.includes("cannon")) unlocked.unshift("cannon");
  const clamp = (value, max) => Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
  const weapon = unlocked.includes(raw.weapon) ? raw.weapon : "cannon";
  return {
    engine: clamp(raw.engine, UPGRADES.engine.max),
    armor: clamp(raw.armor, UPGRADES.armor.max),
    reload: clamp(raw.reload, UPGRADES.reload.max),
    damage: clamp(raw.damage, UPGRADES.damage.max),
    weapon,
    parts: Math.max(0, Math.floor(Number(raw.parts) || 0)),
    unlocked,
  };
}

export function buyUpgrade(loadout, id) {
  const spec = UPGRADES[id];
  if (!spec || loadout[id] >= spec.max) return null;
  const price = spec.cost(loadout[id]);
  if (loadout.parts < price) return null;
  return { ...loadout, unlocked: [...loadout.unlocked], [id]: loadout[id] + 1, parts: loadout.parts - price };
}

export function buyWeapon(loadout, id) {
  const weapon = WEAPONS[id];
  if (!weapon || loadout.unlocked.includes(id)) return null;
  if (loadout.parts < weapon.price) return null;
  return { ...loadout, parts: loadout.parts - weapon.price, unlocked: [...loadout.unlocked, id], weapon: id };
}

export function selectWeapon(loadout, id) {
  if (!loadout.unlocked.includes(id)) return null;
  return { ...loadout, weapon: id };
}

export function syncLoadout(game, loadout) {
  const speed = PLAYER_SPEED * (1 + 0.12 * loadout.engine);
  game.loadout = loadout;
  game.player.speed = speed;
  game.playerSpeed = speed;
  const maxLives = 3 + loadout.armor;
  const previous = game.maxLives ?? maxLives;
  if (maxLives > previous) game.lives += maxLives - previous;
  game.maxLives = maxLives;
  game.parts = loadout.parts;
}

export function createGame(rng = Math.random, loadout = defaultLoadout()) {
  if (MAP.length !== ROWS || MAP.some((row) => row.length !== COLS)) {
    throw new Error("Карта боя имеет неверный размер");
  }

  const ready = normalizeLoadout(loadout);
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

  const speed = PLAYER_SPEED * (1 + 0.12 * ready.engine);
  const game = {
    tiles,
    brickHp,
    player: placeTank(0, 2, 11, "up", speed, true),
    enemies: [],
    bullets: [],
    fx: [],
    pickups: [],
    mods: { rapid: 0, pierce: 0, power: 0 },
    score: 0,
    lives: 3 + ready.armor,
    maxLives: 3 + ready.armor,
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
    loadout: ready,
    parts: ready.parts,
    playerSpeed: speed,
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
  for (const key of Object.keys(game.mods)) game.mods[key] = Math.max(0, game.mods[key] - step);

  if (input.dir) {
    game.player.dir = input.dir;
    slide(game, game.player, input.dir, step);
  }
  if (input.fire) fire(game, game.player, "player");
  collectPickups(game);

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
    if (bullet.ttl != null) {
      bullet.ttl -= step;
      if (bullet.ttl <= 0) {
        bullet.alive = false;
        continue;
      }
    }
    bullet.x += bullet.vx * step;
    bullet.y += bullet.vy * step;
    resolveBullet(game, bullet);
  }

  for (const pickup of game.pickups) pickup.life -= step;
  game.pickups = game.pickups.filter((pickup) => pickup.life > 0);

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

function placeTank(id, col, row, dir, speed, player, hp = 1) {
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
    hp,
    maxHp: hp,
  };
}

function enemyHp(game) {
  return 1 + Math.floor((game.wave - 1) / 2);
}

function spawnAt(game, col, row, dir) {
  const hp = enemyHp(game);
  const tank = placeTank(game.nextId++, col, row, dir, enemySpeed(game), false, hp);
  tank.turnTimer = 0.7 + game.rng() * 0.6;
  game.enemies.push(tank);
}

function spawnEnemy(game) {
  const spots = [...SPAWNS].sort(() => game.rng() - 0.5);
  const hp = enemyHp(game);
  for (const [col, row] of spots) {
    const tank = placeTank(game.nextId, col, row, "down", enemySpeed(game), false, hp);
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

function playerWeapon(game) {
  return WEAPONS[game.loadout?.weapon] ?? WEAPONS.cannon;
}

function fire(game, tank, owner) {
  if (!tank.alive || tank.cooldown > 0) return;
  if (owner === "enemy") {
    if (game.bullets.some((bullet) => bullet.alive && bullet.tankId === tank.id)) return;
    tank.cooldown = 1.05;
    spawnBullet(game, tank, "enemy", {
      speed: BULLET_SPEED,
      size: BULLET,
      damage: 1,
      brick: 1,
      bounce: 0,
      pierce: 0,
      ttl: null,
      angle: 0,
    });
    return;
  }

  const weapon = playerWeapon(game);
  const flying = game.bullets.filter((bullet) => bullet.alive && bullet.tankId === tank.id).length;
  if (weapon.pellets > 1 ? flying > 0 : flying >= weapon.max) return;

  const reload = 1 - 0.08 * (game.loadout?.reload || 0);
  const rapid = game.mods.rapid > 0 ? 0.45 : 1;
  tank.cooldown = weapon.cooldown * reload * rapid;
  const damage = weapon.damage + (game.loadout?.damage || 0) + (game.mods.power > 0 ? 2 : 0);
  const pierce = game.mods.pierce > 0 ? 1 : 0;
  const angles = weapon.pellets === 1 ? [0] : [-weapon.spread, 0, weapon.spread];
  for (const angle of angles) {
    spawnBullet(game, tank, "player", {
      speed: weapon.speed,
      size: weapon.size,
      damage,
      brick: weapon.brick,
      bounce: weapon.bounce,
      pierce,
      ttl: weapon.ttl,
      angle,
    });
  }
}

function spawnBullet(game, tank, owner, spec) {
  const cx = tank.x + tank.w / 2;
  const cy = tank.y + tank.h / 2;
  const { vx, vy } = aimedVelocity(tank.dir, spec.speed, spec.angle);
  const muzzle = tank.w / 2 + 2;
  const len = Math.hypot(vx, vy) || 1;
  game.bullets.push({
    x: cx + (vx / len) * muzzle - spec.size / 2,
    y: cy + (vy / len) * muzzle - spec.size / 2,
    vx,
    vy,
    owner,
    tankId: tank.id,
    alive: true,
    size: spec.size,
    damage: spec.damage,
    brick: spec.brick,
    bounce: spec.bounce,
    pierce: spec.pierce,
    ttl: spec.ttl,
    hitIds: [],
  });
}

function aimedVelocity(dir, speed, angle) {
  let vx = 0;
  let vy = 0;
  if (dir === "left") vx = -speed;
  else if (dir === "right") vx = speed;
  else if (dir === "up") vy = -speed;
  else vy = speed;
  if (!angle) return { vx, vy };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { vx: vx * cos - vy * sin, vy: vx * sin + vy * cos };
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
  const size = bullet.size ?? BULLET;
  if (bullet.x < 0 || bullet.y < 0 || bullet.x + size > FIELD_W || bullet.y + size > FIELD_H) {
    bullet.alive = false;
    return;
  }

  for (const cell of coveredTiles(bullet.x, bullet.y, size, size)) {
    const tile = tileAt(game, cell.c, cell.r);
    if (tile === "steel") {
      if ((bullet.bounce ?? 0) > 0) {
        bullet.bounce -= 1;
        if (Math.abs(bullet.vx) >= Math.abs(bullet.vy)) bullet.vx *= -1;
        else bullet.vy *= -1;
        ejectFromSteel(bullet, cell);
      } else {
        bullet.alive = false;
      }
      return;
    }
    if (tile === "brick") {
      const index = cell.r * COLS + cell.c;
      const hit = bullet.brick ?? 1;
      const left = (game.brickHp[index] || 1) - hit;
      game.brickHp[index] = Math.max(0, left);
      boom(game, cell.c * TILE + TILE / 2, cell.r * TILE + TILE / 2, false);
      if (left <= 0) game.tiles[index] = "empty";
      passOrStop(bullet);
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
      const fresh = placeTank(game.player.id, 3, 11, "up", game.playerSpeed || PLAYER_SPEED, true);
      game.player.x = fresh.x;
      game.player.y = fresh.y;
      game.player.dir = fresh.dir;
      game.player.invuln = 1.8;
      game.player.alive = true;
      game.player.speed = game.playerSpeed || PLAYER_SPEED;
    }
    return;
  }

  if (bullet.owner === "player") {
    if (!bullet.hitIds) bullet.hitIds = [];
    for (const enemy of game.enemies) {
      if (!enemy.alive || bullet.hitIds.includes(enemy.id) || !hitsTank(bullet, enemy)) continue;
      enemy.hp = (enemy.hp ?? 1) - (bullet.damage ?? 1);
      bullet.hitIds.push(enemy.id);
      boom(game, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.hp <= 0);
      if (enemy.hp <= 0) {
        enemy.alive = false;
        game.score += 100;
        game.parts += 10;
        maybeDrop(game, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
      }
      passOrStop(bullet);
      return;
    }
  }
}

function passOrStop(bullet) {
  if ((bullet.pierce ?? 0) > 0 && (bullet.vx !== 0 || bullet.vy !== 0)) {
    bullet.pierce -= 1;
    const len = Math.hypot(bullet.vx, bullet.vy) || 1;
    bullet.x += (bullet.vx / len) * TILE * 0.85;
    bullet.y += (bullet.vy / len) * TILE * 0.85;
    return;
  }
  bullet.alive = false;
}

function ejectFromSteel(bullet, cell) {
  const size = bullet.size ?? BULLET;
  const left = cell.c * TILE;
  const top = cell.r * TILE;
  if (Math.abs(bullet.vx) >= Math.abs(bullet.vy)) {
    bullet.x = bullet.vx > 0 ? left + TILE + 1 : left - size - 1;
  } else {
    bullet.y = bullet.vy > 0 ? top + TILE + 1 : top - size - 1;
  }
}

function maybeDrop(game, x, y) {
  if (game.rng() >= 0.4) return;
  const kinds = ["rapid", "pierce", "power"];
  const kind = kinds[Math.floor(game.rng() * kinds.length)];
  game.pickups.push({ x: x - 8, y: y - 8, w: 16, h: 16, kind, life: 10 });
}

function collectPickups(game) {
  const player = game.player;
  if (!player.alive) return;
  for (const pickup of game.pickups) {
    if (pickup.life <= 0) continue;
    if (!overlap(player.x, player.y, player.w, player.h, pickup.x, pickup.y, pickup.w, pickup.h)) continue;
    pickup.life = 0;
    const spec = MODIFIERS[pickup.kind];
    if (spec) game.mods[pickup.kind] = Math.max(game.mods[pickup.kind], spec.seconds);
  }
}

function hitsTank(bullet, tank) {
  const size = bullet.size ?? BULLET;
  return overlap(bullet.x, bullet.y, size, size, tank.x, tank.y, tank.w, tank.h);
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
