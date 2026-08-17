import { and, asc, count, eq, gte, ne } from "drizzle-orm";
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
      <p className="text-ink-soft">
        Ваш профиль ещё не настроен. Обратитесь к преподавателю.
      </p>
    );
  }

  const tasks = await db
    .select({
      assignmentId: assignments.id,
      versionId: assignments.lessonVersionId,
      titleRu: lessonVersions.titleRu,
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

  // Progresul pe lecția curentă: câte exerciții au primit deja un răspuns.
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

  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-tight">Что делать сейчас</h1>

      {current ? (
        <article className="mt-5 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {overdue.length > 0 ? (
            <p className="bg-warning-soft px-5 py-2 text-sm font-medium text-warning">
              Просрочено — сделайте это в первую очередь
            </p>
          ) : null}

          <div className="p-5">
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              Урок · A1
            </p>
            <h2 className="mt-1 text-xl font-semibold">{current.titleRu}</h2>

            {progress.total > 0 ? (
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-sm text-ink-soft">
                  <span>Упражнения</span>
                  <span>
                    {progress.done} из {progress.total}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={progress.done}
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-label="Прогресс по уроку"
                  className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ) : null}

            {current.dueAt ? (
              <p className="mt-4 text-sm text-ink-soft">
                Срок: {current.dueAt.toLocaleDateString("ru-RU")}
                {current.homeworkState ? (
                  <span className="ml-2 text-ink-faint">
                    · {homeworkStateRu[current.homeworkState] ?? current.homeworkState}
                  </span>
                ) : null}
              </p>
            ) : null}

            <a
              href={`/cursant/urok/${current.assignmentId}`}
              className="mt-5 inline-flex min-h-13 w-full items-center justify-center rounded-lg bg-accent px-6 text-base font-medium text-white hover:bg-accent-hover sm:w-auto"
            >
              {progress.done === 0 ? "Начать урок" : "Продолжить"}
            </a>
          </div>
        </article>
      ) : (
        <p className="mt-5 rounded-card border border-dashed border-line-strong px-5 py-8 text-center text-ink-soft">
          Пока нет открытых уроков. Преподаватель откроет следующий после занятия.
        </p>
      )}

      {tasks.length > 1 ? (
        <section aria-labelledby="vse" className="mt-8">
          <h2 id="vse" className="text-lg font-semibold">
            Все уроки
          </h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {tasks.map((t) => (
              <li key={t.assignmentId}>
                <a
                  href={`/cursant/urok/${t.assignmentId}`}
                  className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-sunken"
                >
                  <span className="font-medium">{t.titleRu}</span>
                  {t.homeworkState ? (
                    <span className="ml-auto text-sm text-ink-faint">
                      {homeworkStateRu[t.homeworkState] ?? t.homeworkState}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="vstrecha" className="mt-8">
        <h2 id="vstrecha" className="text-lg font-semibold">
          Следующее занятие
        </h2>
        {nextMeeting ? (
          <p className="mt-2 rounded-card border border-line bg-surface px-5 py-4">
            {nextMeeting.startsAt.toLocaleString("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : (
          <p className="mt-2 text-ink-soft">Занятие ещё не назначено.</p>
        )}
      </section>
    </>
  );
}
