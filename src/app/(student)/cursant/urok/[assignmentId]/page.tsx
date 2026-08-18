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

      <header className="surface-dark dot-grid mt-2 overflow-hidden rounded-[1.5rem] p-6 text-white shadow-lift sm:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
          <IconBook className="size-4" />
          Урок · A1
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{version.titleRu}</h1>
        <p className="prose-lesson mt-1 text-white/65">{version.titleRo}</p>

        {version.objectives.length > 0 ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/8 p-4 backdrop-blur">
            <h2 className="text-sm font-semibold text-white">Чему научитесь</h2>
            <ul className="mt-2.5 flex flex-col gap-1.5 text-sm">
              {version.objectives.map((o) => (
                <li key={o.ru} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-coral" />
                  {o.ru}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      <nav aria-label="Разделы урока" className="sticky top-[4.5rem] z-10 -mx-2 mt-5 overflow-x-auto rounded-xl border border-line bg-canvas/90 p-2 shadow-card backdrop-blur-xl">
        <ol className="flex min-w-max items-center gap-1 text-sm">
          {lessonSections.filter((s) => s.type !== "exercises").map((section, index) => (
            <li key={section.id}>
              <a href={`#s-${section.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-ink-soft hover:bg-surface hover:text-ink">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent-soft text-[0.65rem] font-semibold text-accent">{index + 1}</span>
                {section.titleRu ?? section.type}
              </a>
            </li>
          ))}
          <li><a href="#upr" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-ink-soft hover:bg-surface hover:text-ink"><span className="inline-flex size-5 items-center justify-center rounded-full bg-coral-soft text-[0.65rem] font-semibold text-coral">{lessonSections.filter((s) => s.type !== "exercises").length + 1}</span>Упражнения</a></li>
        </ol>
      </nav>

      {lessonSections
        .filter((s) => s.type !== "exercises")
        .map((section) => {
          const body = section.body as SectionBody;
          return (
            <section key={section.id} className="mt-12 scroll-mt-32" aria-labelledby={`s-${section.id}`}>
              <h2
                id={`s-${section.id}`}
                className="flex items-center gap-2 text-2xl font-semibold"
              >
                {section.type === "audio" ? (
                  <IconSpeaker className="size-4 text-ink-faint" />
                ) : null}
                {section.titleRu ?? section.type}
              </h2>

              {section.type === "theory" ? (
                <div className="mt-3 flex flex-col gap-4">
                  {body.ro ? (
                    <div className="prose-lesson surface-quiet rounded-card border border-line p-6 whitespace-pre-line shadow-card sm:p-8">
                      {body.ro}
                    </div>
                  ) : null}
                  {body.ru ? (
                    <div className="rounded-card border border-accent-line bg-accent-soft/45 p-5 whitespace-pre-line text-ink-soft">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-accent">Подсказка на русском</p>
                      {body.ru}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {section.type === "vocab" ? (
                <div className="mt-3">
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {body.vocabulary?.map((v) => (
                      <li key={v.ro} className="relative rounded-card border border-line bg-surface p-4 shadow-card">
                        <span className="prose-lesson block font-medium text-ink">{v.ro}</span>
                        <span className="mt-1 block text-sm text-ink-soft">{v.ru}</span>
                        {!v.active ? (
                          <span className="absolute right-3 top-3 text-xs text-ink-faint">пассивно</span>
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
