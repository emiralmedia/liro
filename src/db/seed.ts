/**
 * Seed determinist.
 *
 * Alimentează deopotrivă dezvoltarea, testele de integrare și demo-ul — o
 * singură realitate, ca testele să nu diveargă de la ce vede profesorul.
 * Id-urile sunt fixe: un test poate referi `SEED.students.anna` fără să caute
 * prin bază, iar rularea repetată nu duplică nimic.
 *
 *   pnpm db:seed
 */
// Variabilele de mediu vin din flagul --env-file-if-exists din package.json.
// Nu le încărca aici: în ESM importurile se evaluează înaintea acestui cod,
// deci ./index ar rula fără DATABASE_URL.
import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  assignments,
  exercises,
  homework,
  lessonVersions,
  lessons,
  mediaAssets,
  modules,
  scheduleEvents,
  sections,
  students,
  users,
} from "./schema";

import { SEED } from "./seed-ids";

export { SEED };

/**
 * Ancora temporală este ZIUA CURENTĂ la ora 09:00, nu o dată fixă.
 *
 * O ancoră fixă părea mai reproductibilă, dar îmbătrânea: după câteva luni,
 * „următoarea întâlnire" cădea în trecut și dashboardul arăta gol, deși datele
 * existau. Testele nu depind de date absolute — verifică stări și relații
 * (Dmitri restant, Anna în lucru), care rămân stabile.
 */
const NOW = (() => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
})();
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

