import {
  BORDER_W,
  BRICK_GAP,
  BRICK_H,
  BRICK_PALETTE,
  BRICK_W,
  Ball,
  Brick,
  FloatingText,
  GAME_HEIGHT,
  GAME_WIDTH,
  GamePhase,
  HUD_H,
  HudSnapshot,
  PADDLE_DEFAULT_W,
  PADDLE_H,
  PADDLE_WIDE_W,
  PADDLE_Y,
  Particle,
  PowerUp,
  PowerUpKind,
  RGB,
  SpeedMode,
} from './types';
import { soundEngine } from './sound';

const HIGH_SCORE_KEY = 'neon_brick_breaker_high_score_v1';
const TRAIL_MAX_LEN = 16;

function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score: number) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export class BrickBreakerEngine {
  public phase: GamePhase = 'TITLE_MENU';
  public speedMode: SpeedMode = 'normal';

  public paddleX = GAME_WIDTH / 2 - PADDLE_DEFAULT_W / 2;
  public paddleW = PADDLE_DEFAULT_W;
  public readonly paddleY = PADDLE_Y;
  public readonly paddleH = PADDLE_H;

  public bricks: Brick[] = [];
  public balls: Ball[] = [];
  public powerUps: PowerUp[] = [];
  public particles: Particle[] = [];
  public popups: FloatingText[] = [];

  public score = 0;
  public highScore = loadHighScore();
  public combo = 0;
  public maxCombo = 0;
  public comboTimer = 0;
  public lives = 3;
  public level = 1;
  public wideTimer = 0;
  public ballWaiting = true;

  public railPulse = 0;
  public paddleFlash = 0;
  public screenShake = 0;

  private nextBrickId = 1;
  private moveLeft = false;
  private moveRight = false;

  constructor() {
    this.buildLevel(1);
  }

  private getBaseSpeed(): number {
    const modeBoost = this.speedMode === 'turbo' ? 1.18 : 1.0;
    const levelBoost = 1 + Math.min(this.level - 1, 5) * 0.055;
    return 6.6 * modeBoost * levelBoost;
  }

  private getMaxBallSpeed(): number {
    return this.speedMode === 'turbo' ? 11.2 : 9.6;
  }

  public setSpeedMode(mode: SpeedMode) {
    this.speedMode = mode;
  }

  public setKeyboardDirection(dir: 'left' | 'right', active: boolean) {
    if (dir === 'left') this.moveLeft = active;
    else this.moveRight = active;
  }

  public movePaddleTo(centerX: number) {
    if (this.phase !== 'PLAYING' && this.phase !== 'TITLE_MENU') return;
    this.paddleX = centerX - this.paddleW / 2;
    this.clampPaddle();
  }

  private clampPaddle() {
    const minX = BORDER_W + 4;
    const maxX = GAME_WIDTH - BORDER_W - 4 - this.paddleW;
    if (this.paddleX < minX) this.paddleX = minX;
    if (this.paddleX > maxX) this.paddleX = maxX;
  }

  private buildLevel(levelNum: number) {
    const bricks: Brick[] = [];
    const cols = 6;
    const rows = levelNum === 1 ? 4 : 5;
    const totalW = cols * BRICK_W + (cols - 1) * BRICK_GAP;
    const startX = Math.floor((GAME_WIDTH - totalW) / 2);
    const startY = HUD_H + 22;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Level 1 matches the classic 6x4 staggered neon grid in the screenshots
        if (levelNum === 2 && r === 4 && (c === 2 || c === 3)) continue;
        if (levelNum === 3 && (r === 2 && (c === 0 || c === 5))) continue;
        if (levelNum >= 4 && levelNum % 2 === 0 && (r + c) % 5 === 0 && r > 1) continue;

        const colorIndex = (r + c + (levelNum - 1)) % BRICK_PALETTE.length;
        const bx = startX + c * (BRICK_W + BRICK_GAP);
        const by = startY + r * (BRICK_H + BRICK_GAP);
        bricks.push({
          id: this.nextBrickId++,
          x: bx,
          y: by,
          w: BRICK_W,
          h: BRICK_H,
          colorIndex,
          color: BRICK_PALETTE[colorIndex],
          hitFlash: 0,
        });
      }
    }

    this.bricks = bricks;
  }

  public startNewGame() {
    soundEngine.unlock();
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.lives = 3;
    this.level = 1;
    this.wideTimer = 0;
    this.paddleW = PADDLE_DEFAULT_W;
    this.paddleX = GAME_WIDTH / 2 - this.paddleW / 2;
    this.balls = [];
    this.powerUps = [];
    this.particles = [];
    this.popups = [];
    this.ballWaiting = true;
    this.railPulse = 0;
    this.paddleFlash = 0;
    this.screenShake = 0;
    this.buildLevel(1);
    this.phase = 'PLAYING';
  }

  public togglePause() {
    if (this.phase === 'PLAYING') {
      this.phase = 'PAUSED';
    } else if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
    }
  }

  public launchBall() {
    soundEngine.unlock();
    if (this.phase === 'TITLE_MENU') {
      this.startNewGame();
    }
    if (this.phase !== 'PLAYING' || !this.ballWaiting) return;

    const angle = (Math.random() - 0.5) * 0.85;
    const speed = this.getBaseSpeed();
    this.balls.push({
      x: this.paddleX + this.paddleW / 2,
      y: this.paddleY - 10,
      vx: speed * Math.sin(angle),
      vy: -speed * Math.cos(angle),
      radius: 8,
      trail: [],
    });
    this.ballWaiting = false;
    soundEngine.playLaunch();
  }

  public update(dtMs: number) {
    // Cap delta to avoid huge jumps when switching tabs
    const dt = Math.min(dtMs, 34) / 16.6667;

    // Decay visual feedback timers even when paused/ending
    if (this.railPulse > 0) this.railPulse = Math.max(0, this.railPulse - 0.05 * dt);
    if (this.paddleFlash > 0) this.paddleFlash = Math.max(0, this.paddleFlash - 0.07 * dt);
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - 0.55 * dt);

    if (this.phase !== 'PLAYING') return;

    // Keyboard paddle control
    const paddleSpeed = this.speedMode === 'turbo' ? 10.5 : 9.0;
    if (this.moveLeft && !this.moveRight) {
      this.paddleX -= paddleSpeed * dt;
      this.clampPaddle();
    } else if (this.moveRight && !this.moveLeft) {
      this.paddleX += paddleSpeed * dt;
      this.clampPaddle();
    }

    // Wide paddle timer
    if (this.wideTimer > 0) {
      this.wideTimer -= dt;
      if (this.wideTimer <= 0) {
        this.wideTimer = 0;
        const cx = this.paddleX + this.paddleW / 2;
        this.paddleW = PADDLE_DEFAULT_W;
        this.paddleX = cx - this.paddleW / 2;
        this.clampPaddle();
      }
    }

    // Combo decay timer (~2.3 seconds at 60fps = 140 frames)
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.combo = 0;
      }
    }

    // Update balls with substepping to guarantee crisp collision accuracy
    if (!this.ballWaiting) {
      for (let i = this.balls.length - 1; i >= 0; i--) {
        const ball = this.balls[i];
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > TRAIL_MAX_LEN) {
          ball.trail.shift();
        }

        const speed = Math.hypot(ball.vx, ball.vy);
        const subSteps = Math.max(1, Math.ceil((speed * dt) / (ball.radius * 0.6)));
        const stepDt = dt / subSteps;

        for (let s = 0; s < subSteps; s++) {
          ball.x += ball.vx * stepDt;
          ball.y += ball.vy * stepDt;

          // Left / right walls
          if (ball.x - ball.radius <= BORDER_W) {
            ball.x = BORDER_W + ball.radius;
            ball.vx = Math.abs(ball.vx);
            this.railPulse = 0.7;
            soundEngine.playWallHit();
          } else if (ball.x + ball.radius >= GAME_WIDTH - BORDER_W) {
            ball.x = GAME_WIDTH - BORDER_W - ball.radius;
            ball.vx = -Math.abs(ball.vx);
            this.railPulse = 0.7;
            soundEngine.playWallHit();
          }

          // Top ceiling (below HUD line)
          if (ball.y - ball.radius <= HUD_H) {
            ball.y = HUD_H + ball.radius;
            ball.vy = Math.abs(ball.vy);
            soundEngine.playWallHit();
          }

          // Paddle collision
          if (
            ball.vy > 0 &&
            ball.x + ball.radius >= this.paddleX &&
            ball.x - ball.radius <= this.paddleX + this.paddleW &&
            ball.y + ball.radius >= this.paddleY &&
            ball.y - ball.radius <= this.paddleY + this.paddleH
          ) {
            ball.y = this.paddleY - ball.radius;
            const paddleCenter = this.paddleX + this.paddleW / 2;
            const hitOffset = Math.max(-0.9, Math.min(0.9, (ball.x - paddleCenter) / (this.paddleW / 2)));
            const bounceAngle = hitOffset * (Math.PI / 3); // max 60 deg
            const newSpeed = Math.min(this.getMaxBallSpeed(), Math.hypot(ball.vx, ball.vy) + 0.05);
            ball.vx = newSpeed * Math.sin(bounceAngle);
            ball.vy = -Math.abs(newSpeed * Math.cos(bounceAngle));
            this.paddleFlash = 1.0;
            soundEngine.playPaddleHit();
          }

          // Brick collision
          for (let b = this.bricks.length - 1; b >= 0; b--) {
            const brick = this.bricks[b];
            const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
            const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
            const dx = ball.x - closestX;
            const dy = ball.y - closestY;

            if (dx * dx + dy * dy <= ball.radius * ball.radius) {
              const brickCx = brick.x + brick.w / 2;
              const brickCy = brick.y + brick.h / 2;
              const overlapX = brick.w / 2 + ball.radius - Math.abs(ball.x - brickCx);
              const overlapY = brick.h / 2 + ball.radius - Math.abs(ball.y - brickCy);

              if (overlapX < overlapY) {
                ball.vx *= -1;
              } else {
                ball.vy *= -1;
              }

              this.handleBrickDestroyed(b);
              break;
            }
          }
        }

        // Bottom out
        if (ball.y - ball.radius > GAME_HEIGHT + 12) {
          this.balls.splice(i, 1);
        }
      }

      // Check lost all balls
      if (this.balls.length === 0) {
        this.lives -= 1;
        this.combo = 0;
        this.comboTimer = 0;
        if (this.lives <= 0) {
          this.phase = 'GAME_OVER';
          soundEngine.playGameOver();
        } else {
          this.ballWaiting = true;
          soundEngine.playLifeLost();
        }
      }

      // Level cleared
      if (this.bricks.length === 0 && this.phase === 'PLAYING') {
        this.level += 1;
        this.score += 10 * this.level;
        this.updateHighScore();
        this.buildLevel(this.level);
        this.powerUps = [];
        this.ballWaiting = true;
        this.balls = [];
        this.popups.push({
          text: `LEVEL ${this.level}`,
          x: GAME_WIDTH / 2,
          y: GAME_HEIGHT / 2 - 10,
          color: '#3cebff',
          glowColor: 'rgba(60, 235, 255, 0.75)',
          life: 70,
          maxLife: 70,
          size: 40,
        });
        soundEngine.playLevelClear();
      }
    }

    // Update power-ups
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.y += p.vy * dt;

      const pLeft = p.x - p.w / 2;
      const pRight = p.x + p.w / 2;
      const pTop = p.y - p.h / 2;
      const pBottom = p.y + p.h / 2;

      const collidesPaddle =
        pRight >= this.paddleX &&
        pLeft <= this.paddleX + this.paddleW &&
        pBottom >= this.paddleY &&
        pTop <= this.paddleY + this.paddleH;

      if (collidesPaddle) {
        this.applyPowerUp(p.kind);
        this.powerUps.splice(i, 1);
      } else if (pTop > GAME_HEIGHT) {
        this.powerUps.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 0.08 * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating text popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 0.75 * dt;
      pop.life -= dt;
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  private handleBrickDestroyed(index: number) {
    const brick = this.bricks[index];
    this.bricks.splice(index, 1);

    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.comboTimer = 140;

    const pointsEarned = 1 + Math.floor(this.combo / 3);
    this.score += pointsEarned;
    this.updateHighScore();

    this.screenShake = Math.min(4.5, 1.5 + this.combo * 0.2);
    soundEngine.playBrickBreak(this.combo);

    if (this.combo >= 3 && this.combo % 2 === 1) {
      this.popups.push({
        text: `${this.combo} COMBO!`,
        x: GAME_WIDTH / 2,
        y: 192,
        color: '#ffd746',
        glowColor: 'rgba(255, 215, 70, 0.75)',
        life: 58,
        maxLife: 58,
        size: 38,
      });
    }

    // Spawn burst particles matching brick neon color
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    this.spawnParticles(cx, cy, brick.color, 16);

    // 25% drop rate, prioritizing MULTIBALL (72%)
    if (Math.random() < 0.25) {
      const kind: PowerUpKind = Math.random() < 0.72 ? 'MULTIBALL' : 'WIDE';
      this.powerUps.push({
        x: cx,
        y: cy,
        w: 76,
        h: 22,
        vy: 3.2,
        kind,
      });
    }
  }

  private applyPowerUp(kind: PowerUpKind) {
    soundEngine.playPowerUp(kind);
    this.paddleFlash = 1.0;

    if (kind === 'MULTIBALL') {
      this.popups.push({
        text: 'MULTIBALL',
        x: GAME_WIDTH / 2,
        y: 158,
        color: '#ffffff',
        glowColor: 'rgba(255, 45, 195, 0.85)',
        life: 62,
        maxLife: 62,
        size: 38,
      });

      const ref =
        this.balls[0] ??
        ({
          x: this.paddleX + this.paddleW / 2,
          y: this.paddleY - 12,
          vx: 3.1,
          vy: -6.0,
          radius: 8,
          trail: [],
        } as Ball);

      if (this.balls.length === 0) {
        this.balls.push(ref);
        this.ballWaiting = false;
      }

      const offsets = [-0.45, 0.45];
      for (const offset of offsets) {
        if (this.balls.length >= 8) break;
        const speed = Math.hypot(ref.vx, ref.vy);
        const angle = Math.atan2(ref.vy, ref.vx) + offset;
        this.balls.push({
          x: ref.x,
          y: ref.y,
          vx: speed * Math.cos(angle),
          vy: speed * Math.sin(angle),
          radius: 8,
          trail: [],
        });
      }
    } else {
      this.popups.push({
        text: 'WIDE PADDLE!',
        x: GAME_WIDTH / 2,
        y: 158,
        color: '#3cebff',
        glowColor: 'rgba(60, 235, 255, 0.85)',
        life: 62,
        maxLife: 62,
        size: 34,
      });
      const cx = this.paddleX + this.paddleW / 2;
      this.paddleW = PADDLE_WIDE_W;
      this.paddleX = cx - this.paddleW / 2;
      this.clampPaddle();
      this.wideTimer = 450; // ~7.5s
    }
  }

  private spawnParticles(x: number, y: number, color: RGB, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 4.2;
      const life = 18 + Math.floor(Math.random() * 16);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color,
        size: 2 + Math.floor(Math.random() * 2.5),
      });
    }
  }

  private updateHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.highScore);
    }
  }

  public getSnapshot(): HudSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      combo: this.combo,
      maxCombo: this.maxCombo,
      lives: this.lives,
      level: this.level,
      ballWaiting: this.ballWaiting,
      wideRemainingSec: Math.ceil(this.wideTimer / 60),
      activeBalls: this.balls.length,
      bricksRemaining: this.bricks.length,
    };
  }
}
