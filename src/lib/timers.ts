import { timersStore } from './store';

let audio: AudioContext | null = null;

export function startTimer(label: string, minutes: number) {
  unlockAudio();
  const totalMs = Math.round(minutes * 60_000);
  timersStore.set((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, endsAt: Date.now() + totalMs, totalMs, done: false }]);
}

export function cancelTimer(id: string) {
  timersStore.set((prev) => prev.filter((t) => t.id !== id));
}

export function markDone(id: string) {
  timersStore.set((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
  chime();
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    /* not supported */
  }
}

/** Browsers only allow sound after a user gesture, so warm up audio when a timer starts. */
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

function chime() {
  unlockAudio(); // works if the page has had any click since loading (e.g. after a refresh)
  if (!audio) return;
  const now = audio.currentTime;
  [0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach((offset, i) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.type = 'sine';
    osc.frequency.value = i % 3 === 2 ? 1046 : 880;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
    osc.connect(gain).connect(audio!.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.32);
  });
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
