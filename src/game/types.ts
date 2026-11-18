export const GAME_WIDTH = 560;
export const GAME_HEIGHT = 760;
export const BORDER_W = 14;
export const HUD_H = 95;

export const PADDLE_DEFAULT_W = 128;
export const PADDLE_WIDE_W = 180;
export const PADDLE_H = 20;
export const PADDLE_Y = GAME_HEIGHT - 58;

export const BRICK_W = 78;
export const BRICK_H = 34;
export const BRICK_GAP = 8;

export type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
export type SpeedMode = 'normal' | 'turbo';
export type PowerUpKind = 'MULTIBALL' | 'WIDE';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const BRICK_PALETTE: readonly RGB[] = [
  { r: 35, g: 130, b: 255 },  // Electric Blue
  { r: 240, g: 45, b: 95 },   // Crimson Pink
  { r: 245, g: 180, b: 35 },  // Amber Gold
  { r: 25, g: 220, b: 160 },  // Emerald Cyan
] as const;

export interface Brick {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  colorIndex: number;
  color: RGB;
  hitFlash: number;
}

export interface TrailPoint {
  x: number;
  y: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  trail: TrailPoint[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: RGB;
  size: number;
}

export interface PowerUp {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  kind: PowerUpKind;
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  color: string;
  glowColor: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  lives: number;
  level: number;
  ballWaiting: boolean;
  wideRemainingSec: number;
  activeBalls: number;
  bricksRemaining: number;
}
