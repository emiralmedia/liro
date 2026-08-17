"use client";

import { useState, useTransition } from "react";
import { submitAnswer, type SubmitResult } from "@/app/actions/attempts";

export type ExerciseData = {
  id: string;
  type: "mcq" | "fill" | "match" | "order" | "short" | "audio_q";
  prompt: {
    ru: string;
    options?: Array<{ id: string; text: string }>;
    pairs?: Array<{ left: string; right: string }>;
    items?: string[];
  };
  points: number;
  answered: boolean;
};

/** Mesajele de feedback, în rusă — cursantul le citește imediat după răspuns. */
const VERDICT_COPY: Record<string, { title: string; tone: "ok" | "partial" | "bad" | "pending" }> = {
  correct: { title: "Верно", tone: "ok" },
  correct_no_diacritics: { title: "Почти — не хватает диакритики", tone: "partial" },
  partial: { title: "Частично верно", tone: "partial" },
  incorrect: { title: "Неверно", tone: "bad" },
  undecided: { title: "Отправлено преподавателю", tone: "pending" },
};

export function Exercise({
  assignmentId,
  exercise,
  index,
  onAnswered,
}: {
  assignmentId: string;
  exercise: ExerciseData;
  index: number;
  onAnswered: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Starea răspunsului, pe tipuri.
  const [choice, setChoice] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [ordered, setOrdered] = useState<string[]>([]);
  const [pairs, setPairs] = useState<Record<string, string>>({});

  const items = exercise.prompt.items ?? [];
  const remaining = items.filter((i) => !ordered.includes(i));

  function currentAnswer(): unknown {
    switch (exercise.type) {
      case "mcq":
      case "audio_q":
        return choice;
      case "fill":
      case "short":
        return text;
      case "order":
        return ordered;
      case "match":
        return pairs;
    }
  }

  function isEmpty(): boolean {
    const a = currentAnswer();
    if (typeof a === "string") return a.trim() === "";
    if (Array.isArray(a)) return a.length !== items.length;
    if (a && typeof a === "object") {
      return Object.keys(a).length !== (exercise.prompt.pairs?.length ?? 0);
    }
    return true;
  }

  function send() {
    startTransition(async () => {
      const r = await submitAnswer(assignmentId, exercise.id, currentAnswer());
      setResult(r);
      if (r.ok) onAnswered();
    });
  }

  const locked = result?.ok === true;
  const copy = result?.verdict ? VERDICT_COPY[result.verdict] : null;

  const toneClasses = {
    ok: "border-success bg-success-soft text-success",
    partial: "border-warning bg-warning-soft text-warning",
    bad: "border-danger bg-danger-soft text-danger",
    pending: "border-accent bg-accent-soft text-accent",
  };

  return (
    <li
      data-testid={`exercise-${exercise.type}`}
      className="rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-semibold text-ink-soft">
          {index + 1}
        </span>
        <p className="font-medium">{exercise.prompt.ru}</p>
      </div>

      <div className="mt-4 pl-10">
        {/* Alegere multiplă și întrebări după audio */}
        {(exercise.type === "mcq" || exercise.type === "audio_q") && (
          <fieldset disabled={locked} className="flex flex-col gap-2">
            <legend className="sr-only">{exercise.prompt.ru}</legend>
            {exercise.prompt.options?.map((o) => (
              <label
                key={o.id}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 ${
                  choice === o.id
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:bg-sunken"
                }`}
              >
                <input
                  type="radio"
                  name={`ex-${exercise.id}`}
                  value={o.id}
                  checked={choice === o.id}
                  onChange={() => setChoice(o.id)}
                  className="size-4 accent-accent"
                />
                <span>{o.text}</span>
              </label>
            ))}
          </fieldset>
        )}

        {/* Completare */}
        {exercise.type === "fill" && (
          <input
            type="text"
            value={text}
            disabled={locked}
            onChange={(e) => setText(e.target.value)}
            aria-label="Ответ"
            autoComplete="off"
            className="min-h-12 w-full max-w-sm rounded-lg border border-line-strong px-4 text-base disabled:bg-sunken"
          />
        )}

        {/* Răspuns liber */}
        {exercise.type === "short" && (
          <textarea
            value={text}
            disabled={locked}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            aria-label="Ответ"
            className="w-full rounded-lg border border-line-strong p-3 text-base disabled:bg-sunken"
          />
        )}

        {/* Ordonare */}
        {exercise.type === "order" && (
          <div>
            <div
              aria-label="Ваш вариант"
              className="flex min-h-14 flex-wrap items-center gap-2 rounded-lg border border-dashed border-line-strong p-3"
            >
              {ordered.length === 0 ? (
                <span className="text-sm text-ink-faint">
                  Нажимайте слова в нужном порядке
                </span>
              ) : (
                ordered.map((w, i) => (
                  <button
                    key={`${w}-${i}`}
                    type="button"
                    disabled={locked}
                    onClick={() => setOrdered((prev) => prev.filter((_, idx) => idx !== i))}
                    className="min-h-11 rounded-lg bg-accent-soft px-3 text-accent"
                  >
                    {w}
                  </button>
                ))
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {remaining.map((w) => (
                <button
                  key={w}
                  type="button"
                  disabled={locked}
                  onClick={() => setOrdered((prev) => [...prev, w])}
                  className="min-h-11 rounded-lg border border-line-strong px-3 hover:bg-sunken"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Asociere */}
        {exercise.type === "match" && (
          <div className="flex flex-col gap-2">
            {exercise.prompt.pairs?.map((p) => (
              <div key={p.left} className="flex flex-wrap items-center gap-3">
                <span className="min-w-32 font-medium">{p.left}</span>
                <select
                  disabled={locked}
                  value={pairs[p.left] ?? ""}
                  aria-label={`Перевод для «${p.left}»`}
                  onChange={(e) => setPairs((prev) => ({ ...prev, [p.left]: e.target.value }))}
                  className="min-h-12 flex-1 rounded-lg border border-line-strong px-3 disabled:bg-sunken"
                >
                  <option value="">— выберите —</option>
                  {exercise.prompt.pairs?.map((o) => (
                    <option key={o.right} value={o.right}>
                      {o.right}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {!locked ? (
          <button
            type="button"
            onClick={send}
            disabled={pending || isEmpty()}
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {pending ? "Отправляем…" : "Ответить"}
          </button>
        ) : null}

        {result && !result.ok ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {result.error}
          </p>
        ) : null}

        {locked && copy ? (
          <div
            role="status"
            className={`mt-4 rounded-lg border px-4 py-3 ${toneClasses[copy.tone]}`}
          >
            <p className="font-medium">
              {copy.title}
              {result?.points ? (
                <span className="ml-2 font-normal">
                  {result.score} / {result.points}
                </span>
              ) : null}
            </p>
            {result?.verdict === "undecided" ? (
              <p className="mt-1 text-sm">
                Свободный ответ проверит преподаватель — оценка появится позже.
              </p>
            ) : null}
            {result?.explanationRu ? (
              <p className="mt-1 text-sm text-ink">{result.explanationRu}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
