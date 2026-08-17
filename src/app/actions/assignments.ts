"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { assignments, auditLog, homework, lessonVersions, students } from "@/db/schema";
import { ForbiddenError, canManageStudent } from "@/lib/authz";
import { getActor } from "@/lib/session";

/**
 * Deblocarea unei lecții pentru un cursant — acțiunea centrală a profesorului
 * (brief §5): lecțiile sunt blocate implicit, iar el alege ce se activează și
 * când.
 */
export async function unlockLesson(
  studentId: string,
  lessonVersionId: string,
  dueInDays: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await getActor();

    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    if (!student) return { ok: false, error: "Cursantul nu există" };

    if (!canManageStudent(actor, student)) {
      throw new ForbiddenError("Nu poți modifica parcursul acestui cursant");
    }

    // Se deblochează doar versiuni publicate. Un draft ajuns la cursant ar
    // încălca gate-ul editorial din brief §9.
    const [version] = await db
      .select()
      .from(lessonVersions)
      .where(and(eq(lessonVersions.id, lessonVersionId), eq(lessonVersions.status, "published")));
    if (!version) return { ok: false, error: "Lecția nu este publicată" };

    const existing = await db
      .select()
      .from(assignments)
      .where(
        and(eq(assignments.studentId, studentId), eq(assignments.lessonVersionId, lessonVersionId)),
      );
    if (existing.length > 0) return { ok: false, error: "Lecția este deja deblocată" };

    const count = await db.select().from(assignments).where(eq(assignments.studentId, studentId));

    const [created] = await db
      .insert(assignments)
      .values({
        studentId,
        lessonVersionId,
        state: "unlocked",
        unlockedBy: actor!.userId,
        orderIndex: count.length + 1,
      })
      .returning();

    await db.insert(homework).values({
      assignmentId: created!.id,
      state: "not_started",
      dueAt: new Date(Date.now() + dueInDays * 86_400_000),
    });

    await db.insert(auditLog).values({
      actorId: actor!.userId,
      action: "assignment.unlocked",
      entity: "assignment",
      entityId: created!.id,
      payload: { studentId, lessonVersionId, dueInDays },
    });

    revalidatePath(`/profesor/cursant/${studentId}`);
    revalidatePath("/profesor");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("unlockLesson:", error);
    return { ok: false, error: "Deblocarea a eșuat" };
  }
}

/** Mută termenul unei teme — profesorul poate accepta o întârziere (brief §5). */
export async function changeDueDate(
  assignmentId: string,
  dueInDays: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await getActor();

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId));
    if (!assignment) return { ok: false, error: "Alocarea nu există" };

    const [student] = await db.select().from(students).where(eq(students.id, assignment.studentId));
    if (!student || !canManageStudent(actor, student)) {
      throw new ForbiddenError("Nu poți modifica parcursul acestui cursant");
    }

    const dueAt = new Date(Date.now() + dueInDays * 86_400_000);

    // Termenul mutat în viitor scoate tema din starea „restantă".
    const [current] = await db
      .select()
      .from(homework)
      .where(eq(homework.assignmentId, assignmentId));

    await db
      .update(homework)
      .set({
        dueAt,
        state: current?.state === "overdue" ? "in_progress" : current?.state,
      })
      .where(eq(homework.assignmentId, assignmentId));

    await db.insert(auditLog).values({
      actorId: actor!.userId,
      action: "homework.due_changed",
      entity: "assignment",
      entityId: assignmentId,
      payload: { dueInDays },
    });

    revalidatePath(`/profesor/cursant/${assignment.studentId}`);
    revalidatePath("/profesor");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("changeDueDate:", error);
    return { ok: false, error: "Modificarea a eșuat" };
  }
}
