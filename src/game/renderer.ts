import {
  BORDER_W,
  BRICK_H,
  BRICK_PALETTE,
  BRICK_W,
  GAME_HEIGHT,
  GAME_WIDTH,
  HUD_H,
  RGB,
} from './types';
import { BrickBreakerEngine } from './engine';

const BRICK_PAD = 14;
const SPRITE_SCALE = 2;

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function createBrickSprite(color: RGB): HTMLCanvasElement {
  const logicalW = BRICK_W + BRICK_PAD * 2;
  const logicalH = BRICK_H + BRICK_PAD * 2;

  const canvas = document.createElement('canvas');
  canvas.width = logicalW * SPRITE_SCALE;
  canvas.height = logicalH * SPRITE_SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE);

  const { r, g, b } = color;
  const pad = BRICK_PAD;
  const w = BRICK_W;
  const h = BRICK_H;

  // Outer ambient neon glow
  ctx.save();
  ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
  ctx.shadowBlur = 14;
  roundRectPath(ctx, pad, pad, w, h, 8);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.45)`;
  ctx.fill();
  ctx.restore();

  // Main glossy body gradient
  const grad = ctx.createLinearGradient(pad, pad, pad, pad + h);
  grad.addColorStop(0, `rgba(${Math.min(255, r + 35)}, ${Math.min(255, g + 35)}, ${Math.min(255, b + 35)}, 0.96)`);
  grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.92)`);
  grad.addColorStop(1, `rgba(${Math.max(0, r - 45)}, ${Math.max(0, g - 45)}, ${Math.max(0, b - 45)}, 0.96)`);

  roundRectPath(ctx, pad, pad, w, h, 8);
  ctx.fillStyle = grad;
  ctx.fill();

  // Upper glass specular highlight
  const glassGrad = ctx.createLinearGradient(pad, pad + 2, pad, pad + h * 0.5);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
  roundRectPath(ctx, pad + 4, pad + 3, w - 8, h * 0.44, 5);
  ctx.fillStyle = glassGrad;
  ctx.fill();

  // Crisp bright neon rim border
  const br = Math.min(255, r + 95);
  const bg = Math.min(255, g + 95);
  const bb = Math.min(255, b + 95);
  roundRectPath(ctx, pad + 0.75, pad + 0.75, w - 1.5, h - 1.5, 8);
  ctx.strokeStyle = `rgba(${br}, ${bg}, ${bb}, 0.95)`;
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas;
}

export class GameRenderer {
  private brickSprites: HTMLCanvasElement[];

  constructor() {
    this.brickSprites = BRICK_PALETTE.map((c) => createBrickSprite(c));
  }

  public render(ctx: CanvasRenderingContext2D, engine: BrickBreakerEngine, nowMs: number) {
    ctx.save();

    // Subtle micro-shake on high-combo impacts
    if (engine.screenShake > 0.1) {
      const sx = (Math.random() - 0.5) * engine.screenShake;
      const sy = (Math.random() - 0.5) * engine.screenShake;
      ctx.translate(sx, sy);
    }

    this.drawBackgroundAndRails(ctx, engine, nowMs);
    this.drawBricks(ctx, engine);
    this.drawPowerUps(ctx, engine);
    this.drawPaddle(ctx, engine);
    this.drawBallsAndTrails(ctx, engine, nowMs);
    this.drawParticles(ctx, engine);
    this.drawPopups(ctx, engine);
    this.drawHud(ctx, engine);

    ctx.restore();
  }

