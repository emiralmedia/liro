import { and, asc, eq, notInArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  ChangeDue,
  UnlockLesson,
  type UnlockableLesson,
} from "@/components/teacher/StudentActions";
import { Badge, Card, EmptyState, PageHeading } from "@/components/ui";
import { db } from "@/db";
import {
  assignments,
  attempts,
  exercises,
  homework,
  lessonVersions,
  lessons,
  modules,
  students,
  users,
} from "@/db/schema";
import type { ExercisePrompt } from "@/db/schema";
import { assertCanAccessStudent, assertRole } from "@/lib/authz";
import { effectiveScore } from "@/lib/grading/grade";
import { homeworkStateRo, homeworkTone, relativeDayRo } from "@/lib/labels";
import { getActor } from "@/lib/session";

/**
 * Profilul unui cursant: situația pe scurt înainte de lecție, plus acțiunile
 * profesorului — deblocare și mutarea termenului (brief §6, pasul 1).
 */
export default async function StudentDetail({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const actor = await getActor();
  assertRole(actor, "teacher", "admin");

  const [row] = await db
    .select({
      id: students.id,
      userId: students.userId,
      teacherId: students.teacherId,
      level: students.currentLevel,
      name: users.name,
      email: users.email,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .where(eq(students.id, studentId));
  if (!row) notFound();

  // Un profesor nealocat nu trece de aici, chiar dacă ghicește id-ul.
  assertCanAccessStudent(actor, row);

  const allocated = await db
    .select({
      assignmentId: assignments.id,
      versionId: lessonVersions.id,
      titleRo: lessonVersions.titleRo,
      state: assignments.state,
      homeworkState: homework.state,
      dueAt: homework.dueAt,
      unlockedAt: assignments.unlockedAt,
    })
    .from(assignments)
    .innerJoin(lessonVersions, eq(assignments.lessonVersionId, lessonVersions.id))
    .leftJoin(homework, eq(homework.assignmentId, assignments.id))
    .where(eq(assignments.studentId, studentId))
    .orderBy(asc(assignments.orderIndex));

  const answers = await db
    .select({
      id: attempts.id,
      prompt: exercises.prompt,
      answer: attempts.answer,
      autoScore: attempts.autoScore,
      teacherScore: attempts.teacherScore,
      points: exercises.points,
      needsReview: attempts.needsReview,
      feedback: attempts.teacherFeedback,
    })
    .from(attempts)
    .innerJoin(exercises, eq(attempts.exerciseId, exercises.id))
    .where(eq(attempts.studentId, studentId))
    .orderBy(asc(attempts.createdAt));

  // Lecțiile publicate pe care cursantul NU le are încă.
  const takenVersionIds = allocated.map((a) => a.versionId);
  const available = await db
    .select({
      versionId: lessonVersions.id,
      titleRo: lessonVersions.titleRo,
      level: modules.level,
      moduleTitle: modules.titleRo,
    })
    .from(lessonVersions)
    .innerJoin(lessons, eq(lessonVersions.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      takenVersionIds.length > 0
        ? and(
            eq(lessonVersions.status, "published"),
            notInArray(lessonVersions.id, takenVersionIds),
          )
        : eq(lessonVersions.status, "published"),
    )
    .orderBy(asc(modules.orderIndex), asc(lessons.orderIndex));

  const unlockable: UnlockableLesson[] = available.map((a) => ({
    versionId: a.versionId,
    titleRo: a.titleRo,
    level: a.level,
    moduleTitle: a.moduleTitle,
  }));

  const scored = answers.filter((a) => effectiveScore(a) !== null);
  const totalPoints = scored.reduce((s, a) => s + a.points, 0);
  const earned = scored.reduce((s, a) => s + (effectiveScore(a) ?? 0), 0);
  const pending = answers.filter((a) => a.needsReview).length;

  return (
    <>
      <a href="/profesor" className="inline-flex min-h-11 items-center text-sm text-accent">
        ← Astăzi
      </a>

      <PageHeading
        title={row.name ?? row.email}
        subtitle={`Nivel ${row.level} · ${allocated.length} lecții alocate${
          pending > 0 ? ` · ${pending} de revizuit` : ""
        }`}
      />

      <section aria-labelledby="deblocare" className="mt-8">
        <h2 id="deblocare" className="text-lg font-semibold">
          Deblochează o lecție
        </h2>
        <Card className="mt-3 p-5">
          <UnlockLesson studentId={studentId} lessons={unlockable} />
        </Card>
      </section>

      <section aria-labelledby="alocate" className="mt-8">
        <h2 id="alocate" className="text-lg font-semibold">
          Lecții alocate
        </h2>
        {allocated.length === 0 ? (
          <div className="mt-3">
            <EmptyState>Niciun conținut deblocat încă.</EmptyState>
          </div>
        ) : (
          <Card className="mt-3 overflow-hidden">
            <ul className="divide-y divide-line">
              {allocated.map((a) => (
                <li key={a.assignmentId} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="font-medium">{a.titleRo}</span>
                  {a.homeworkState ? (
                    <Badge tone={homeworkTone[a.homeworkState] ?? "neutral"}>
                      {homeworkStateRo[a.homeworkState] ?? a.homeworkState}
                    </Badge>
                  ) : null}
                  {a.dueAt ? (
                    <span className="text-sm text-ink-faint">
                      termen {relativeDayRo(a.dueAt)}
                    </span>
                  ) : null}
                  <span className="ml-auto">
                    <ChangeDue assignmentId={a.assignmentId} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="raspunsuri" className="mt-8">
        <h2 id="raspunsuri" className="text-lg font-semibold">
          Răspunsuri
        </h2>
        {answers.length === 0 ? (
          <div className="mt-3">
            <EmptyState>Cursantul nu a trimis încă niciun răspuns.</EmptyState>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              Punctaj total: {earned} din {totalPoints}
            </p>
            <Card className="mt-3 overflow-hidden">
              <ul className="divide-y divide-line">
                {answers.map((a) => {
                  const score = effectiveScore(a);
                  const answerText =
                    typeof a.answer === "string" ? a.answer : JSON.stringify(a.answer);
                  return (
                    <li key={a.id} className="px-5 py-4">
                      <p className="text-sm text-ink-soft">{(a.prompt as ExercisePrompt).ru}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <span className="prose-lesson">{answerText}</span>
                        {a.needsReview ? (
                          <Badge tone="warning">de revizuit</Badge>
                        ) : (
                          <Badge tone={score === a.points ? "success" : "neutral"}>
                            {score} / {a.points}
                          </Badge>
                        )}
                        {a.teacherScore !== null ? (
                          <span className="text-xs text-ink-faint">
                            corectat de profesor (automat: {a.autoScore})
                          </span>
                        ) : null}
                      </div>
                      {a.feedback ? (
                        <p className="mt-1 text-sm text-ink-soft">„{a.feedback}”</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        )}
      </section>
    </>
  );
}
