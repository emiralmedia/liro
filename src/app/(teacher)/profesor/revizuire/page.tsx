import { and, asc, eq } from "drizzle-orm";
import { ReviewCard, type PendingAttempt } from "@/components/teacher/ReviewCard";
import { EmptyState, PageHeading } from "@/components/ui";
import { db } from "@/db";
import { attempts, exercises, students, users } from "@/db/schema";
import type { ExercisePrompt } from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { exerciseTypeRo } from "@/lib/labels";
import { getActor } from "@/lib/session";

/**
 * Coada de revizuire (brief §5): profesorul se uită DOAR la excepții — ce n-a
 * putut decide corectarea automată — nu la fiecare răspuns.
 */
export default async function ReviewQueue() {
  const actor = await getActor();
  assertRole(actor, "teacher", "admin");

  const rows = await db
    .select({
      id: attempts.id,
      answer: attempts.answer,
      autoScore: attempts.autoScore,
      autoConfidence: attempts.autoConfidence,
      studentName: users.name,
      prompt: exercises.prompt,
      exerciseType: exercises.type,
      canonicalAnswer: exercises.canonicalAnswer,
      points: exercises.points,
    })
    .from(attempts)
    .innerJoin(students, eq(attempts.studentId, students.id))
    .innerJoin(users, eq(students.userId, users.id))
    .innerJoin(exercises, eq(attempts.exerciseId, exercises.id))
    .where(and(eq(students.teacherId, actor.userId), eq(attempts.needsReview, true)))
    .orderBy(asc(attempts.createdAt));

  const pending: PendingAttempt[] = rows.map((r) => {
    const answer = r.answer as unknown;
    return {
      id: r.id,
      studentName: r.studentName,
      promptRu: (r.prompt as ExercisePrompt).ru,
      exerciseType: exerciseTypeRo[r.exerciseType] ?? r.exerciseType,
      answer: typeof answer === "string" ? answer : JSON.stringify(answer),
      canonicalAnswer:
        typeof r.canonicalAnswer === "string"
          ? r.canonicalAnswer
          : JSON.stringify(r.canonicalAnswer),
      points: Math.round(r.points),
      autoScore: r.autoScore,
      autoConfidence: r.autoConfidence,
    };
  });

  return (
    <>
      <a href="/profesor" className="inline-flex min-h-11 items-center text-sm text-accent">
        ← Astăzi
      </a>

      <PageHeading
        title="De revizuit"
        subtitle={
          pending.length === 0
            ? "Nimic în așteptare"
            : `${pending.length} răspunsuri pe care corectarea automată nu le-a putut decide`
        }
      />

      {pending.length === 0 ? (
        <div className="mt-8">
          <EmptyState>
            Corectarea automată a rezolvat tot. Revino după ce cursanții trimit teme noi.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {pending.map((a) => (
            <ReviewCard key={a.id} attempt={a} />
          ))}
        </ul>
      )}
    </>
  );
}