  private drawBackgroundAndRails(
    ctx: CanvasRenderingContext2D,
    engine: BrickBreakerEngine,
    nowMs: number
  ) {
    // Deep midnight arena fill
    const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    bgGrad.addColorStop(0, '#060a17');
    bgGrad.addColorStop(0.55, '#070b18');
    bgGrad.addColorStop(1, '#040812');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle radial arena glow behind bricks & paddle
    const topGlow = ctx.createRadialGradient(
      GAME_WIDTH / 2,
      HUD_H + 120,
      20,
      GAME_WIDTH / 2,
      HUD_H + 120,
      290
    );
    topGlow.addColorStop(0, 'rgba(0, 145, 255, 0.08)');
    topGlow.addColorStop(1, 'rgba(0, 145, 255, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(BORDER_W, HUD_H, GAME_WIDTH - BORDER_W * 2, GAME_HEIGHT - HUD_H);

    // Faint horizontal grid lines
    ctx.strokeStyle = 'rgba(20, 34, 68, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = HUD_H + 40; y < GAME_HEIGHT; y += 40) {
      ctx.moveTo(BORDER_W, y + 0.5);
      ctx.lineTo(GAME_WIDTH - BORDER_W, y + 0.5);
    }
    ctx.stroke();

    // Architectural angled cyber-lines at lower corners (matching screenshot framing)
    ctx.strokeStyle = 'rgba(24, 52, 98, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Left angled bevel
    ctx.moveTo(BORDER_W, GAME_HEIGHT - 220);
    ctx.lineTo(BORDER_W + 26, GAME_HEIGHT - 190);
    ctx.lineTo(BORDER_W + 26, GAME_HEIGHT - 85);
    ctx.lineTo(BORDER_W, GAME_HEIGHT - 55);
    // Right angled bevel
    ctx.moveTo(GAME_WIDTH - BORDER_W, GAME_HEIGHT - 220);
    ctx.lineTo(GAME_WIDTH - BORDER_W - 26, GAME_HEIGHT - 190);
    ctx.lineTo(GAME_WIDTH - BORDER_W - 26, GAME_HEIGHT - 85);
    ctx.lineTo(GAME_WIDTH - BORDER_W, GAME_HEIGHT - 55);
    ctx.stroke();

    // Side rails base
    const railAlpha = 0.25 + engine.railPulse * 0.25;
    ctx.fillStyle = 'rgba(10, 32, 72, 0.92)';
    ctx.fillRect(0, HUD_H, BORDER_W, GAME_HEIGHT - HUD_H);
    ctx.fillRect(GAME_WIDTH - BORDER_W, HUD_H, BORDER_W, GAME_HEIGHT - HUD_H);

    // Side rails ambient glow bleed
    const leftGlow = ctx.createLinearGradient(0, 0, BORDER_W + 24, 0);
    leftGlow.addColorStop(0, `rgba(0, 175, 255, ${railAlpha})`);
    leftGlow.addColorStop(1, 'rgba(0, 175, 255, 0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, HUD_H, BORDER_W + 24, GAME_HEIGHT - HUD_H);

    const rightGlow = ctx.createLinearGradient(GAME_WIDTH, 0, GAME_WIDTH - BORDER_W - 24, 0);
    rightGlow.addColorStop(0, `rgba(0, 175, 255, ${railAlpha})`);
    rightGlow.addColorStop(1, 'rgba(0, 175, 255, 0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(GAME_WIDTH - BORDER_W - 24, HUD_H, BORDER_W + 24, GAME_HEIGHT - HUD_H);

    // Segmented neon light bars inside both rails (just like the Pygame screenshot)
    const segH = 44;
    const segGap = 18;
    const pulseWave = (nowMs * 0.002) % (Math.PI * 2);
    for (let y = HUD_H + 18, idx = 0; y < GAME_HEIGHT - 30; y += segH + segGap, idx++) {
      const shimmer = 0.65 + 0.35 * Math.sin(pulseWave + idx * 0.6);
      const bright = Math.min(1, shimmer + engine.railPulse * 0.4);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 210, 255, 0.9)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = `rgba(60, 225, 255, ${0.72 * bright})`;
      roundRectPath(ctx, 4, y, 5, segH, 2.5);
      ctx.fill();
      roundRectPath(ctx, GAME_WIDTH - 9, y, 5, segH, 2.5);
      ctx.fill();
      ctx.restore();
    }

    // Crisp inner cyan rail lines
    ctx.strokeStyle = '#3cebff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(BORDER_W, HUD_H);
    ctx.lineTo(BORDER_W, GAME_HEIGHT);
    ctx.moveTo(GAME_WIDTH - BORDER_W, HUD_H);
    ctx.lineTo(GAME_WIDTH - BORDER_W, GAME_HEIGHT);
    ctx.stroke();

    // HUD separator line
    ctx.strokeStyle = 'rgba(40, 105, 185, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HUD_H);
    ctx.lineTo(GAME_WIDTH, HUD_H);
    ctx.stroke();
  }

  private drawBricks(ctx: CanvasRenderingContext2D, engine: BrickBreakerEngine) {
    for (const brick of engine.bricks) {
      const sprite = this.brickSprites[brick.colorIndex];
      ctx.drawImage(
        sprite,
        brick.x - BRICK_PAD,
        brick.y - BRICK_PAD,
        BRICK_W + BRICK_PAD * 2,
        BRICK_H + BRICK_PAD * 2
      );
    }
  }

  private drawPowerUps(ctx: CanvasRenderingContext2D, engine: BrickBreakerEngine) {
    for (const p of engine.powerUps) {
      const isMulti = p.kind === 'MULTIBALL';
      const borderColor = isMulti ? '#ff2dc3' : '#3cebff';
      const glowColor = isMulti ? 'rgba(255, 45, 195, 0.65)' : 'rgba(60, 235, 255, 0.65)';
      const x = p.x - p.w / 2;
      const y = p.y - p.h / 2;

      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12;
      roundRectPath(ctx, x, y, p.w, p.h, 11);
      ctx.fillStyle = '#0e182e';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = borderColor;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isMulti ? 'MULTI' : 'WIDE', p.x, p.y + 0.5);
    }
  }

