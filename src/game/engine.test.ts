import assert from "node:assert/strict";
import { COLS, TILE, createGame, update, type Bullet } from "./engine";

const quiet = () => 0;

function bullet(partial: Partial<Bullet> & Pick<Bullet, "x" | "y">): Bullet {
  return {
    vx: 0,
    vy: 0,
    owner: "player",
    tankId: 99,
    alive: true,
    ...partial,
  };
}

const brickGame = createGame(quiet);
brickGame.enemies = [];
brickGame.toSpawn = 3;
const brickIndex = 2 * COLS + 4;
brickGame.tiles[brickIndex] = "brick";
brickGame.bullets = [bullet({ x: 4 * TILE + 16, y: 2 * TILE + 16 })];
update(brickGame, { dir: null, fire: false }, 0.016);
assert.equal(brickGame.tiles[brickIndex], "empty");
assert.equal(brickGame.bullets.length, 0);

const scoreGame = createGame(quiet);
const enemy = scoreGame.enemies[0];
assert.ok(enemy);
enemy.speed = 0;
scoreGame.toSpawn = 3;
scoreGame.bullets = [
  bullet({
    x: enemy.x + 8,
    y: enemy.y + 8,
    owner: "player",
  }),
];
update(scoreGame, { dir: null, fire: false }, 0.016);
assert.equal(scoreGame.score, 100);
assert.equal(scoreGame.enemies.some((item) => item.id === enemy.id), false);

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

const wallGame = createGame(quiet);
wallGame.enemies = [];
wallGame.toSpawn = 3;
wallGame.player.x = TILE;
wallGame.player.y = TILE + 5;
wallGame.player.invuln = 0;
const startX = wallGame.player.x;
update(wallGame, { dir: "left", fire: false }, 0.5);
assert.equal(wallGame.player.x, startX);

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

console.log("engine tests passed");
