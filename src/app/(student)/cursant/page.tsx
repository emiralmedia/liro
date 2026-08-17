import { and, asc, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  assignments,
  homework,
  lessonVersions,
  scheduleEvents,
  students,
} from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { getActor } from "@/lib/session";

/**
 * Ecranul principal al cursantului (brief §5): ce am de făcut acum, ce e
 * restant, când e următoarea întâlnire.
 *
 * Interogarea pornește din `students` filtrat după utilizatorul din sesiune și
 * ajunge la conținut EXCLUSIV prin `assignments` — invariantul „blocat
 * implicit". Lecțiile nealocate nu apar, oricâte ar exista în bibliotecă.
 */
export default async function StudentHome() {
  const actor = await getActor();
  assertRole(actor, "student");

  const [me] = await db.select().from(students).where(eq(students.userId, actor.userId));

  if (!me) {
    return (
      <p className="text-stone-700">
        Ваш профиль ещё не настроен. Обратитесь к преподавателю.
      </p>
    );
  }

  const tasks = await db
    .select({
      assignmentId: assignments.id,
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

  const overdue = tasks.filter((t) => t.homeworkState === "overdue");
  const current = tasks.find((t) => t.homeworkState !== "overdue") ?? tasks[0];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Что делать сейчас</h1>

      {overdue.length > 0 ? (
        <section
          aria-labelledby="dolg"
          className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4"
        >
          <h2 id="dolg" className="font-medium">
            Просроченное задание
          </h2>
          {overdue.map((t) => (
            <p key={t.assignmentId} className="mt-1 text-stone-800">
              {t.titleRu} — срок был {t.dueAt?.toLocaleDateString("ru-RU")}
            </p>
          ))}
          <p className="mt-2 text-sm text-stone-700">
            Сначала закончите его: оно остаётся в приоритете.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="seichas" className="mt-6">
        <h2 id="seichas" className="sr-only">
          Текущий урок
        </h2>
        {current ? (
          <article className="rounded-md border border-stone-200 bg-white p-5">
            <h3 className="text-lg font-medium">{current.titleRu}</h3>
            {current.dueAt ? (
              <p className="mt-1 text-sm text-stone-600">
                Срок: {current.dueAt.toLocaleDateString("ru-RU")}
              </p>
            ) : null}
            <a
              href={`/cursant/urok/${current.assignmentId}`}
              className="mt-4 inline-flex min-h-12 items-center rounded-md bg-stone-900 px-5 font-medium text-white hover:bg-stone-800"
            >
              Продолжить
            </a>
          </article>
        ) : (
          <p className="text-stone-700">
            Пока нет открытых уроков. Преподаватель откроет следующий после занятия.
          </p>
        )}
      </section>

      <section aria-labelledby="vstrecha" className="mt-8">
        <h2 id="vstrecha" className="text-lg font-medium">
          Следующее занятие
        </h2>
        {nextMeeting ? (
          <p className="mt-1 text-stone-800">
            {nextMeeting.startsAt.toLocaleString("ru-RU")}
          </p>
        ) : (
          <p className="mt-1 text-stone-600">Занятие ещё не назначено.</p>
        )}
      </section>
    </>
  );
}
