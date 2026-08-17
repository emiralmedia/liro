"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeDueDate, unlockLesson } from "@/app/actions/assignments";

export type UnlockableLesson = {
  versionId: string;
  titleRo: string;
  level: string;
  moduleTitle: string;
};

/**
 * Deblocarea unei lecții. Profesorul alege lecția și termenul; conținutul rămâne
 * inaccesibil cursantului până apasă butonul.
 */
export function UnlockLesson({
  studentId,
  lessons,
}: {
  studentId: string;
  lessons: UnlockableLesson[];
}) {
  const router = useRouter();
  const [versionId, setVersionId] = useState(lessons[0]?.versionId ?? "");
  const [days, setDays] = useState(7);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (lessons.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Toate lecțiile publicate sunt deja deblocate pentru acest cursant.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="unlock-lesson" className="text-sm font-medium">
          Lecție
        </label>
        <select
          id="unlock-lesson"
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
          className="min-h-11 min-w-64 rounded-lg border border-line-strong px-3"
        >
          {lessons.map((l) => (
            <option key={l.versionId} value={l.versionId}>
              {l.level} · {l.moduleTitle} — {l.titleRo}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="unlock-due" className="text-sm font-medium">
          Termen
        </label>
        <select
          id="unlock-due"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="min-h-11 rounded-lg border border-line-strong px-3"
        >
          <option value={3}>în 3 zile</option>
          <option value={7}>într-o săptămână</option>
          <option value={14}>în două săptămâni</option>
        </select>
      </div>

      <button
        type="button"
        disabled={pending || !versionId}
        onClick={() =>
          startTransition(async () => {
            const r = await unlockLesson(studentId, versionId, days);
            if (r.ok) router.refresh();
            else setError(r.error ?? "Deblocarea a eșuat");
          })
        }
        className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
      >
        {pending ? "Se deblochează…" : "Deblochează"}
      </button>

      {error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Mutarea termenului, direct din lista de lecții alocate. */
export function ChangeDue({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-lg px-3 text-sm text-accent hover:bg-sunken"
      >
        Mută termenul
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      {[3, 7, 14].map((d) => (
        <button
          key={d}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await changeDueDate(assignmentId, d);
              if (r.ok) {
                setOpen(false);
                router.refresh();
              }
            })
          }
          className="min-h-11 rounded-lg border border-line-strong px-3 text-sm hover:bg-sunken disabled:opacity-40"
        >
          +{d}z
        </button>
      ))}
    </span>
  );
}