async function seed() {
  console.log("Se populează baza...");

  await db
    .insert(users)
    .values([
      {
        id: SEED.teacher,
        name: "Profesor Liro",
        email: "profesor@liro.test",
        role: "teacher",
        locale: "ro",
        emailVerified: NOW,
      },
      {
        id: SEED.users.anna,
        name: "Анна Петрова",
        email: "anna@liro.test",
        role: "student",
        locale: "ru",
        emailVerified: NOW,
      },
      {
        id: SEED.users.dmitri,
        name: "Дмитрий Соколов",
        email: "dmitri@liro.test",
        role: "student",
        locale: "ru",
        emailVerified: NOW,
      },
      {
        id: SEED.users.olga,
        name: "Ольга Иванова",
        email: "olga@liro.test",
        role: "student",
        locale: "ru",
        emailVerified: NOW,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(students)
    .values([
      { id: SEED.students.anna, userId: SEED.users.anna, teacherId: SEED.teacher, currentLevel: "A1" },
      {
        id: SEED.students.dmitri,
        userId: SEED.users.dmitri,
        teacherId: SEED.teacher,
        currentLevel: "A1",
      },
      {
        id: SEED.students.olga,
        userId: SEED.users.olga,
        teacherId: SEED.teacher,
        currentLevel: "A2",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(modules)
    .values({
      id: SEED.module,
      level: "A1",
      slug: "a1-cunostinta",
      titleRo: "Cunoștință",
      titleRu: "Знакомство",
      orderIndex: 1,
    })
    .onConflictDoNothing();

  await db
    .insert(lessons)
    .values({
      id: SEED.lesson,
      moduleId: SEED.module,
      slug: "a1-cunostinta-l1",
      orderIndex: 1,
      currentVersionId: SEED.lessonVersion,
    })
    .onConflictDoNothing();

  await db
    .insert(lessonVersions)
    .values({
      id: SEED.lessonVersion,
      lessonId: SEED.lesson,
      version: 1,
      status: "published",
      titleRo: "Salut! Mă numesc...",
      titleRu: "Привет! Меня зовут...",
      objectives: [
        {
          ro: "Salută și își spune numele",
          ru: "Поздороваться и назвать своё имя",
          competence: "speaking",
        },
        {
          ro: "Întreabă cum se numește interlocutorul",
          ru: "Спросить, как зовут собеседника",
          competence: "speaking",
        },
        {
          ro: "Recunoaște formulele de salut după auz",
          ru: "Узнавать приветствия на слух",
          competence: "listening",
        },
      ],
      estimatedMinutes: 60,
      origin: "human",
      approvedBy: SEED.teacher,
      approvedAt: NOW,
      publishedAt: NOW,
      createdBy: SEED.teacher,
    })
    .onConflictDoNothing();

  // Audio validat lingvistic — fără `validatedAt` nu ar putea fi publicat.
  await db
    .insert(mediaAssets)
    .values({
      id: SEED.audio,
      kind: "audio",
      storageKey: "/media/a1-cunostinta-l1-dialog.m4a",
      durationMs: 13_600,
      transcript:
        "— Bună ziua! Mă numesc Elena. Dumneavoastră cum vă numiți?\n" +
        "— Bună ziua, doamnă Elena. Eu sunt Andrei. Îmi pare bine.\n" +
        "— Și mie îmi pare bine, domnule Andrei.",
      validatedAt: NOW,
      validatedBy: SEED.teacher,
    })
    .onConflictDoNothing();

  await db
    .insert(sections)
    .values([
      {
        id: SEED.sections.theory,
        lessonVersionId: SEED.lessonVersion,
        type: "theory",
        orderIndex: 1,
        titleRu: "Как поздороваться",
        body: {
          ro:
            "În română salutăm diferit în funcție de momentul zilei și de cât de formal " +
            "vorbim. «Bună ziua» este forma politicoasă, potrivită cu oricine. «Salut» " +
            "se folosește doar între prieteni.\n\n" +
            "Ca să ne prezentăm, spunem «Mă numesc...» sau, mai simplu, «Eu sunt...».",
          ru:
            "Обратите внимание: в румынском языке глагол «a se numi» — возвратный, " +
            "поэтому нужна частица «mă»: «Mă numesc Anna». Пропустить её нельзя — " +
            "«numesc Anna» означает совсем другое («я называю Анну»).\n\n" +
            "Личное местоимение «eu» обычно опускается, потому что окончание глагола " +
            "уже указывает на лицо — в отличие от русского, где «я» опустить нельзя.",
        },
      },
      {
        id: SEED.sections.vocab,
        lessonVersionId: SEED.lessonVersion,
        type: "vocab",
        orderIndex: 2,
        titleRu: "Словарь",
        body: {
          vocabulary: [
            { ro: "bună ziua", ru: "здравствуйте", active: true },
            { ro: "salut", ru: "привет", active: true },
            { ro: "mă numesc", ru: "меня зовут", active: true },
            { ro: "îmi pare bine", ru: "приятно познакомиться", active: true },
            { ro: "la revedere", ru: "до свидания", active: true },
            { ro: "domnule / doamnă", ru: "господин / госпожа", active: false },
          ],
          examples: [
            { ro: "Bună ziua! Mă numesc Andrei.", ru: "Здравствуйте! Меня зовут Андрей." },
            {
              ro: "Dumneavoastră cum vă numiți?",
              ru: "Как Вас зовут?",
              note: "Формa вежливого обращения на «Вы»",
            },
          ],
        },
      },
      {
        id: SEED.sections.audio,
        lessonVersionId: SEED.lessonVersion,
        type: "audio",
        orderIndex: 3,
        titleRu: "Диалог",
        body: { ru: "Послушайте диалог два раза, прежде чем открывать текст." },
        mediaAssetId: SEED.audio,
      },
      {
        id: SEED.sections.exercises,
        lessonVersionId: SEED.lessonVersion,
        type: "exercises",
        orderIndex: 4,
        titleRu: "Упражнения",
        body: { ru: "Шесть заданий. Отвечайте по-румынски." },
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(exercises)
    .values([
      {
        id: SEED.exercises.mcq,
        sectionId: SEED.sections.exercises,
        type: "mcq",
        orderIndex: 1,
        prompt: {
          ru: "Как вежливо поздороваться с преподавателем днём?",
          options: [
            { id: "a", text: "Salut!" },
            { id: "b", text: "Bună ziua!" },
            { id: "c", text: "Noapte bună!" },
          ],
        },
        canonicalAnswer: "b",
        acceptedVariants: [],
        points: 1,
        explanationRu:
          "«Salut» — только для друзей, «Noapte bună» говорят на ночь. Вежливая " +
          "дневная форма — «Bună ziua».",
        interferenceTags: ["registru", "formule-salut"],
      },
      {
        id: SEED.exercises.fill,
        sectionId: SEED.sections.exercises,
        type: "fill",
        orderIndex: 2,
        prompt: { ru: "Дополните: «___ numesc Anna.» (меня зовут Анна)" },
        canonicalAnswer: "mă",
        acceptedVariants: ["Mă"],
        points: 1,
        explanationRu:
          "Глагол «a se numi» возвратный: без частицы «mă» фраза меняет смысл.",
        interferenceTags: ["verb-reflexiv", "pronume"],
      },
      {
        id: SEED.exercises.match,
        sectionId: SEED.sections.exercises,
        type: "match",
        orderIndex: 3,
        prompt: {
          ru: "Соедините румынские выражения с русским переводом.",
          pairs: [
            { left: "bună ziua", right: "здравствуйте" },
            { left: "la revedere", right: "до свидания" },
            { left: "îmi pare bine", right: "приятно познакомиться" },
          ],
        },
        canonicalAnswer: {
          "bună ziua": "здравствуйте",
          "la revedere": "до свидания",
          "îmi pare bine": "приятно познакомиться",
        },
        acceptedVariants: [],
        points: 3,
        explanationRu: "Эти три формулы покрывают почти любое короткое знакомство.",
        interferenceTags: ["vocabular"],
      },
      {
        id: SEED.exercises.order,
        sectionId: SEED.sections.exercises,
        type: "order",
        orderIndex: 4,
        prompt: {
          ru: "Составьте предложение из слов.",
          items: ["numesc", "Mă", "Dmitri"],
        },
        canonicalAnswer: ["Mă", "numesc", "Dmitri"],
        acceptedVariants: [],
        points: 1,
        explanationRu:
          "Возвратная частица стоит перед глаголом: «Mă numesc», а не «Numesc mă».",
        interferenceTags: ["ordinea-cuvintelor", "verb-reflexiv"],
      },
      {
        id: SEED.exercises.short,
        sectionId: SEED.sections.exercises,
        type: "short",
        orderIndex: 5,
        prompt: { ru: "Ответьте по-румынски: как Вас зовут?" },
        canonicalAnswer: "Mă numesc",
        acceptedVariants: ["Eu sunt", "Mă numesc."],
        rubric: {
          criteria: [
            { id: "form", description: "Folosește «mă numesc» sau «eu sunt»", weight: 0.6 },
            { id: "name", description: "Include un nume propriu", weight: 0.4 },
          ],
          passThreshold: 0.6,
        },
        points: 2,
        explanationRu:
          "Достаточно «Mă numesc ...» или «Eu sunt ...». Свободные ответы проверяет " +
          "преподаватель.",
        interferenceTags: ["productie-libera"],
      },
      {
        id: SEED.exercises.audioQ,
        sectionId: SEED.sections.exercises,
        type: "audio_q",
        orderIndex: 6,
        prompt: {
          ru: "Прослушайте диалог. Как зовут женщину?",
          options: [
            { id: "a", text: "Elena" },
            { id: "b", text: "Ana" },
            { id: "c", text: "Maria" },
          ],
        },
        canonicalAnswer: "a",
        acceptedVariants: [],
        points: 1,
        explanationRu: "В первой реплике: «Mă numesc Elena».",
        interferenceTags: ["ascultare"],
      },
    ])
    .onConflictDoNothing();

  // A doua lecție a modulului — publicată, dar NEALOCATĂ nimănui. Există ca să
  // se vadă că biblioteca și parcursul individual sunt lucruri diferite:
  // profesorul o poate debloca oricând, dar până atunci nu o vede niciun cursant.
  await db
    .insert(lessons)
    .values({
      id: SEED.lesson2,
      moduleId: SEED.module,
      slug: "a1-cunostinta-l2",
      orderIndex: 2,
      currentVersionId: SEED.lessonVersion2,
    })
    .onConflictDoNothing();

  await db
    .insert(lessonVersions)
    .values({
      id: SEED.lessonVersion2,
      lessonId: SEED.lesson2,
      version: 1,
      status: "published",
      titleRo: "De unde sunteți?",
      titleRu: "Откуда Вы?",
      objectives: [
        { ro: "Spune de unde este", ru: "Сказать, откуда он/она", competence: "speaking" },
        { ro: "Folosește prepoziția «din»", ru: "Использовать предлог «din»", competence: "grammar" },
      ],
      estimatedMinutes: 60,
      origin: "human",
      approvedBy: SEED.teacher,
      approvedAt: NOW,
      publishedAt: NOW,
      createdBy: SEED.teacher,
    })
    .onConflictDoNothing();

  await db
    .insert(sections)
    .values([
      {
        id: SEED.sections2.theory,
        lessonVersionId: SEED.lessonVersion2,
        type: "theory",
        orderIndex: 1,
        titleRu: "Откуда вы?",
        body: {
          ro:
            "Ca să spunem de unde suntem, folosim prepoziția «din»: «Sunt din Chișinău», " +
            "«Sunt din Rusia».\n\n" +
            "Întrebarea politicoasă este «De unde sunteți?», iar între prieteni «De unde ești?».",
          ru:
            "Предлог «din» соответствует русскому «из»: «Sunt din Moscova» — «Я из Москвы». " +
            "Важное отличие: в румынском после «din» название города или страны НЕ меняется — " +
            "нет падежей, форма всегда одна.",
        },
      },
      {
        id: SEED.sections2.exercises,
        lessonVersionId: SEED.lessonVersion2,
        type: "exercises",
        orderIndex: 2,
        titleRu: "Упражнения",
        body: { ru: "Три задания." },
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(exercises)
    .values([
      {
        id: SEED.exercises2.fill,
        sectionId: SEED.sections2.exercises,
        type: "fill",
        orderIndex: 1,
        prompt: { ru: "Дополните: «Sunt ___ Moscova.» (я из Москвы)" },
        canonicalAnswer: "din",
        acceptedVariants: [],
        points: 1,
        explanationRu: "«din» = «из». После него название города не меняется.",
        interferenceTags: ["prepozitii"],
      },
      {
        id: SEED.exercises2.mcq,
        sectionId: SEED.sections2.exercises,
        type: "mcq",
        orderIndex: 2,
        prompt: {
          ru: "Как вежливо спросить, откуда человек?",
          options: [
            { id: "a", text: "De unde ești?" },
            { id: "b", text: "De unde sunteți?" },
            { id: "c", text: "Unde mergi?" },
          ],
        },
        canonicalAnswer: "b",
        acceptedVariants: [],
        points: 1,
        explanationRu: "Вежливая форма — на «Вы»: «sunteți».",
        interferenceTags: ["registru"],
      },
      {
        id: SEED.exercises2.order,
        sectionId: SEED.sections2.exercises,
        type: "order",
        orderIndex: 3,
        prompt: { ru: "Составьте предложение.", items: ["din", "Sunt", "Chișinău"] },
        canonicalAnswer: ["Sunt", "din", "Chișinău"],
        acceptedVariants: [],
        points: 1,
        explanationRu: "Порядок: подлежащее опускается, глагол — первым.",
        interferenceTags: ["ordinea-cuvintelor"],
      },
    ])
    .onConflictDoNothing();

  // Anna: lecție deblocată, temă în lucru, cu termen în viitor.
  await db
    .insert(assignments)
    .values([
      {
        id: SEED.assignments.annaLesson1,
        studentId: SEED.students.anna,
        lessonVersionId: SEED.lessonVersion,
        state: "in_progress",
        unlockedAt: daysFromNow(-2),
        unlockedBy: SEED.teacher,
        orderIndex: 1,
      },
      // Dmitri: aceeași lecție, dar cu tema restantă — pentru testul de reportare.
      {
        id: SEED.assignments.dmitriLesson1,
        studentId: SEED.students.dmitri,
        lessonVersionId: SEED.lessonVersion,
        state: "unlocked",
        unlockedAt: daysFromNow(-9),
        unlockedBy: SEED.teacher,
        orderIndex: 1,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(homework)
    .values([
      {
        id: SEED.homework.anna,
        assignmentId: SEED.assignments.annaLesson1,
        state: "in_progress",
        dueAt: daysFromNow(3),
      },
      {
        id: SEED.homework.dmitri,
        assignmentId: SEED.assignments.dmitriLesson1,
        state: "overdue",
        dueAt: daysFromNow(-2),
      },
    ])
    .onConflictDoUpdate({
      target: homework.id,
      set: { dueAt: sql`excluded.due_at`, state: sql`excluded.state` },
    });

  await db
    .insert(scheduleEvents)
    .values([
      {
        id: SEED.schedule.anna,
        studentId: SEED.students.anna,
        startsAt: daysFromNow(1),
        durationMinutes: 60,
        meetUrl: "https://meet.google.com/seed-anna",
      },
      {
        id: SEED.schedule.dmitri,
        studentId: SEED.students.dmitri,
        startsAt: daysFromNow(2),
        durationMinutes: 60,
        meetUrl: "https://meet.google.com/seed-dmitri",
      },
    ])
    .onConflictDoUpdate({
      target: scheduleEvents.id,
      set: { startsAt: sql`excluded.starts_at` },
    });

  console.log("Gata: 1 profesor, 3 cursanți, 1 modul A1, 2 lecții publicate, 9 exerciții.");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed eșuat:", error);
    process.exit(1);
  });
