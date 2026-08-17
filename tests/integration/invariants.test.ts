/**
 * Invarianții verificați pe o bază Postgres reală.
 *
 * Deliberat fără mock-uri: un test care simulează stratul de date nu dovedește
 * izolarea cursanților, fiindcă exact acolo apar scurgerile — în forma
 * interogării, nu în logica de deasupra ei.
 *
 * Cerințe: baza locală pornită (`pnpm db:local start`), migrată și populată
 * (`pnpm db:migrate && pnpm db:seed`).
 */
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { SEED } from "@/db/seed-ids";
import {
  assignments,
  attempts,
  exercises,
  homework,
  lessonVersions,
  sections,
  students,
} from "@/db/schema";

/** Id de versiune creată de teste; se șterge la final. */
const V2_ID = "00000000-0000-4000-8000-0000000000f1";

beforeAll(async () => {
  const seeded = await db.select().from(students).where(eq(students.id, SEED.students.anna));
  if (seeded.length === 0) {
    throw new Error("Baza nu e populată. Rulează: pnpm db:migrate && pnpm db:seed");
  }

  // Testele își stabilesc singure precondițiile pe stările pe care le verifică.
  // Baza e comună cu suita E2E, care lasă tema Annei „trimisă" — a te baza pe
  // ce a lăsat altcineva în urmă înseamnă eșecuri care depind de ordinea rulării.
  await db
    .update(homework)
    .set({ state: "in_progress", submittedAt: null })
    .where(eq(homework.id, SEED.homework.anna));
  await db
    .update(homework)
    .set({ state: "overdue" })
    .where(eq(homework.id, SEED.homework.dmitri));
});

afterAll(async () => {
  await db.delete(attempts).where(eq(attempts.assignmentId, SEED.assignments.annaLesson1));
  await db.delete(lessonVersions).where(eq(lessonVersions.id, V2_ID));
});

describe("izolarea cursanților la nivel de interogare", () => {
  it("profesorul alocat își vede toți cursanții", async () => {
    const rows = await db.select().from(students).where(eq(students.teacherId, SEED.teacher));
    expect(rows).toHaveLength(3);
  });

  it("un profesor nealocat nu primește niciun rând", async () => {
    const strain = "00000000-0000-4000-8000-0000000000ff";
    const rows = await db.select().from(students).where(eq(students.teacherId, strain));
    expect(rows).toHaveLength(0);
  });

  it("interogarea unui cursant cu id-ul altuia nu întoarce date", async () => {
    // Tiparul IDOR: id primit de la client, filtrat suplimentar după proprietar.
    const rows = await db
      .select()
      .from(students)
      .where(and(eq(students.id, SEED.students.olga), eq(students.userId, SEED.users.anna)));
    expect(rows).toHaveLength(0);
  });
});

describe("invariantul 2 — conținutul e blocat implicit", () => {
  it("cursantul ajunge la versiuni de lecție exclusiv prin assignments", async () => {
    const reachable = await db
      .select({ versionId: assignments.lessonVersionId })
      .from(assignments)
      .where(eq(assignments.studentId, SEED.students.anna));

    expect(reachable.map((r) => r.versionId)).toEqual([SEED.lessonVersion]);
  });

  it("Olga nu are nicio alocare, deci nu ajunge la niciun conținut", async () => {
    const rows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.studentId, SEED.students.olga));
    expect(rows).toHaveLength(0);
  });

  it("există lecții publicate la care un cursant fără alocare NU are acces", async () => {
    // Dovedește că „blocat implicit" e o restricție reală, nu o consecință a
    // faptului că baza ar conține doar conținut alocat.
    const published = await db
      .select()
      .from(lessonVersions)
      .where(eq(lessonVersions.status, "published"));
    expect(published.length).toBeGreaterThan(0);

    const olgaAssignments = await db
      .select()
      .from(assignments)
      .where(eq(assignments.studentId, SEED.students.olga));
    expect(olgaAssignments).toHaveLength(0);
  });
});

