"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, auditLog, students } from "@/db/schema";
import { ForbiddenError, canOverrideGrade } from "@/lib/authz";
import { getActor } from "@/lib/session";

/**
 * Profesorul suprascrie verdictul automat. Invariantul 3: decizia lui e finală,
 * iar `autoScore` rămâne neatins, pentru audit — vrem să putem vedea ulterior
 * cât de des greșește corectarea automată și pe ce tipuri de exerciții.
 */
export async function reviewAttempt(
  attemptId: string,
  teacherScore: number,
  feedback: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await getActor();

    const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    if (!attempt) return { ok: false, error: "Încercarea nu există" };

    const [student] = await db.select().from(students).where(eq(students.id, attempt.studentId));
    if (!student) return { ok: false, error: "Cursantul nu există" };

    if (!canOverrideGrade(actor, student)) {
      throw new ForbiddenError("Nu poți corecta acest cursant");
    }

    await db
      .update(attempts)
      .set({
        teacherScore,
        teacherFeedback: feedback.trim() === "" ? null : feedback.trim(),
        needsReview: false,
        reviewedBy: actor!.userId,
        reviewedAt: new Date(),
      })
      .where(eq(attempts.id, attemptId));

    await db.insert(auditLog).values({
      actorId: actor!.userId,
      action: "attempt.reviewed",
      entity: "attempt",
      entityId: attemptId,
      payload: { autoScore: attempt.autoScore, teacherScore },
    });

    // Deliberat FĂRĂ revalidatePath. Orice revalidare într-o acțiune de server
    // reîmprospătează și ruta curentă, nu doar calea numită: lista s-ar re-randa
    // fără cazul tocmai corectat, iar cardul ar dispărea înainte să confirme
    // ce s-a salvat. Ambele pagini de profesor sunt dinamice, deci se reîncarcă
    // oricum la următoarea navigare.
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("reviewAttempt:", error);
    return { ok: false, error: "Salvarea a eșuat" };
  }
}
