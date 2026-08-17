"use client";

import { useState, useTransition } from "react";
import { submitHomework } from "@/app/actions/attempts";
import { Exercise, type ExerciseData } from "./Exercise";

/**
 * Lista de exerciții cu progres vizibil. Cursantul trebuie să știe în orice
 * moment cât mai are — brief §7: „fiecare ecran are o acțiune principală clară".
 */
export function LessonExercises({
  assignmentId,
  exercises,
  alreadyAnswered,
  homeworkState,
}: {
  assignmentId: string;
  exercises: ExerciseData[];
  alreadyAnswered: number;
  homeworkState: string | null;
}) {
  const [answered, setAnswered] = useState(alreadyAnswered);
  const [submitted, setSubmitted] = useState(homeworkState === "submitted");
  const [pending, startTransition] = useTransition();

  const total = exercises.length;
  const done = Math.min(answered, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section aria-labelledby="upr" className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 id="upr" className="text-lg font-semibold">
          Упражнения
        </h2>
        <span className="text-sm text-ink-soft">
          {done} из {total}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Прогресс по упражнениям"
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sunken"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-5 flex flex-col gap-4">
        {exercises.map((ex, i) => (
          <Exercise
            key={ex.id}
            assignmentId={assignmentId}
            exercise={ex}
            index={i}
            onAnswered={() => setAnswered((n) => n + 1)}
          />
        ))}
      </ul>

      <div className="mt-8 rounded-card border border-line bg-surface p-5">
        {submitted ? (
          <p role="status" className="font-medium text-success">
            Задание отправлено преподавателю.
          </p>
        ) : (
          <>
            <p className="text-ink-soft">
              {done < total
                ? `Осталось ответить: ${total - done}. Отправить можно и раньше — преподаватель увидит, что сделано.`
                : "Все упражнения выполнены. Отправьте задание преподавателю."}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await submitHomework(assignmentId);
                  if (r.ok) setSubmitted(true);
                })
              }
              className="mt-4 inline-flex min-h-12 items-center rounded-lg bg-accent px-6 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
            >
              {pending ? "Отправляем…" : "Отправить задание"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
