import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { IconArrowRight, IconBook, IconSpeaker } from "@/components/icons";
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
      <a
        href="/cursant"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-accent hover:underline"
      >
        <IconArrowRight className="size-4 rotate-180" />
        К моим урокам
      </a>

      <header className="surface-hero mt-2 overflow-hidden rounded-card border border-line p-6 shadow-card">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
          <IconBook className="size-4" />
          Урок · A1
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{version.titleRu}</h1>
        <p className="prose-lesson mt-1 text-ink-soft">{version.titleRo}</p>

        {version.objectives.length > 0 ? (
          <div className="mt-6 rounded-lg border border-accent-line bg-surface/70 p-4">
            <h2 className="text-sm font-semibold text-accent">Чему научитесь</h2>
            <ul className="mt-2.5 flex flex-col gap-1.5 text-sm">
              {version.objectives.map((o) => (
                <li key={o.ru} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {o.ru}
                </li>
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
            <section key={section.id} className="mt-9" aria-labelledby={`s-${section.id}`}>
              <h2
                id={`s-${section.id}`}
                className="flex items-center gap-2 text-base font-semibold"
              >
                {section.type === "audio" ? (
                  <IconSpeaker className="size-4 text-ink-faint" />
                ) : null}
                {section.titleRu ?? section.type}
              </h2>

              {section.type === "theory" ? (
                <div className="mt-3 flex flex-col gap-4">
                  {body.ro ? (
                    <div className="prose-lesson surface-quiet rounded-card border border-line p-6 whitespace-pre-line shadow-card">
                      {body.ro}
                    </div>
                  ) : null}
                  {body.ru ? (
                    <div className="rounded-card border border-line border-l-4 border-l-accent bg-sunken p-5 whitespace-pre-line text-ink-soft">
                      {body.ru}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {section.type === "vocab" ? (
                <div className="mt-3">
                  <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
                    {body.vocabulary?.map((v) => (
                      <li key={v.ro} className="flex items-baseline gap-4 px-5 py-3.5">
                        <span className="prose-lesson min-w-40 font-medium text-ink">{v.ro}</span>
                        <span className="text-ink-soft">{v.ru}</span>
                        {!v.active ? (
                          <span className="ml-auto text-xs text-ink-faint">пассивно</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {body.examples && body.examples.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-3">
                      {body.examples.map((ex) => (
                        <li
                          key={ex.ro}
                          className="rounded-card border border-line bg-surface p-4"
                        >
                          <p className="prose-lesson">{ex.ro}</p>
                          <p className="mt-1 text-sm text-ink-soft">{ex.ru}</p>
                          {ex.note ? (
                            <p className="mt-1 text-xs text-ink-faint">{ex.note}</p>
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
                    <p className="mb-3 text-ink-soft">{body.ru}</p>
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
