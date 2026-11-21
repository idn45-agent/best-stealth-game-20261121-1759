// Synthesised sound: every effect is an oscillator or filtered noise, no audio files.
export function createAudio() {
  let context = null;
  let master = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || context.state === 'suspended') return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
    gain.gain.setValueAtTime(vol, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + dur + 0.02);
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!ensure() || context.state === 'suspended') return;
    const len = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    unlock() { ensure(); if (context && context.state === 'suspended') context.resume().catch(() => {}); },
    step(loud) { if (loud) noiseBurst(0.09, 0.5, 700); else noiseBurst(0.05, 0.22, 500); },
    guardStep() { noiseBurst(0.07, 0.14, 260); },
    coin() { tone(880, 0.12, 'sine', 0.5); tone(1320, 0.18, 'sine', 0.4); },
    relic() { tone(523, 0.16, 'triangle', 0.5); tone(659, 0.16, 'triangle', 0.5); tone(784, 0.3, 'triangle', 0.5); },
    alarm() { tone(220, 0.22, 'square', 0.4, 330); tone(330, 0.22, 'square', 0.4, 220); },
    caught() { tone(196, 0.4, 'sawtooth', 0.5, 98); },
    pebble() { noiseBurst(0.12, 0.4, 2400); },
    land() { noiseBurst(0.08, 0.5, 900); },
    exit() { tone(392, 0.14, 'triangle', 0.5); tone(523, 0.14, 'triangle', 0.5); tone(659, 0.3, 'triangle', 0.5); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.5), i * 130)); },
  };
}
