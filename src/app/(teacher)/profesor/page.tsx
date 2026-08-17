import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { assignments, homework, scheduleEvents, students, users } from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { getActor } from "@/lib/session";

/**
 * Dashboardul „Astăzi" (brief §5): cursanții următori, temele și restanțele.
 *
 * Interogarea filtrează după `students.teacherId = actor.userId` — profesorul
 * nu are cum să vadă un cursant nealocat, indiferent ce ajunge în URL.
 */
export default async function TeacherToday() {
  const actor = await getActor();
  assertRole(actor, "teacher", "admin");

  const rows = await db
    .select({
      studentId: students.id,
      name: users.name,
      level: students.currentLevel,
      homeworkState: homework.state,
      dueAt: homework.dueAt,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .leftJoin(assignments, eq(assignments.studentId, students.id))
    .leftJoin(homework, eq(homework.assignmentId, assignments.id))
    .where(eq(students.teacherId, actor.userId))
    .orderBy(asc(users.name));

  const upcoming = await db
    .select({
      studentId: scheduleEvents.studentId,
      startsAt: scheduleEvents.startsAt,
      name: users.name,
    })
    .from(scheduleEvents)
    .innerJoin(students, eq(scheduleEvents.studentId, students.id))
    .innerJoin(users, eq(students.userId, users.id))
    .where(and(eq(students.teacherId, actor.userId), gte(scheduleEvents.startsAt, new Date())))
    .orderBy(asc(scheduleEvents.startsAt))
    .limit(5);

  const overdue = rows.filter((r) => r.homeworkState === "overdue");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Astăzi</h1>

      <section aria-labelledby="restante" className="mt-8">
        <h2 id="restante" className="text-lg font-medium">
          Restanțe
        </h2>
        {overdue.length === 0 ? (
          <p className="mt-2 text-stone-600">Nicio restanță.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {overdue.map((r) => (
              <li
                key={r.studentId}
                className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3"
              >
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-stone-700">
                  temă restantă din {r.dueAt?.toLocaleDateString("ro-RO")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cursanti" className="mt-8">
        <h2 id="cursanti" className="text-lg font-medium">
          Cursanți
        </h2>
        <ul className="mt-2 divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {rows.map((r) => (
            <li key={`${r.studentId}-${r.dueAt?.toISOString() ?? "none"}`} className="px-4 py-3">
              <span className="font-medium">{r.name}</span>
              <span className="ml-2 text-sm text-stone-600">nivel {r.level}</span>
              {r.homeworkState ? (
                <span className="ml-2 text-sm text-stone-600">· temă: {r.homeworkState}</span>
              ) : (
                <span className="ml-2 text-sm text-stone-500">· nicio lecție alocată</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="urmatoarele" className="mt-8">
        <h2 id="urmatoarele" className="text-lg font-medium">
          Următoarele întâlniri
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-stone-600">Nicio întâlnire programată.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {upcoming.map((e) => (
              <li key={`${e.studentId}-${e.startsAt.toISOString()}`} className="text-stone-800">
                {e.name} — {e.startsAt.toLocaleString("ro-RO")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
