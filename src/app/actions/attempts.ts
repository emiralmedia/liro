"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { assignments, attempts, exercises, homework, sections, students } from "@/db/schema";
import { ForbiddenError, assertCanSubmitAttempt } from "@/lib/authz";
import { REVIEW_CONFIDENCE_THRESHOLD, gradeAttempt } from "@/lib/grading/grade";
import { getActor } from "@/lib/session";

export type SubmitResult = {
  ok: boolean;
  score?: number;
  points?: number;
  verdict?: "correct" | "correct_no_diacritics" | "partial" | "incorrect" | "undecided";
  needsReview?: boolean;
  explanationRu?: string | null;
  error?: string;
};

/**
 * Trimite un răspuns, îl corectează automat și îl înregistrează.
 *
 * Verdictul automat este o recomandare: pentru răspunsurile libere pe care
 * motorul nu le poate decide, atempt-ul intră în coada de revizuire a
 * profesorului în loc să fie declarat greșit (brief §5).
 */
export async function submitAnswer(
  assignmentId: string,
  exerciseId: string,
  answer: unknown,
): Promise<SubmitResult> {
  try {
    const actor = await getActor();

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId));
    if (!assignment) return { ok: false, error: "Задание не найдено" };

    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, assignment.studentId));
    if (!student) return { ok: false, error: "Профиль не найден" };

    // Autorizarea, înaintea oricărei scrieri.
    assertCanSubmitAttempt(actor, assignment, student);

    // Exercițiul trebuie să aparțină chiar versiunii alocate. Fără verificarea
    // asta, un id de exercițiu trimis de client ar putea veni din altă lecție.
    const [exercise] = await db
      .select({
        id: exercises.id,
        type: exercises.type,
        canonicalAnswer: exercises.canonicalAnswer,
        acceptedVariants: exercises.acceptedVariants,
        points: exercises.points,
        explanationRu: exercises.explanationRu,
      })
      .from(exercises)
      .innerJoin(sections, eq(exercises.sectionId, sections.id))
      .where(
        and(eq(exercises.id, exerciseId), eq(sections.lessonVersionId, assignment.lessonVersionId)),
      );
    if (!exercise) return { ok: false, error: "Упражнение не относится к этому уроку" };

    const result = gradeAttempt(
      {
        type: exercise.type,
        canonicalAnswer: exercise.canonicalAnswer,
        acceptedVariants: exercise.acceptedVariants,
        points: exercise.points,
      },
      answer,
    );

    const previous = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.assignmentId, assignmentId), eq(attempts.exerciseId, exerciseId)));

    await db.insert(attempts).values({
      studentId: student.id,
      assignmentId,
      exerciseId,
      answer: answer as never,
      autoScore: result.score,
      autoConfidence: result.confidence,
      needsReview: result.needsReview || result.confidence < REVIEW_CONFIDENCE_THRESHOLD,
      attemptNumber: previous.length + 1,
    });

    // Prima interacțiune scoate lecția și tema din starea „neîncepută".
    if (assignment.state === "unlocked") {
      await db
        .update(assignments)
        .set({ state: "in_progress" })
        .where(eq(assignments.id, assignmentId));
    }
    await db
      .update(homework)
      .set({ state: "in_progress" })
      .where(and(eq(homework.assignmentId, assignmentId), eq(homework.state, "not_started")));

    // Fără revalidare aici, din același motiv: ar demonta componentele de
    // exercițiu și ar șterge feedbackul tocmai afișat cursantului.
    return {
      ok: true,
      score: result.score,
      points: exercise.points,
      verdict: result.verdict,
      needsReview: result.needsReview,
      explanationRu: exercise.explanationRu,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("submitAnswer:", error);
    return { ok: false, error: "Не удалось сохранить ответ" };
  }
}

/** Marchează tema ca trimisă spre corectare. */
export async function submitHomework(assignmentId: string): Promise<{ ok: boolean }> {
  const actor = await getActor();

  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
  if (!assignment) return { ok: false };

  const [student] = await db.select().from(students).where(eq(students.id, assignment.studentId));
  if (!student) return { ok: false };

  assertCanSubmitAttempt(actor, assignment, student);

  await db
    .update(homework)
    .set({ state: "submitted", submittedAt: new Date() })
    .where(eq(homework.assignmentId, assignmentId));

  revalidatePath("/cursant");
  revalidatePath(`/cursant/urok/${assignmentId}`);
  return { ok: true };
}
