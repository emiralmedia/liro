import { and, asc, count, eq, gte, ne } from "drizzle-orm";
import { IconAlert, IconArrowRight, IconCalendar, IconBook } from "@/components/icons";
import { db } from "@/db";
import {
  assignments,
  attempts,
  exercises,
  homework,
  lessonVersions,
  scheduleEvents,
  sections,
  students,
} from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { homeworkStateRu } from "@/lib/labels";
import { getActor } from "@/lib/session";

/**
 * Ecranul principal al cursantului (brief §5): ce am de făcut acum, ce e
 * restant, când e următoarea întâlnire. O singură acțiune principală, vizibilă.
 *
 * Accesul la conținut trece exclusiv prin `assignments` — lecțiile nealocate nu
 * apar, oricâte ar exista în bibliotecă.
 */
export default async function StudentHome() {
  const actor = await getActor();
  assertRole(actor, "student");

  const [me] = await db.select().from(students).where(eq(students.userId, actor.userId));
  if (!me) {
    return (
      <p className="text-ink-soft">Ваш профиль ещё не настроен. Обратитесь к преподавателю.</p>
    );
  }

  const tasks = await db
    .select({
      assignmentId: assignments.id,
      versionId: assignments.lessonVersionId,
      titleRu: lessonVersions.titleRu,
      titleRo: lessonVersions.titleRo,
      state: assignments.state,
      homeworkState: homework.state,
      dueAt: homework.dueAt,
    })
    .from(assignments)
    .innerJoin(lessonVersions, eq(assignments.lessonVersionId, lessonVersions.id))
    .leftJoin(homework, eq(homework.assignmentId, assignments.id))
    .where(and(eq(assignments.studentId, me.id), ne(assignments.state, "locked")))
    .orderBy(asc(assignments.orderIndex));

  const [nextMeeting] = await db
    .select()
    .from(scheduleEvents)
    .where(and(eq(scheduleEvents.studentId, me.id), gte(scheduleEvents.startsAt, new Date())))
    .orderBy(asc(scheduleEvents.startsAt))
    .limit(1);

  const overdue = tasks.filter((t) => t.homeworkState === "overdue");
  const current = overdue[0] ?? tasks.find((t) => t.homeworkState !== "graded") ?? tasks[0];

  let progress = { done: 0, total: 0 };
  if (current) {
    const [totalRow] = await db
      .select({ n: count() })
      .from(exercises)
      .innerJoin(sections, eq(exercises.sectionId, sections.id))
      .where(eq(sections.lessonVersionId, current.versionId));
    const [doneRow] = await db
      .select({ n: count() })
      .from(attempts)
      .where(eq(attempts.assignmentId, current.assignmentId));
    progress = { done: doneRow?.n ?? 0, total: totalRow?.n ?? 0 };
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const rest = tasks.filter((t) => t.assignmentId !== current?.assignmentId);

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-accent">Ваш маршрут</p>
      <h1 className="mt-1 text-4xl font-semibold leading-tight">Что делать сейчас</h1>
      <p className="mt-2 text-ink-soft">Один понятный шаг — и вы ближе к свободной речи.</p>

      {current ? (
        <article className="surface-dark dot-grid relative mt-6 overflow-hidden rounded-[1.5rem] text-white shadow-lift">
          {overdue.length > 0 ? (
            <p className="flex items-center gap-2 bg-coral px-5 py-2.5 text-sm font-medium text-white">
              <IconAlert className="size-4" />
              Просрочено — сделайте это в первую очередь
            </p>
          ) : null}

          <div className="p-6">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
              <IconBook className="size-4" />
              Урок · A1
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{current.titleRu}</h2>
            <p className="prose-lesson mt-1 text-white/65">{current.titleRo}</p>

            {progress.total > 0 ? (
              <div className="mt-6">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-white/60">Упражнения</span>
                  <span className="font-medium tabular-nums">
                    {progress.done} / {progress.total}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={progress.done}
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-label="Прогресс по уроку"
                  className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-full rounded-full bg-coral transition-[width] duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ) : null}

            <a
              href={`/cursant/urok/${current.assignmentId}`}
              className="mt-6 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-accent-deep shadow-card transition-all hover:-translate-y-0.5 active:translate-y-px sm:w-auto"
            >
              {progress.done === 0 ? "Начать урок" : "Продолжить"}
              <IconArrowRight className="size-5" />
            </a>

            {current.dueAt ? (
              <p className="mt-3 text-sm text-white/50">
                Срок: {current.dueAt.toLocaleDateString("ru-RU")}
                {current.homeworkState ? (
                  <span> · {homeworkStateRu[current.homeworkState] ?? current.homeworkState}</span>
                ) : null}
              </p>
            ) : null}
          </div>
        </article>
      ) : (
        <p className="mt-5 rounded-card border border-dashed border-line-strong bg-surface/60 px-5 py-12 text-center text-ink-soft">
          Пока нет открытых уроков. Преподаватель откроет следующий после занятия.
        </p>
      )}

      {rest.length > 0 ? (
        <section aria-labelledby="vse" className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">Дальше по маршруту</p>
          <h2 id="vse" className="mb-3 mt-1 text-xl font-semibold">Другие уроки</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
            {rest.map((t, index) => (
              <li key={t.assignmentId}>
                <a
                  href={`/cursant/urok/${t.assignmentId}`}
                  className="flex min-h-14 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-sunken"
                >
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{index + 2}</span>
                  <span className="font-medium">{t.titleRu}</span>
                  {t.homeworkState ? (
                    <span className="ml-auto text-sm text-ink-faint">
                      {homeworkStateRu[t.homeworkState] ?? t.homeworkState}
                    </span>
                  ) : null}
                  <IconArrowRight className="size-4 text-ink-faint" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="vstrecha" className="mt-9">
        <h2 id="vstrecha" className="mb-3 flex items-center gap-2 text-base font-semibold">
          <IconCalendar className="size-4 text-ink-faint" />
          Следующее занятие
        </h2>
        {nextMeeting ? (
          <p className="rounded-card border border-line bg-surface px-5 py-4 shadow-card">
            {nextMeeting.startsAt.toLocaleString("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : (
          <p className="text-ink-soft">Занятие ещё не назначено.</p>
        )}
      </section>
    </>
  );
}
