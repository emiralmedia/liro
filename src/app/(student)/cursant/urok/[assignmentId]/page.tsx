import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AudioPlayer } from "@/components/student/AudioPlayer";
import { LessonExercises } from "@/components/student/LessonExercises";
import type { ExerciseData } from "@/components/student/Exercise";
import { db } from "@/db";
import {
  assignments,
  attempts,
  exercises,
  homework,
  lessonVersions,
  mediaAssets,
  sections,
  students,
} from "@/db/schema";
import type { ExercisePrompt, SectionBody } from "@/db/schema";
import { assertCanViewAssignment, assertRole } from "@/lib/authz";
import { getActor } from "@/lib/session";

/**
 * Lecția, așa cum o parcurge cursantul: teorie, vocabular, dialog, exerciții.
 *
 * Accesul trece prin `assignments` — invariantul „blocat implicit". Un id de
 * alocare care nu-i aparține cursantului nu produce conținut, ci 404.
 */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const actor = await getActor();
  assertRole(actor, "student");

  const [me] = await db.select().from(students).where(eq(students.userId, actor.userId));
  if (!me) notFound();

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.studentId, me.id)));
  if (!assignment) notFound();

  assertCanViewAssignment(actor, assignment, me);

  const [version] = await db
    .select()
    .from(lessonVersions)
    .where(eq(lessonVersions.id, assignment.lessonVersionId));
  if (!version) notFound();

  const lessonSections = await db
    .select()
    .from(sections)
    .where(eq(sections.lessonVersionId, version.id))
    .orderBy(asc(sections.orderIndex));

  const exerciseRows = await db
    .select({
      id: exercises.id,
      type: exercises.type,
      prompt: exercises.prompt,
      points: exercises.points,
      orderIndex: exercises.orderIndex,
    })
    .from(exercises)
    .innerJoin(sections, eq(exercises.sectionId, sections.id))
    .where(eq(sections.lessonVersionId, version.id))
    .orderBy(asc(exercises.orderIndex));

  const answeredRows = await db
    .select({ exerciseId: attempts.exerciseId })
    .from(attempts)
    .where(eq(attempts.assignmentId, assignmentId));
  const answeredIds = new Set(answeredRows.map((r) => r.exerciseId));

  const [hw] = await db.select().from(homework).where(eq(homework.assignmentId, assignmentId));

  const audioSection = lessonSections.find((s) => s.type === "audio");
  const audio = audioSection?.mediaAssetId
    ? (await db.select().from(mediaAssets).where(eq(mediaAssets.id, audioSection.mediaAssetId)))[0]
    : undefined;

  const exerciseData: ExerciseData[] = exerciseRows.map((e) => ({
    id: e.id,
    type: e.type,
    prompt: e.prompt as ExercisePrompt as ExerciseData["prompt"],
    points: e.points,
    answered: answeredIds.has(e.id),
  }));

  return (
    <article className="pb-16">
      <a href="/cursant" className="inline-flex min-h-11 items-center text-sm text-[--color-accent]">
        ← К моим урокам
      </a>

      <header className="mt-2 border-b border-[--color-line] pb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-[--color-ink-faint]">
          Урок · A1
        </p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight">{version.titleRu}</h1>
        <p className="mt-1 text-[--color-ink-soft]">{version.titleRo}</p>

        {version.objectives.length > 0 ? (
          <div className="mt-5 rounded-[--radius-card] bg-[--color-accent-soft] p-4">
            <h2 className="text-sm font-semibold text-[--color-accent]">Чему научитесь</h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-[--color-ink]">
              {version.objectives.map((o) => (
                <li key={o.ru}>• {o.ru}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      {lessonSections
        .filter((s) => s.type !== "exercises")
        .map((section) => {
          const body = section.body as SectionBody;
          return (
            <section key={section.id} className="mt-8" aria-labelledby={`s-${section.id}`}>
              <h2 id={`s-${section.id}`} className="text-lg font-semibold">
                {section.titleRu ?? section.type}
              </h2>

              {section.type === "theory" ? (
                <div className="mt-3 flex flex-col gap-4">
                  {body.ro ? (
                    <div className="prose-lesson rounded-[--radius-card] border border-[--color-line] bg-[--color-surface] p-5 whitespace-pre-line">
                      {body.ro}
                    </div>
                  ) : null}
                  {body.ru ? (
                    <div className="rounded-[--radius-card] border-l-4 border-[--color-accent] bg-[--color-sunken] p-5 whitespace-pre-line text-[--color-ink]">
                      {body.ru}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {section.type === "vocab" ? (
                <div className="mt-3">
                  <ul className="divide-y divide-[--color-line] overflow-hidden rounded-[--radius-card] border border-[--color-line] bg-[--color-surface]">
                    {body.vocabulary?.map((v) => (
                      <li key={v.ro} className="flex items-baseline gap-4 px-5 py-3">
                        <span className="prose-lesson min-w-40 font-medium">{v.ro}</span>
                        <span className="text-[--color-ink-soft]">{v.ru}</span>
                        {!v.active ? (
                          <span className="ml-auto text-xs text-[--color-ink-faint]">пассивно</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {body.examples && body.examples.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-3">
                      {body.examples.map((ex) => (
                        <li
                          key={ex.ro}
                          className="rounded-[--radius-card] border border-[--color-line] bg-[--color-surface] p-4"
                        >
                          <p className="prose-lesson">{ex.ro}</p>
                          <p className="mt-1 text-sm text-[--color-ink-soft]">{ex.ru}</p>
                          {ex.note ? (
                            <p className="mt-1 text-xs text-[--color-ink-faint]">{ex.note}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {section.type === "audio" && audio ? (
                <div className="mt-3">
                  {body.ru ? (
                    <p className="mb-3 text-[--color-ink-soft]">{body.ru}</p>
                  ) : null}
                  <AudioPlayer
                    src={audio.storageKey}
                    transcript={audio.transcript}
                    durationMs={audio.durationMs}
                  />
                </div>
              ) : null}
            </section>
          );
        })}

      <LessonExercises
        assignmentId={assignmentId}
        exercises={exerciseData}
        alreadyAnswered={answeredIds.size}
        homeworkState={hw?.state ?? null}
      />
    </article>
  );
}
