import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { BrickBreakerEngine } from '../game/engine';
import { GameRenderer } from '../game/renderer';
import { soundEngine } from '../game/sound';
import { GAME_HEIGHT, GAME_WIDTH, HudSnapshot, SpeedMode } from '../game/types';

export const BrickBreakerGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BrickBreakerEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);

  if (!engineRef.current) {
    engineRef.current = new BrickBreakerEngine();
  }

  const [hud, setHud] = useState<HudSnapshot>(() => engineRef.current!.getSnapshot());
  const [speedMode, setSpeedMode] = useState<SpeedMode>('normal');
  const [muted, setMuted] = useState<boolean>(false);

  const syncHud = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = engine.getSnapshot();
    setHud((prev) => {
      if (
        prev.phase === next.phase &&
        prev.score === next.score &&
        prev.highScore === next.highScore &&
        prev.combo === next.combo &&
        prev.maxCombo === next.maxCombo &&
        prev.lives === next.lives &&
        prev.level === next.level &&
        prev.ballWaiting === next.ballWaiting &&
        prev.wideRemainingSec === next.wideRemainingSec &&
        prev.activeBalls === next.activeBalls &&
        prev.bricksRemaining === next.bricksRemaining
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const handleStartOrLaunch = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.phase === 'TITLE_MENU') {
      engine.startNewGame();
      engine.launchBall();
    } else if (engine.phase === 'GAME_OVER') {
      engine.startNewGame();
    } else if (engine.phase === 'PLAYING' && engine.ballWaiting) {
      engine.launchBall();
    }
    syncHud();
  }, [syncHud]);

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.startNewGame();
    syncHud();
  }, [syncHud]);

  const handleTogglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.togglePause();
    syncHud();
  }, [syncHud]);

  const handleSpeedChange = useCallback((mode: SpeedMode) => {
    setSpeedMode(mode);
    engineRef.current?.setSpeedMode(mode);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // High-DPI canvas setup and 60fps-normalized animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    if (!rendererRef.current) {
      rendererRef.current = new GameRenderer();
    }
    const renderer = rendererRef.current;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const dtMs = now - lastTime;
      lastTime = now;

      engine.update(dtMs);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.render(ctx, engine, now);
      ctx.restore();

      syncHud();
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [syncHud]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        engine.setKeyboardDirection('left', true);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        engine.setKeyboardDirection('right', true);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (engine.phase === 'PAUSED') {
          engine.togglePause();
          syncHud();
        } else {
          handleStartOrLaunch();
        }
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (engine.phase === 'PLAYING' || engine.phase === 'PAUSED') {
          engine.togglePause();
          syncHud();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        engine.setKeyboardDirection('left', false);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        engine.setKeyboardDirection('right', false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleStartOrLaunch, syncHud]);

  const mapPointerToGameX = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return GAME_WIDTH / 2;
    const rect = canvas.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    return relX * GAME_WIDTH;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.movePaddleTo(mapPointerToGameX(e.clientX));
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.movePaddleTo(mapPointerToGameX(e.clientX));
    if (engine.phase === 'PLAYING' && engine.ballWaiting) {
      engine.launchBall();
      syncHud();
    }
  };

  return (
    <div className="min-h-dvh w-full bg-[#050814] text-slate-100 flex flex-col items-center justify-center px-3 py-3 sm:py-4 select-none">
      {/* Compact Arcade Utility Bar */}
      <header
        className="w-full flex items-center justify-between gap-4 pb-2.5 px-1"
        style={{ maxWidth: 'min(94vw, calc((100dvh - 84px) * 560 / 760), 560px)' }}
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 font-hud whitespace-nowrap">
          <span>LVL {hud.level}</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>BEST {hud.highScore}</span>
          {hud.wideRemainingSec > 0 && (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-cyan-300">WIDE {hud.wideRemainingSec}s</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Speed selector */}
          <div
            className="flex items-center bg-[#0c1428] border border-slate-800 rounded-md p-0.5"
            role="group"
            aria-label="Tốc độ bóng"
          >
            <button
              type="button"
              onClick={() => handleSpeedChange('normal')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                speedMode === 'normal'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => handleSpeedChange('turbo')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                speedMode === 'turbo'
                  ? 'bg-pink-500/20 text-pink-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Turbo
            </button>
          </div>

          {/* Pause / Resume */}
          {(hud.phase === 'PLAYING' || hud.phase === 'PAUSED') && (
            <button
              type="button"
              onClick={handleTogglePause}
              aria-label={hud.phase === 'PAUSED' ? 'Tiếp tục' : 'Tạm dừng'}
              title={hud.phase === 'PAUSED' ? 'Tiếp tục (P)' : 'Tạm dừng (P)'}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-[#0c1428] border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer"
            >
              {hud.phase === 'PAUSED' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          )}

          {/* Restart */}
          <button
            type="button"
            onClick={handleRestart}
            aria-label="Chơi lại"
            title="Chơi lại"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-[#0c1428] border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-[#0c1428] border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Arcade Playfield Frame */}
      <main className="relative flex items-center justify-center">
        <div
          className="relative rounded-xl overflow-hidden border border-cyan-500/30 shadow-[0_0_45px_rgba(0,175,255,0.16)] bg-[#070b18]"
          style={{
            width: 'min(94vw, calc((100dvh - 84px) * 560 / 760), 560px)',
            aspectRatio: `${GAME_WIDTH} / ${GAME_HEIGHT}`,
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            onClick={handleCanvasClick}
            className="w-full h-full block touch-none cursor-crosshair"
          />

          {/* Waiting to Launch Hint */}
          {hud.phase === 'PLAYING' && hud.ballWaiting && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[22%] flex justify-center px-4">
              <p className="text-center text-xs sm:text-sm font-medium tracking-wide text-cyan-200/90 bg-[#070b18]/75 px-3.5 py-1.5 rounded-md border border-cyan-500/25">
                Nhấn <span className="font-hud text-white">SPACE</span> hoặc click để phóng bóng
              </p>
            </div>
          )}

          {/* Title Menu Overlay */}
          {hud.phase === 'TITLE_MENU' && (
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-16 px-6 bg-gradient-to-t from-[#050814]/95 via-[#050814]/55 to-transparent">
              <div className="w-full max-w-xs text-center space-y-4">
                <div className="space-y-1.5">
                  <p className="text-sm text-slate-300">
                    Di chuyển chuột, chạm hoặc phím <span className="font-hud text-cyan-300">← → / A D</span> để đỡ bóng.
                  </p>
                  <p className="text-xs text-slate-400">
                    Ăn vật phẩm <span className="text-pink-400 font-semibold">MULTI</span> để nhân bóng &amp; <span className="text-cyan-300 font-semibold">WIDE</span> để mở rộng thanh đỡ.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleStartOrLaunch}
                  className="w-full py-3 px-6 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#050814] font-bold text-base tracking-wide transition-colors shadow-[0_0_24px_rgba(60,235,255,0.45)] cursor-pointer"
                >
                  Start Game
                </button>
              </div>
            </div>
          )}

          {/* Paused Overlay */}
          {hud.phase === 'PAUSED' && (
            <div className="absolute inset-0 bg-[#050814]/80 backdrop-blur-[2px] flex flex-col items-center justify-center px-6">
              <div className="w-full max-w-xs bg-[#0b1224] border border-cyan-500/30 rounded-xl p-6 text-center space-y-5">
                <h2 className="font-arcade italic text-3xl font-extrabold tracking-wide text-cyan-300">
                  PAUSED
                </h2>
                <div className="flex items-center justify-center gap-4 text-sm font-hud text-slate-300">
                  <span>SCORE {hud.score}</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span>LEVEL {hud.level}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#050814] font-bold text-sm transition-colors cursor-pointer"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Restart
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {hud.phase === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-[#050814]/82 backdrop-blur-[2px] flex flex-col items-center justify-center px-6">
              <div className="w-full max-w-xs bg-[#0b1224] border border-pink-500/40 rounded-xl p-6 text-center space-y-5 shadow-[0_0_32px_rgba(255,45,195,0.2)]">
                <div className="space-y-1">
                  <h2 className="font-arcade italic text-4xl font-extrabold tracking-wide text-pink-400">
                    GAME OVER
                  </h2>
                  <p className="text-xs text-slate-400">
                    Đạt màn {hud.level} · Combo tối đa {hud.maxCombo}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400">Score</div>
                    <div className="font-hud text-2xl font-bold text-white">{hud.score}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Best</div>
                    <div className="font-hud text-2xl font-bold text-cyan-300">{hud.highScore}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRestart}
                  className="w-full py-3 px-5 rounded-lg bg-pink-500 hover:bg-pink-400 text-white font-bold text-sm tracking-wide transition-colors shadow-[0_0_20px_rgba(255,45,195,0.4)] cursor-pointer whitespace-nowrap"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
