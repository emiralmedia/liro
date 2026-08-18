import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { LivePresenter, type Slide } from "@/components/teacher/LivePresenter";
import { db } from "@/db";
import {
  assignments,
  exercises,
  lessonVersions,
  mediaAssets,
  sections,
  students,
  users,
} from "@/db/schema";
import type { ExercisePrompt, SectionBody } from "@/db/schema";
import { assertCanAccessStudent, assertRole } from "@/lib/authz";
import { getActor } from "@/lib/session";

/**
 * Modul de predare live (brief §6, pasul 2): profesorul parcurge lecția cu
 * cursantul, pe ecran partajat.
 *
 * Conținutul e cel alocat efectiv cursantului — aceeași versiune pe care o va
 * parcurge singur după lecție, nu ultima publicată. Altfel ar preda ceva ce
 * cursantul nu regăsește în temă.
 */
export default async function PresentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const actor = await getActor();
  assertRole(actor, "teacher", "admin");

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId));
  if (!assignment) notFound();

  const [student] = await db
    .select({
      id: students.id,
      userId: students.userId,
      teacherId: students.teacherId,
      name: users.name,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .where(eq(students.id, assignment.studentId));
  if (!student) notFound();

  // Un profesor nealocat nu predă acestui cursant, chiar dacă are id-ul.
  assertCanAccessStudent(actor, student);

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
      prompt: exercises.prompt,
      canonicalAnswer: exercises.canonicalAnswer,
      explanationRu: exercises.explanationRu,
      orderIndex: exercises.orderIndex,
    })
    .from(exercises)
    .innerJoin(sections, eq(exercises.sectionId, sections.id))
    .where(eq(sections.lessonVersionId, version.id))
    .orderBy(asc(exercises.orderIndex));

  const audioSection = lessonSections.find((s) => s.type === "audio");
  const audio = audioSection?.mediaAssetId
    ? (await db.select().from(mediaAssets).where(eq(mediaAssets.id, audioSection.mediaAssetId)))[0]
    : undefined;

  /** Un pas per bucată de conținut: la proiector, un ecran = o idee. */
  const slides: Slide[] = [
    {
      kind: "title",
      titleRo: version.titleRo,
      titleRu: version.titleRu,
      objectives: version.objectives.map((o) => o.ro),
    },
  ];

  for (const section of lessonSections) {
    const body = section.body as SectionBody;
    const heading = section.titleRu ?? section.type;

    if (section.type === "theory") {
      slides.push({ kind: "theory", heading, ro: body.ro ?? null, ru: body.ru ?? null });
    }
    if (section.type === "vocab") {
      if (body.vocabulary?.length) {
        slides.push({
          kind: "vocab",
          heading,
          items: body.vocabulary.map((v) => ({ ro: v.ro, ru: v.ru })),
        });
      }
      if (body.examples?.length) {
        slides.push({
          kind: "examples",
          heading: "Exemple",
          items: body.examples.map((e) => ({ ro: e.ro, ru: e.ru })),
        });
      }
    }
    if (section.type === "audio" && audio) {
      slides.push({
        kind: "audio",
        heading,
        src: audio.storageKey,
        transcript: audio.transcript,
      });
    }
  }

  exerciseRows.forEach((e, i) => {
    const prompt = e.prompt as ExercisePrompt;
    const answer =
      typeof e.canonicalAnswer === "string"
        ? // La alegere multiplă, răspunsul stocat e id-ul opțiunii; la proiector
          // trebuie arătat textul, nu litera.
          (prompt.options?.find((o) => o.id === e.canonicalAnswer)?.text ?? e.canonicalAnswer)
        : Array.isArray(e.canonicalAnswer)
          ? (e.canonicalAnswer as string[]).join(" ")
          : Object.entries(e.canonicalAnswer as Record<string, string>)
              .map(([k, v]) => `${k} → ${v}`)
              .join(" · ");

    slides.push({
      kind: "exercise",
      index: i + 1,
      total: exerciseRows.length,
      promptRu: prompt.ru,
      options: prompt.options?.map((o) => o.text) ?? [],
      answer,
      explanationRu: e.explanationRu,
    });
  });

  return (
    <LivePresenter
      slides={slides}
      studentName={student.name ?? "Cursant"}
      exitHref={`/profesor/cursant/${student.id}`}
    />
  );
}