  private drawPaddle(ctx: CanvasRenderingContext2D, engine: BrickBreakerEngine) {
    const x = engine.paddleX;
    const y = engine.paddleY;
    const w = engine.paddleW;
    const h = engine.paddleH;

    // Wide cyan underglow
    ctx.save();
    ctx.shadowColor = engine.wideTimer > 0 ? 'rgba(25, 220, 160, 0.85)' : 'rgba(0, 195, 255, 0.85)';
    ctx.shadowBlur = 18 + engine.paddleFlash * 10;
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = 'rgba(0, 175, 255, 0.35)';
    ctx.fill();
    ctx.restore();

    // Outer metallic cyan shell
    const shellGrad = ctx.createLinearGradient(x, y, x, y + h);
    shellGrad.addColorStop(0, '#4be7ff');
    shellGrad.addColorStop(0.5, '#1c8fe6');
    shellGrad.addColorStop(1, '#0d4e96');
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = shellGrad;
    ctx.fill();

    // Bright white inner core bar
    roundRectPath(ctx, x + 5, y + 4, w - 10, h - 8, 6);
    ctx.fillStyle = engine.paddleFlash > 0.2 ? '#ffffff' : '#eef9ff';
    ctx.fill();

    // Crisp outer rim
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.strokeStyle = '#7cf0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawBallsAndTrails(
    ctx: CanvasRenderingContext2D,
    engine: BrickBreakerEngine,
    nowMs: number
  ) {
    // Waiting ball resting on the paddle
    if (engine.ballWaiting && engine.phase !== 'GAME_OVER') {
      const bx = engine.paddleX + engine.paddleW / 2;
      const by = engine.paddleY - 10;
      const pulse = 1 + 0.12 * Math.sin(nowMs * 0.008);
      this.drawSingleBall(ctx, bx, by, 8, pulse);
      return;
    }

    for (const ball of engine.balls) {
      // Laser pink trail with additive glow
      const n = ball.trail.length;
      if (n > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < n; i++) {
          const ratio = i / n;
          const p1 = ball.trail[i - 1];
          const p2 = ball.trail[i];
          const alpha = 0.72 * Math.pow(ratio, 1.65);
          const width = Math.max(2, ball.radius * 1.85 * ratio);

          ctx.strokeStyle = `rgba(255, 45, 195, ${alpha})`;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }

        const last = ball.trail[n - 1];
        ctx.strokeStyle = 'rgba(255, 115, 225, 0.85)';
        ctx.lineWidth = ball.radius * 1.55;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(ball.x, ball.y);
        ctx.stroke();
        ctx.restore();
      }

      this.drawSingleBall(ctx, ball.x, ball.y, ball.radius, 1);
    }
  }

  private drawSingleBall(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    glowScale: number
  ) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(x, y, radius * 0.2, x, y, (radius + 13) * glowScale);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    halo.addColorStop(0.35, 'rgba(255, 85, 210, 0.85)');
    halo.addColorStop(0.7, 'rgba(255, 45, 195, 0.35)');
    halo.addColorStop(1, 'rgba(255, 45, 195, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, (radius + 13) * glowScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // White core + neon rim
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 175, 238, 0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, engine: BrickBreakerEngine) {
    if (engine.particles.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of engine.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      const { r, g, b } = pt.color;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPopups(ctx: CanvasRenderingContext2D, engine: BrickBreakerEngine) {
    for (const pop of engine.popups) {
      const alpha = Math.min(1, pop.life / (pop.maxLife * 0.45));
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `italic 800 ${pop.size}px "Barlow Condensed", "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Dark contrast drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillText(pop.text, pop.x + 2, pop.y + 3);

      // Glow + crisp foreground text
      ctx.shadowColor = pop.glowColor;
      ctx.shadowBlur = 16;
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D, engine: BrickBreakerEngine) {
    // Left Title Block: PYTHON BRICK BREAKER
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    ctx.font = 'italic 800 28px "Barlow Condensed", "Outfit", sans-serif';
    const pythonText = 'PYTHON ';
    const pythonW = ctx.measureText(pythonText).width;

    ctx.fillStyle = '#ffffff';
    ctx.fillText(pythonText, 22, 16);

    ctx.shadowColor = 'rgba(60, 235, 255, 0.65)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#3cebff';
    ctx.fillText('BRICK BREAKER', 22 + pythonW, 16);
    ctx.shadowBlur = 0;

    ctx.font = '600 11.5px "Outfit", sans-serif';
    ctx.fillStyle = '#b4d2eb';
    ctx.fillText('BREAK   /   CATCH   /   MULTIBALL', 24, 52);

    // Right Score / Combo / Lives Block
    ctx.textAlign = 'right';
    ctx.font = '700 18px "JetBrains Mono", monospace';

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`SCORE: ${engine.score}`, GAME_WIDTH - 22, 16);

    ctx.fillStyle = engine.combo > 0 ? '#3cebff' : '#ffffff';
    ctx.fillText(`COMBO: ${engine.combo}`, GAME_WIDTH - 22, 40);

    // Lives row
    ctx.font = '700 13px "JetBrains Mono", monospace';
    const hearts = engine.lives > 0 ? '♥ '.repeat(engine.lives).trim() : '—';
    const livesLabel = `LIVES: ${hearts}`;
    ctx.fillStyle = '#ff2dc3';
    ctx.fillText(livesLabel, GAME_WIDTH - 22, 68);

    ctx.restore();
  }
}
