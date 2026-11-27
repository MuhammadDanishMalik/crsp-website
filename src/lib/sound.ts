/**
 * Notification beeps. ONE AudioContext for the whole tab: a new one per beep (never closed) piles up
 * audio threads and memory until the browser hangs. See docs/PERFORMANCE.md.
 */
let ctx: AudioContext | null = null;

export function playTones(freqs: number[], { gap = 0.22, volume = 0.3 } = {}) {
  try {
    ctx ??= new AudioContext();
    const c = ctx;
    if (c.state === "suspended") void c.resume();
    freqs.forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      const at = c.currentTime + i * gap;
      o.frequency.value = f; o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(volume, at); g.gain.exponentialRampToValueAtTime(0.001, at + gap - 0.02);
      o.onended = () => { o.disconnect(); g.disconnect(); };
      o.start(at); o.stop(at + gap - 0.01);
    });
  } catch { /* audio is blocked until the first tap */ }
}
