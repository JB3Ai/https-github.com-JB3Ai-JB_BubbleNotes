// Web Audio API Sound Effects Synthesizer for tactile feedback

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Load preference from localStorage if available
    try {
      const saved = localStorage.getItem('bubblenote_sound');
      if (saved !== null) {
        this.soundEnabled = saved === 'true';
      }
    } catch {
      this.soundEnabled = true;
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    try {
      localStorage.setItem('bubblenote_sound', String(this.soundEnabled));
    } catch {
      // ignore
    }
    if (this.soundEnabled) {
      this.playPop(1.2);
    }
    return this.soundEnabled;
  }

  // Soft tactile bubble pop / tap
  public playPop(pitchMultiplier: number = 1.0) {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 380 * pitchMultiplier;
    osc.frequency.setValueAtTime(baseFreq * 0.7, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, t + 0.12);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Bubble squish / squeeze wobble
  public playSquish() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.08);
    osc.frequency.linearRampToValueAtTime(320, t + 0.16);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Gentle water bounce / collision
  public playBounce(intensity: number = 0.5) {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.09);

    const vol = Math.min(0.15, 0.04 + intensity * 0.1);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.11);
  }

  // Drop into Today Goal Zone (warm submerged chime)
  public playTodayDock() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const freqs = [440, 554.37, 659.25]; // A major chord

    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(f * 1.05, t + idx * 0.04 + 0.25);

      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0.12, t + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.04);
      osc.stop(t + idx * 0.04 + 0.5);
    });
  }

  // Satisfying Task Completion Splash Burst Pop
  public playCompletionBurst() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Crisp high pop
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(520, t);
    popOsc.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
    popOsc.frequency.exponentialRampToValueAtTime(700, t + 0.15);

    popGain.gain.setValueAtTime(0.28, t);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    popOsc.connect(popGain);
    popGain.connect(this.ctx.destination);
    popOsc.start(t);
    popOsc.stop(t + 0.22);

    // 2. Rising magical chime
    const notes = [587.33, 739.99, 880, 1174.66]; // D, F#, A, D
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.05);

      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0.14, t + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.45);
    });
  }

  // Satisfying Bubble Merge / Coalescence
  public playMerge() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Watery suction sweep
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(160, t);
    osc1.frequency.exponentialRampToValueAtTime(110, t + 0.06);
    osc1.frequency.exponentialRampToValueAtTime(460, t + 0.16);

    gain1.gain.setValueAtTime(0.24, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.24);

    // 2. Harmonic chord chime of expansion & fusion
    const freqs = [329.63, 440, 554.37, 659.25]; // E, A, C#, E
    freqs.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + 0.05 + i * 0.03);
      osc.frequency.linearRampToValueAtTime(freq * 1.02, t + 0.25);

      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0.12, t + 0.05 + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + i * 0.03 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + 0.05 + i * 0.03);
      osc.stop(t + 0.05 + i * 0.03 + 0.4);
    });
  }

  // Create new bubble emergence
  public playBirth() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.18);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  }
}

export const soundFx = new SoundEffectsManager();
