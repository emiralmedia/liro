"use client";

import { useState, useTransition } from "react";
import { reviewAttempt } from "@/app/actions/review";

export type PendingAttempt = {
  id: string;
  studentName: string | null;
  promptRu: string;
  exerciseType: string;
  answer: string;
  canonicalAnswer: string;
  points: number;
  autoScore: number | null;
  autoConfidence: number | null;
};

/**
 * Un caz din coada de revizuire. Profesorul vede răspunsul cursantului lângă
 * cel canonic și decide — verdictul automat e afișat ca informație, nu ca
 * valoare implicită care să-l influențeze.
 */
export function ReviewCard({ attempt }: { attempt: PendingAttempt }) {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <li className="rounded-[--radius-card] border border-[--color-success] bg-[--color-success-soft] px-5 py-4">
        <p className="font-medium text-[--color-success]">
          Corectat: {attempt.studentName} — {attempt.promptRu}
        </p>
      </li>
    );
  }

  function save(value: number) {
    setScore(value);
    startTransition(async () => {
      const r = await reviewAttempt(attempt.id, value, feedback);
      if (r.ok) setDone(true);
      else setError(r.error ?? "Salvarea a eșuat");
    });
  }

  return (
    <li className="rounded-[--radius-card] border border-[--color-line] bg-[--color-surface] p-5 shadow-[--shadow-card]">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium">{attempt.studentName}</span>
        <span className="text-sm text-[--color-ink-faint]">{attempt.exerciseType}</span>
        {attempt.autoConfidence !== null ? (
          <span className="ml-auto text-xs text-[--color-ink-faint]">
            încredere automată {Math.round(attempt.autoConfidence * 100)}%
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-[--color-ink-soft]">{attempt.promptRu}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[--color-line] bg-[--color-sunken] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[--color-ink-faint]">
            Răspunsul cursantului
          </p>
          <p className="prose-lesson mt-1">{attempt.answer || "(gol)"}</p>
        </div>
        <div className="rounded-lg border border-[--color-line] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[--color-ink-faint]">
            Răspuns canonic
          </p>
          <p className="prose-lesson mt-1">{attempt.canonicalAnswer}</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Feedback pentru cursant (opțional)</span>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-[--color-line-strong] p-3 text-sm"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-[--color-ink-soft]">Punctaj din {attempt.points}:</span>
        {Array.from({ length: attempt.points + 1 }, (_, i) => i).map((v) => (
          <button
            key={v}
            type="button"
            disabled={pending}
            onClick={() => save(v)}
            className={`min-h-11 min-w-11 rounded-lg border px-3 font-medium ${
              score === v
                ? "border-[--color-accent] bg-[--color-accent] text-white"
                : "border-[--color-line-strong] hover:bg-[--color-sunken]"
            }`}
          >
            {v}
          </button>
        ))}
        {pending ? <span className="text-sm text-[--color-ink-faint]">se salvează…</span> : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-[--color-danger]">
          {error}
        </p>
      ) : null}
    </li>
  );
}