describe("invariantul 1 — versionare imuabilă", () => {
  it("publicarea unei versiuni noi nu mută alocarea existentă", async () => {
    const before = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, SEED.assignments.annaLesson1));
    expect(before[0]?.lessonVersionId).toBe(SEED.lessonVersion);

    // Profesorul editează lecția: apare versiunea 2, publicată.
    await db.insert(lessonVersions).values({
      id: V2_ID,
      lessonId: SEED.lesson,
      version: 2,
      status: "published",
      titleRo: "Salut! Mă numesc... (revizuit)",
      titleRu: "Привет! Меня зовут... (ревизия)",
      objectives: [],
      origin: "human",
      approvedBy: SEED.teacher,
      approvedAt: new Date(),
      publishedAt: new Date(),
      createdBy: SEED.teacher,
    });

    const after = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, SEED.assignments.annaLesson1));

    // Anna rămâne pe versiunea pe care a parcurs-o efectiv.
    expect(after[0]?.lessonVersionId).toBe(SEED.lessonVersion);
    expect(after[0]?.lessonVersionId).not.toBe(V2_ID);
  });

  it("o versiune referită de o alocare nu poate fi ștearsă", async () => {
    // onDelete: "restrict" pe assignments.lessonVersionId — protecția e în
    // schemă, nu doar în codul aplicației.
    await expect(
      db.delete(lessonVersions).where(eq(lessonVersions.id, SEED.lessonVersion)),
    ).rejects.toThrow();
  });
});

describe("invariantul 3 — profesorul are ultimul cuvânt", () => {
  it("scorul profesorului se păstrează separat de cel automat", async () => {
    // `returning()` ne dă exact rândul inserat. O interogare după alocare ar
    // putea nimeri altă încercare — testele E2E lasă șase în aceeași alocare.
    const [pending] = await db
      .insert(attempts)
      .values({
        studentId: SEED.students.anna,
        assignmentId: SEED.assignments.annaLesson1,
        exerciseId: SEED.exercises.short,
        answer: { text: "Numele meu este Anna" },
        autoScore: 0,
        autoConfidence: 0.3,
        needsReview: true,
      })
      .returning();

    expect(pending?.needsReview).toBe(true);
    expect(pending?.teacherScore).toBeNull();

    // Profesorul revizuiește și acordă punctajul întreg.
    await db
      .update(attempts)
      .set({
        teacherScore: 2,
        teacherFeedback: "Formulare corectă, acceptată.",
        needsReview: false,
        reviewedBy: SEED.teacher,
        reviewedAt: new Date(),
      })
      .where(eq(attempts.id, pending!.id));

    const [reviewed] = await db.select().from(attempts).where(eq(attempts.id, pending!.id));

    // Scorul automat rămâne vizibil pentru audit; cel al profesorului decide.
    expect(reviewed?.autoScore).toBe(0);
    expect(reviewed?.teacherScore).toBe(2);
    expect(reviewed?.needsReview).toBe(false);
  });
});

describe("restanțe", () => {
  it("tema lui Dmitri e restantă, a Annei nu", async () => {
    const rows = await db
      .select({ id: homework.id, state: homework.state })
      .from(homework)
      .where(inArray(homework.id, [SEED.homework.anna, SEED.homework.dmitri]));

    const byId = Object.fromEntries(rows.map((r) => [r.id, r.state]));
    expect(byId[SEED.homework.dmitri]).toBe("overdue");
    expect(byId[SEED.homework.anna]).toBe("in_progress");
  });
});

describe("integritatea conținutului semănat", () => {
  it("lecția are toate cele 6 tipuri de exerciții", async () => {
    const rows = await db
      .select({ type: exercises.type })
      .from(exercises)
      .innerJoin(sections, eq(exercises.sectionId, sections.id))
      .where(eq(sections.lessonVersionId, SEED.lessonVersion));

    expect(new Set(rows.map((r) => r.type))).toEqual(
      new Set(["mcq", "fill", "match", "order", "short", "audio_q"]),
    );
  });
});
