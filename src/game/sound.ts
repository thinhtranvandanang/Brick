class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock() {
    this.ensureContext();
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playLaunch() {
    this.playTone(260, 620, 0.14, 'triangle', 0.12);
  }

  public playWallHit() {
    this.playTone(220, 170, 0.055, 'sine', 0.07);
  }

  public playPaddleHit() {
    this.playTone(320, 480, 0.08, 'triangle', 0.11);
  }

  public playBrickBreak(combo: number) {
    const step = Math.min(combo, 12);
    const baseFreq = 400 + step * 42;
    this.playTone(baseFreq, baseFreq * 1.25, 0.09, 'square', 0.065);
    this.playTone(baseFreq * 1.5, baseFreq * 1.8, 0.08, 'sine', 0.05, 0.015);
  }

  public playPowerUp(kind: 'MULTIBALL' | 'WIDE') {
    if (kind === 'MULTIBALL') {
      this.playTone(523.25, 659.25, 0.09, 'triangle', 0.11, 0);
      this.playTone(659.25, 783.99, 0.09, 'triangle', 0.11, 0.06);
      this.playTone(783.99, 1046.5, 0.16, 'triangle', 0.12, 0.12);
    } else {
      this.playTone(392.0, 587.33, 0.11, 'sine', 0.11, 0);
      this.playTone(587.33, 783.99, 0.14, 'sine', 0.11, 0.07);
    }
  }

  public playLifeLost() {
    this.playTone(310, 110, 0.28, 'sawtooth', 0.09);
  }

  public playLevelClear() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n, 0.13, 'triangle', 0.1, idx * 0.07);
    });
  }

  public playGameOver() {
    this.playTone(340, 220, 0.18, 'sawtooth', 0.08, 0);
    this.playTone(220, 130, 0.28, 'sawtooth', 0.08, 0.16);
  }
}

export const soundEngine = new SoundEngine();
