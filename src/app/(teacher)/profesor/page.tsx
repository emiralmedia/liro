import { and, asc, count, eq, gte } from "drizzle-orm";
import { Badge, Card, EmptyState, LinkButton, PageHeading } from "@/components/ui";
import { db } from "@/db";
import {
  assignments,
  attempts,
  homework,
  lessonVersions,
  scheduleEvents,
  students,
  users,
} from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { homeworkStateRo, homeworkTone, relativeDayRo } from "@/lib/labels";
import { getActor } from "@/lib/session";

/**
 * Dashboardul „Astăzi" (brief §5): cine urmează, ce e restant, ce cere
 * revizuire. Interogările filtrează după `students.teacherId` — un cursant
 * nealocat nu apare, indiferent ce ajunge în URL.
 */
export default async function TeacherToday() {
  const actor = await getActor();
  assertRole(actor, "teacher", "admin");

  const roster = await db
    .select({
      studentId: students.id,
      name: users.name,
      level: students.currentLevel,
      assignmentId: assignments.id,
      lessonTitle: lessonVersions.titleRo,
      homeworkState: homework.state,
      dueAt: homework.dueAt,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .leftJoin(assignments, eq(assignments.studentId, students.id))
    .leftJoin(lessonVersions, eq(assignments.lessonVersionId, lessonVersions.id))
    .leftJoin(homework, eq(homework.assignmentId, assignments.id))
    .where(eq(students.teacherId, actor.userId))
    .orderBy(asc(users.name));

  const upcoming = await db
    .select({
      id: scheduleEvents.id,
      startsAt: scheduleEvents.startsAt,
      name: users.name,
    })
    .from(scheduleEvents)
    .innerJoin(students, eq(scheduleEvents.studentId, students.id))
    .innerJoin(users, eq(students.userId, users.id))
    .where(and(eq(students.teacherId, actor.userId), gte(scheduleEvents.startsAt, new Date())))
    .orderBy(asc(scheduleEvents.startsAt))
    .limit(5);

  const [reviewCount] = await db
    .select({ n: count() })
    .from(attempts)
    .innerJoin(students, eq(attempts.studentId, students.id))
    .where(and(eq(students.teacherId, actor.userId), eq(attempts.needsReview, true)));

  const overdue = roster.filter((r) => r.homeworkState === "overdue");
  const pendingReview = reviewCount?.n ?? 0;

  return (
    <>
      <PageHeading
        title="Astăzi"
        subtitle={`${roster.length} cursanți · ${overdue.length} restanțe`}
        actions={
          pendingReview > 0 ? (
            <LinkButton href="/profesor/revizuire">
              De revizuit
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{pendingReview}</span>
            </LinkButton>
          ) : null
        }
      />

      {overdue.length > 0 ? (
        <section aria-labelledby="restante" className="mt-8">
          <h2 id="restante" className="text-lg font-semibold">
            Restanțe
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {overdue.map((r) => (
              <Card
                as="li"
                key={r.assignmentId}
                className="border-l-4 border-l-warning"
              >
                <a
                  href={`/profesor/cursant/${r.studentId}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-sunken"
                >
                <span className="font-medium underline-offset-4 hover:underline">{r.name}</span>
                <span className="text-ink-soft">{r.lessonTitle}</span>
                <span className="ml-auto text-sm text-warning">
                  termen depășit {r.dueAt ? relativeDayRo(r.dueAt) : ""}
                </span>
                </a>
              </Card>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="cursanti" className="mt-8">
        <h2 id="cursanti" className="text-lg font-semibold">
          Cursanți
        </h2>
        <Card className="mt-3 overflow-hidden">
          <ul className="divide-y divide-line">
            {roster.map((r) => (
              <li key={r.assignmentId ?? r.studentId}>
                <a
                  href={`/profesor/cursant/${r.studentId}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 hover:bg-sunken"
                >
                <span className="font-medium underline-offset-4 hover:underline">{r.name}</span>
                <Badge>{r.level}</Badge>
                {r.lessonTitle ? (
                  <span className="text-sm text-ink-soft">{r.lessonTitle}</span>
                ) : (
                  <span className="text-sm text-ink-faint">nicio lecție alocată</span>
                )}
                {r.homeworkState ? (
                  <span className="ml-auto flex items-center gap-2">
                    <Badge tone={homeworkTone[r.homeworkState] ?? "neutral"}>
                      {homeworkStateRo[r.homeworkState] ?? r.homeworkState}
                    </Badge>
                    {r.dueAt ? (
                      <span className="text-sm text-ink-faint">
                        {relativeDayRo(r.dueAt)}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="urmatoarele" className="mt-8">
        <h2 id="urmatoarele" className="text-lg font-semibold">
          Următoarele întâlniri
        </h2>
        {upcoming.length === 0 ? (
          <div className="mt-3">
            <EmptyState>Nicio întâlnire programată.</EmptyState>
          </div>
        ) : (
          <Card className="mt-3 overflow-hidden">
            <ul className="divide-y divide-line">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-4">
                  <span className="font-medium">{e.name}</span>
                  <span className="ml-auto text-sm text-ink-soft">
                    {relativeDayRo(e.startsAt)},{" "}
                    {e.startsAt.toLocaleTimeString("ro-RO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}
