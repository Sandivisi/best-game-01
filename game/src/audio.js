// All sound is synthesized with WebAudio — no audio files, nothing to download.
// A tiny sequencer plays a slow lantern-lit arpeggio under the game; every action
// gets a short blip, thud or chime built from oscillators and filtered noise.
const NOTE_FREQ = [220.0, 261.63, 329.63, 392.0, 440.0, 523.25, 659.25];

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.11;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!context || muted) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, freq) {
    if (!context || muted) return;
    const t0 = context.currentTime;
    const len = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  function startMusic() {
    if (!ensure() || musicTimer !== null) return;
    // A wandering minor arpeggio, one soft pluck every 0.42 s.
    musicTimer = window.setInterval(() => {
      if (muted || !context) return;
      step += 1;
      const pattern = [0, 2, 4, 3, 5, 4, 2, 1];
      const note = NOTE_FREQ[pattern[step % pattern.length]];
      const t0 = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = note / 2;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.5, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + 1);
    }, 420);
  }

  return {
    unlock() { ensure(); startMusic(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() { return muted; },
    shoot() { tone(720, 0.09, 'square', 0.08, 0, 340); },
    hit() { noise(0.06, 0.12, 1800); },
    enemyDie() { tone(330, 0.16, 'triangle', 0.16, 0, 70); noise(0.12, 0.1, 900); },
    playerHurt() { tone(140, 0.3, 'sawtooth', 0.22, 0, 55); noise(0.2, 0.16, 500); },
    pickup() { tone(880, 0.08, 'sine', 0.14, 0, 1320); },
    heal() { tone(523, 0.12, 'sine', 0.16); tone(784, 0.18, 'sine', 0.14, 0.09); },
    dash() { noise(0.14, 0.12, 2400); },
    nova() { tone(180, 0.5, 'sawtooth', 0.2, 0, 900); noise(0.4, 0.18, 1200); },
    waveStart() { tone(392, 0.14, 'triangle', 0.18); tone(523, 0.2, 'triangle', 0.18, 0.12); },
    waveClear() { tone(523, 0.14, 'triangle', 0.18); tone(659, 0.14, 'triangle', 0.18, 0.12); tone(784, 0.28, 'triangle', 0.2, 0.24); },
    upgrade() { tone(659, 0.12, 'sine', 0.16); tone(988, 0.22, 'sine', 0.16, 0.08); },
    boss() { tone(98, 0.6, 'sawtooth', 0.22, 0, 49); tone(147, 0.6, 'sawtooth', 0.16, 0.1, 73); },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, i * 0.14));
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.34, 'triangle', 0.16, i * 0.16));
    },
  };
}
