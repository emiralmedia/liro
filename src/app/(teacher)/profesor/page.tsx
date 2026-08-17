import { and, asc, count, eq, gte, inArray } from "drizzle-orm";
import {
  IconAlert,
  IconArrowRight,
  IconCalendar,
  IconInbox,
  IconUsers,
} from "@/components/icons";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageHeading,
  ProgressRing,
  SectionHeading,
} from "@/components/ui";
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
      versionId: assignments.lessonVersionId,
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
    .select({ id: scheduleEvents.id, startsAt: scheduleEvents.startsAt, name: users.name })
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

  // Progresul fiecărei alocări: câte exerciții au primit răspuns din câte are
  // lecția. Se citește dintr-o privire, ca inel, nu ca procent scris.
  const assignmentIds = roster.map((r) => r.assignmentId).filter((id): id is string => id !== null);
  const versionIds = roster.map((r) => r.versionId).filter((id): id is string => id !== null);

  const answeredPerAssignment = new Map<string, number>();
  const exercisesPerVersion = new Map<string, number>();

  if (assignmentIds.length > 0) {
    const rows = await db
      .select({ assignmentId: attempts.assignmentId, n: count() })
      .from(attempts)
      .where(inArray(attempts.assignmentId, assignmentIds))
      .groupBy(attempts.assignmentId);
    for (const r of rows) answeredPerAssignment.set(r.assignmentId, r.n);
  }
  if (versionIds.length > 0) {
    const rows = await db
      .select({ versionId: sections.lessonVersionId, n: count(exercises.id) })
      .from(sections)
      .leftJoin(exercises, eq(exercises.sectionId, sections.id))
      .where(inArray(sections.lessonVersionId, versionIds))
      .groupBy(sections.lessonVersionId);
    for (const r of rows) exercisesPerVersion.set(r.versionId, r.n);
  }

  /**
   * Un cursant are mai multe alocări în timp, iar join-ul întoarce câte un rând
   * pentru fiecare. Lista trebuie să arate o linie per PERSOANĂ, cu lecția
   * relevantă acum: întâi restanța, apoi ce e în lucru, altfel ultima primită.
   */
  const rank = (state: string | null) =>
    state === "overdue" ? 0 : state === "in_progress" || state === "submitted" ? 1 : 2;

  const currentPerStudent = new Map<string, (typeof roster)[number]>();
  for (const r of roster) {
    const held = currentPerStudent.get(r.studentId);
    if (!held || rank(r.homeworkState) < rank(held.homeworkState)) {
      currentPerStudent.set(r.studentId, r);
    }
  }
  const rosterRows = [...currentPerStudent.values()];

  const overdue = roster.filter((r) => r.homeworkState === "overdue");
  const pendingReview = reviewCount?.n ?? 0;
  const uniqueStudents = new Set(roster.map((r) => r.studentId)).size;
  const next = upcoming[0];

  const today = new Date().toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <PageHeading eyebrow={today} title="Astăzi" subtitle={`${uniqueStudents} cursanți`} />

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<IconUsers />} value={uniqueStudents} label="cursanți activi" />
        <Stat
          icon={<IconAlert />}
          value={overdue.length}
          label="restanțe"
          tone={overdue.length > 0 ? "warning" : "neutral"}
        />
        <Stat
          icon={<IconInbox />}
          value={pendingReview}
          label="de revizuit"
          tone={pendingReview > 0 ? "accent" : "neutral"}
          href={pendingReview > 0 ? "/profesor/revizuire" : undefined}
        />
        <Stat
          icon={<IconCalendar />}
          value={next ? relativeDayRo(next.startsAt) : "—"}
          label={next?.name ?? "nicio întâlnire"}
        />
      </div>

      {overdue.length > 0 ? (
        <section aria-labelledby="restante" className="mt-10">
          <SectionHeading id="restante" icon={<IconAlert />}>
            Restanțe
          </SectionHeading>
          <ul className="flex flex-col gap-2">
            {overdue.map((r) => (
              <Card
                as="li"
                key={r.assignmentId}
                className="overflow-hidden border-l-4 border-l-warning"
              >
                <a
                  href={`/profesor/cursant/${r.studentId}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-warning-soft"
                >
                  <Avatar name={r.name} />
                  <span className="font-medium underline-offset-4 hover:underline">{r.name}</span>
                  <span className="text-ink-soft">{r.lessonTitle}</span>
                  <span className="ml-auto flex items-center gap-2 text-sm font-medium text-warning">
                    termen depășit {r.dueAt ? relativeDayRo(r.dueAt) : ""}
                    <IconArrowRight className="size-4" />
                  </span>
                </a>
              </Card>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="cursanti" className="mt-10">
        <SectionHeading id="cursanti" icon={<IconUsers />}>
          Cursanți
        </SectionHeading>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {rosterRows.map((r) => {
              const total = r.versionId ? (exercisesPerVersion.get(r.versionId) ?? 0) : 0;
              const done = r.assignmentId ? (answeredPerAssignment.get(r.assignmentId) ?? 0) : 0;
              return (
                <li key={r.assignmentId ?? r.studentId}>
                  <a
                    href={`/profesor/cursant/${r.studentId}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-sunken"
                  >
                    <Avatar name={r.name} />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium underline-offset-4 hover:underline">
                        {r.name}
                      </span>
                      <span className="text-sm text-ink-faint">
                        {r.lessonTitle ?? "nicio lecție alocată"}
                      </span>
                    </span>

                    <span className="ml-auto flex items-center gap-3">
                      <Badge>{r.level}</Badge>
                      {r.homeworkState ? (
                        <Badge tone={homeworkTone[r.homeworkState] ?? "neutral"}>
                          {homeworkStateRo[r.homeworkState] ?? r.homeworkState}
                        </Badge>
                      ) : null}
                      {total > 0 ? (
                        <ProgressRing value={done} max={total} label="Exerciții rezolvate" />
                      ) : null}
                      <IconArrowRight className="size-4 text-ink-faint" />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="urmatoarele" className="mt-10">
        <SectionHeading id="urmatoarele" icon={<IconCalendar />}>
          Următoarele întâlniri
        </SectionHeading>
        {upcoming.length === 0 ? (
          <EmptyState>Nicio întâlnire programată.</EmptyState>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-4">
                  <Avatar name={e.name} className="size-8 text-xs" />
                  <span className="font-medium">{e.name}</span>
                  <span className="ml-auto text-sm text-ink-soft">
                    {relativeDayRo(e.startsAt)},{" "}
                    {e.startsAt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
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

/**
 * Cifră mare cu etichetă. Stă aici, nu în `ui.tsx`: e specifică acestui
 * dashboard, iar o componentă partajată ar invita variante de care n-avem nevoie.
 */
function Stat({
  icon,
  value,
  label,
  tone = "neutral",
  href,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  tone?: "neutral" | "warning" | "accent";
  href?: string;
}) {
  const shells = {
    neutral: "border-line bg-surface",
    warning: "border-warning/30 bg-warning-soft",
    accent: "border-accent-line bg-accent-soft",
  };
  const icons = {
    neutral: "text-ink-faint",
    warning: "text-warning",
    accent: "text-accent",
  };

  const body = (
    <>
      <span className={`mb-3 inline-flex ${icons[tone]}`}>{icon}</span>
      <span className="block text-3xl font-semibold tabular-nums tracking-tight">{value}</span>
      <span className="mt-0.5 block truncate text-sm text-ink-soft">{label}</span>
    </>
  );

  const shell = `rounded-card border p-5 shadow-card ${shells[tone]}`;

  return href ? (
    <a href={href} className={`${shell} block transition-shadow hover:shadow-lift`}>
      {body}
    </a>
  ) : (
    <div className={shell}>{body}</div>
  );
}
