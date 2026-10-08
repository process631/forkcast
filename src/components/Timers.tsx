import { useEffect, useState } from 'react';
import { stepTimers, type Duration } from '../lib/parse';
import { timersStore, useStore } from '../lib/store';
import { cancelTimer, formatClock, markDone, startTimer } from '../lib/timers';

/** Buttons for every duration found in a step ("⏱ 10 min"). */
export function StepTimerButtons({ text, label }: { text: string; label: string }) {
  const timers = stepTimers(text);
  if (!timers.length) return null;
  return (
    <div className="timer-buttons">
      {timers.slice(0, 3).map((d: Duration) => (
        <button key={d.text} type="button" className="btn btn-timer" onClick={() => startTimer(label, d.min)} title={`Start a timer for “${d.text}”`}>
          ⏱️ {d.min >= 60 ? formatClock(d.min * 60_000).replace(/:00$/, ' h') : `${d.min} min`}
        </button>
      ))}
    </div>
  );
}

/** Floating list of running timers. Rings when one finishes. */
export function TimerTray() {
  const timers = useStore(timersStore);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!timers.length) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      for (const timer of timersStore.get()) if (!timer.done && timer.endsAt <= t) markDone(timer.id);
    }, 500);
    return () => clearInterval(id);
  }, [timers.length]);

  if (!timers.length) return null;
  return (
    <aside className="timer-tray" aria-label="Kitchen timers">
      {timers.map((t) => {
        const left = t.endsAt - now;
        const pct = Math.min(100, Math.max(0, 100 - (left / t.totalMs) * 100));
        return (
          <div key={t.id} className={`timer${t.done ? ' timer-done' : ''}`} role={t.done ? 'alert' : undefined}>
            <div className="timer-bar" style={{ width: `${pct}%` }} />
            <div className="timer-body">
              <span className="timer-label">{t.label}</span>
              <span className="timer-clock">{t.done ? '⏰ Done!' : formatClock(left)}</span>
            </div>
            <button type="button" className="icon-btn" onClick={() => cancelTimer(t.id)} aria-label={t.done ? 'Dismiss timer' : 'Cancel timer'}>
              ✕
            </button>
          </div>
        );
      })}
    </aside>
  );
}
