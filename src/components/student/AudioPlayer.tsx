"use client";

import { useRef, useState } from "react";

/**
 * Player pentru exercițiile de ascultare (brief §5).
 *
 * Trei cerințe din brief, toate cu motiv pedagogic:
 *  - viteză ajustabilă, fiindcă un începător nu prinde ritmul normal;
 *  - reluare pe fragmente, ca să poți repeta o replică fără să o iei de la cap;
 *  - transcrierea ASCUNSĂ implicit — dacă textul e vizibil, exercițiul nu mai
 *    testează ascultarea.
 */
export function AudioPlayer({
  src,
  transcript,
  durationMs,
}: {
  src: string;
  transcript: string | null;
  durationMs: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [progress, setProgress] = useState(0);

  const rates = [0.75, 1, 1.25];

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  function rewind(seconds: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime - seconds);
  }

  function changeRate(value: number) {
    setRate(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  }

  const totalSeconds = durationMs ? Math.round(durationMs / 1000) : null;

  return (
    <div className="rounded-[--radius-card] border border-[--color-line] bg-[--color-sunken] p-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress((el.currentTime / el.duration) * 100);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Пауза" : "Слушать"}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-[--color-accent] text-white hover:bg-[--color-accent-hover]"
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4 2.5v11l9-5.5-9-5.5Z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => rewind(5)}
          className="min-h-11 rounded-lg border border-[--color-line-strong] bg-[--color-surface] px-3 text-sm font-medium hover:bg-[--color-sunken]"
        >
          ← 5 сек
        </button>

        <div className="flex items-center gap-1" role="group" aria-label="Скорость воспроизведения">
          {rates.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => changeRate(r)}
              aria-pressed={rate === r}
              className={`min-h-11 rounded-lg px-3 text-sm font-medium ${
                rate === r
                  ? "bg-[--color-accent-soft] text-[--color-accent]"
                  : "text-[--color-ink-soft] hover:bg-[--color-surface]"
              }`}
            >
              {r}×
            </button>
          ))}
        </div>

        {totalSeconds ? (
          <span className="ml-auto text-sm text-[--color-ink-faint]">{totalSeconds} сек</span>
        ) : null}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[--color-line]">
        <div className="h-full bg-[--color-accent]" style={{ width: `${progress}%` }} />
      </div>

      {transcript ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            aria-expanded={showTranscript}
            className="min-h-11 text-sm font-medium text-[--color-accent] underline underline-offset-4"
          >
            {showTranscript ? "Скрыть текст" : "Показать текст"}
          </button>
          {showTranscript ? (
            <p className="prose-lesson mt-2 whitespace-pre-line rounded-lg bg-[--color-surface] p-4">
              {transcript}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[--color-ink-faint]">
              Сначала послушайте дважды — текст подсказывает ответы.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
