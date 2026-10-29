"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLS,
  FIELD_H,
  FIELD_W,
  ROWS,
  TILE,
  createGame,
  update,
  type Dir,
  type Game,
  type Input,
  type Phase,
  type Tank,
} from "@/game/engine";

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
};

type Hud = {
  score: number;
  lives: number;
  wave: number;
  phase: Phase;
  reason: Game["reason"];
};

export function TankGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(createGame());
  const keyDirs = useRef(new Set<Dir>());
  const pointerDirs = useRef(new Set<Dir>());
  const recent = useRef<Dir | null>(null);
  const keyFire = useRef(false);
  const pointerFire = useRef(false);
  const bestRef = useRef(0);
  const bestLoaded = useRef(false);
  const recordRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<() => void>(() => {});
  const restartRef = useRef<() => void>(() => {});
  const publishRef = useRef<(game: Game) => void>(() => {});
  const [hud, setHud] = useState<Hud>({
    score: 0,
    lives: 3,
    wave: 1,
    phase: "playing",
    reason: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context: CanvasRenderingContext2D = ctx;

    const applyScale = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = FIELD_W * dpr;
      canvas.height = FIELD_H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    applyScale();
    window.addEventListener("resize", applyScale);

    let frame = requestAnimationFrame(loop);
    let last = performance.now();

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const game = gameRef.current;
      rememberBest(game);
      if (game.phase === "playing") {
        let left = dt;
        while (left > 0) {
          const step = Math.min(left, 1 / 60);
          update(game, readInput(), step);
          left -= step;
        }
      }
      draw(context, game);
      publish(game);
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", applyScale);
    };
  }, []);

  function readInput(): Input {
    const down = new Set<Dir>([...keyDirs.current, ...pointerDirs.current]);
    let dir: Dir | null = null;
    if (recent.current && down.has(recent.current)) dir = recent.current;
    else dir = (["up", "left", "down", "right"] as Dir[]).find((item) => down.has(item)) ?? null;
    return { dir, fire: keyFire.current || pointerFire.current };
  }

  function publish(game: Game) {
    setHud((current) => {
      if (
        current.score === game.score &&
        current.lives === game.lives &&
        current.wave === game.wave &&
        current.phase === game.phase &&
        current.reason === game.reason
      ) {
        return current;
      }
      return {
        score: game.score,
        lives: game.lives,
        wave: game.wave,
        phase: game.phase,
        reason: game.reason,
      };
    });
  }

  function togglePause() {
    const game = gameRef.current;
    if (game.phase === "playing") game.phase = "paused";
    else if (game.phase === "paused") game.phase = "playing";
    else return;
    publish(game);
  }

  function restart() {
    gameRef.current = createGame();
    setHud({ score: 0, lives: 3, wave: 1, phase: "playing", reason: null });
  }

  function rememberBest(game: Game) {
    if (!bestLoaded.current) {
      bestLoaded.current = true;
      try {
        const stored = Number(localStorage.getItem("tanki-best") || "0");
        if (Number.isFinite(stored) && stored > 0) bestRef.current = stored;
      } catch {
        // Рекорд необязателен: приватный режим может запретить localStorage.
      }
    }
    if (game.phase === "gameover" && game.score > bestRef.current) {
      bestRef.current = game.score;
      try {
        localStorage.setItem("tanki-best", String(game.score));
      } catch {
        // Игра продолжается и без сохранённого рекорда.
      }
    }
    const node = recordRef.current;
    if (!node) return;
    const text = `Рекорд: ${Math.max(bestRef.current, game.score)}`;
    if (node.textContent !== text) node.textContent = text;
  }

  toggleRef.current = togglePause;
  restartRef.current = restart;
  publishRef.current = publish;

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const dir = KEY_DIR[event.code];
      if (dir) {
        event.preventDefault();
        keyDirs.current.add(dir);
        recent.current = dir;
      }
      if (event.code === "Space" || event.code === "KeyJ") {
        event.preventDefault();
        keyFire.current = true;
      }
      if ((event.code === "KeyP" || event.code === "Escape") && !event.repeat) {
        event.preventDefault();
        toggleRef.current();
      }
      if (event.code === "Enter" && !event.repeat && gameRef.current.phase === "gameover") {
        restartRef.current();
      }
    };
    const up = (event: KeyboardEvent) => {
      const dir = KEY_DIR[event.code];
      if (dir) keyDirs.current.delete(dir);
      if (event.code === "Space" || event.code === "KeyJ") keyFire.current = false;
    };
    const hidden = () => {
      const game = gameRef.current;
      if (document.hidden && game.phase === "playing") {
        game.phase = "paused";
        publishRef.current(game);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  const endText =
    hud.reason === "base" ? "База уничтожена" : "Жизни закончились";

  return (
    <div className="min-h-screen bg-[#10160f] text-[#e7f0d4]">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <h1 className="font-mono text-3xl font-bold tracking-[0.28em] text-[#d6ef9a]">ТАНКИ</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-sm text-[#c9d7b4]">
          <span data-score={hud.score}>Счёт: {hud.score}</span>
          <span>Волна: {hud.wave}</span>
          <span>Жизни: {hud.lives}</span>
          <span ref={recordRef}>Рекорд: 0</span>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-[#3d5234] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <canvas
            ref={canvasRef}
            className="block h-auto w-full bg-[#172216]"
            role="img"
            aria-label="Поле танкового боя"
          />
          {hud.phase !== "playing" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-4">
              <div className="w-full max-w-sm rounded-xl border border-[#d6ef9a]/40 bg-[#182214] px-6 py-5 text-center">
                <p className="font-mono text-2xl text-[#d6ef9a]">
                  {hud.phase === "paused" ? "Пауза" : "Бой окончен"}
                </p>
                {hud.phase === "gameover" ? (
                  <p className="mt-2 text-[#c9d7b4]">
                    {endText}. Счёт: {hud.score}
                  </p>
                ) : (
                  <p className="mt-2 text-[#c9d7b4]">Бой остановлен</p>
                )}
                <button
                  type="button"
                  className="mt-4 rounded-md bg-[#d6ef9a] px-5 py-2 font-medium text-[#172214]"
                  onClick={hud.phase === "paused" ? togglePause : restart}
                >
                  {hud.phase === "paused" ? "Дальше" : "Ещё раз"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <p className="text-sm text-[#b7c7a4]">
          Стрелки или WASD — движение, пробел — выстрел, P — пауза. Защитите базу внизу карты.
        </p>

        <div className="flex items-end justify-between gap-6">
          <div className="grid w-40 grid-cols-3 gap-2">
            <span />
            <HoldButton label="Вверх" onHold={(down) => holdDir("up", down)} />
            <span />
            <HoldButton label="Влево" onHold={(down) => holdDir("left", down)} />
            <HoldButton label="Вниз" onHold={(down) => holdDir("down", down)} />
            <HoldButton label="Вправо" onHold={(down) => holdDir("right", down)} />
          </div>
          <div className="flex gap-2">
            <HoldButton
              label="Огонь"
              wide
              onHold={(down) => {
                pointerFire.current = down;
              }}
            />
            <button
              type="button"
              className="h-14 rounded-md border border-[#3d5234] px-4 font-medium"
              onClick={togglePause}
            >
              Пауза
            </button>
          </div>
        </div>
      </main>
    </div>
  );

  function holdDir(dir: Dir, down: boolean) {
    if (down) {
      pointerDirs.current.add(dir);
      recent.current = dir;
    } else {
      pointerDirs.current.delete(dir);
    }
  }
}

function HoldButton({
  label,
  onHold,
  wide = false,
}: {
  label: string;
  onHold: (down: boolean) => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={`touch-none select-none rounded-md border border-[#3d5234] bg-[#1d2b18] font-medium ${
        wide ? "h-14 px-5" : "h-12"
      }`}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}

function draw(ctx: CanvasRenderingContext2D, game: Game) {
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);
  ctx.fillStyle = "#1a2818";
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const tile = game.tiles[r * COLS + c];
      const x = c * TILE;
      const y = r * TILE;
      if ((c + r) % 2 === 0) {
        ctx.fillStyle = "#20341c";
        ctx.fillRect(x, y, TILE, TILE);
      }
      if (tile === "brick") drawBrick(ctx, x, y, game.brickHp[r * COLS + c] === 1);
      else if (tile === "steel") drawSteel(ctx, x, y);
      else if (tile === "base") drawBase(ctx, x, y, game.phase !== "gameover" || game.reason !== "base");
    }
  }

  for (const enemy of game.enemies) drawTank(ctx, enemy, "#d4534a", "#7d241f");
  if (game.player.alive && (game.player.invuln <= 0 || Math.floor(game.player.invuln * 12) % 2 === 0)) {
    drawTank(ctx, game.player, "#c6ef63", "#3d6b18");
  }

  for (const bullet of game.bullets) {
    ctx.fillStyle = bullet.owner === "player" ? "#ffe27a" : "#ffb089";
    ctx.fillRect(bullet.x, bullet.y, 6, 6);
  }

  for (const fx of game.fx) {
    const t = 1 - fx.life / fx.max;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 186, 92, ${1 - t})`;
    ctx.arc(fx.x, fx.y, (fx.big ? 8 : 4) + t * (fx.big ? 22 : 12), 0, Math.PI * 2);
    ctx.fill();
  }

  if (game.bannerTime > 0) {
    ctx.fillStyle = "rgba(214, 239, 154, 0.92)";
    ctx.font = "700 28px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(game.banner, FIELD_W / 2, 78);
  }
}

function drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number, damaged: boolean) {
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

function drawSteel(ctx: CanvasRenderingContext2D, x: number, y: number) {
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

function drawBase(ctx: CanvasRenderingContext2D, x: number, y: number, alive: boolean) {
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

function drawTank(ctx: CanvasRenderingContext2D, tank: Tank, body: string, track: string) {
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
