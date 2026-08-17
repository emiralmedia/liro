import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* ------------------------------------------------------------------ *
 * Enumerări de domeniu
 * ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", ["teacher", "student", "admin"]);
export const cefrLevel = pgEnum("cefr_level", ["A1", "A2", "B1"]);
export const lessonStatus = pgEnum("lesson_status", ["draft", "in_review", "published", "archived"]);
export const sectionType = pgEnum("section_type", [
  "theory",
  "vocab",
  "examples",
  "audio",
  "exercises",
  "review",
]);
export const exerciseType = pgEnum("exercise_type", [
  "mcq", // alegere multiplă
  "fill", // completare
  "match", // asociere
  "order", // ordonare
  "short", // răspuns scurt
  "audio_q", // întrebare după audio
]);
export const assignmentState = pgEnum("assignment_state", [
  "locked",
  "unlocked",
  "in_progress",
  "completed",
]);
export const homeworkState = pgEnum("homework_state", [
  "not_started",
  "in_progress",
  "submitted",
  "graded",
  "overdue",
]);
export const contentOrigin = pgEnum("content_origin", ["human", "ai_generated", "ai_assisted"]);

/* ------------------------------------------------------------------ *
 * Auth.js v5 — tabele cerute de @auth/drizzle-adapter
 * ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),

  // Extensii proprii
  role: userRole("role").notNull().default("student"),
  /** Limba interfeței: profesorul lucrează în `ro`, cursantul în `ru`. */
  locale: varchar("locale", { length: 5 }).notNull().default("ru"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ------------------------------------------------------------------ *
 * Cursanți
 * ------------------------------------------------------------------ */

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Profesorul alocat. Autorizarea profesorului se face exclusiv prin acest câmp. */
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    currentLevel: cefrLevel("current_level").notNull().default("A1"),
    notes: text("notes"),
    /**
     * Consimțământul tutorelui pentru minori. Blocant înainte de lansare
     * (brief §10): fără el, contul nu poate fi activat pentru un minor.
     */
    isMinor: boolean("is_minor").notNull().default(false),
    consentGuardianAt: timestamp("consent_guardian_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("students_teacher_idx").on(t.teacherId)],
);

/* ------------------------------------------------------------------ *
 * Curriculum: nivel → modul → lecție → versiune → secțiune → exercițiu
 * ------------------------------------------------------------------ */

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: cefrLevel("level").notNull(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    titleRo: text("title_ro").notNull(),
    titleRu: text("title_ru").notNull(),
    /** Traseu recomandat: până la ~5 lecții de 60 min (brief §4). Nu e rigid. */
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("modules_level_order_uq").on(t.level, t.orderIndex)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    orderIndex: integer("order_index").notNull(),
    /** Versiunea publicată curentă. NULL = lecția nu a fost publicată niciodată. */
    currentVersionId: uuid("current_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("lessons_module_order_uq").on(t.moduleId, t.orderIndex)],
);

/**
 * INVARIANT 1 — versionare imuabilă.
 * O versiune publicată nu se mai modifică. Orice editare creează o versiune
 * nouă, astfel încât rezultatele deja parcurse de un cursant rămân legate de
 * conținutul pe care l-a văzut efectiv (brief §4).
 */
export const lessonVersions = pgTable(
  "lesson_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: lessonStatus("status").notNull().default("draft"),
    titleRo: text("title_ro").notNull(),
    titleRu: text("title_ru").notNull(),
    /** Obiective măsurabile, în ambele limbi. */
    objectives: jsonb("objectives").$type<LessonObjective[]>().notNull().default([]),
    estimatedMinutes: integer("estimated_minutes").notNull().default(60),
    origin: contentOrigin("origin").notNull().default("human"),
    /** Gate editorial: fără aprobare umană, o versiune nu poate fi publicată. */
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("lesson_versions_lesson_version_uq").on(t.lessonId, t.version)],
);

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonVersionId: uuid("lesson_version_id")
      .notNull()
      .references(() => lessonVersions.id, { onDelete: "cascade" }),
    type: sectionType("type").notNull(),
    orderIndex: integer("order_index").notNull(),
    titleRu: text("title_ru"),
    /** Corpul secțiunii: teorie ro + sprijin ru, vocabular, exemple contextuale. */
    body: jsonb("body").$type<SectionBody>().notNull(),
    mediaAssetId: uuid("media_asset_id"),
  },
  (t) => [unique("sections_version_order_uq").on(t.lessonVersionId, t.orderIndex)],
);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    type: exerciseType("type").notNull(),
    orderIndex: integer("order_index").notNull(),
    prompt: jsonb("prompt").$type<ExercisePrompt>().notNull(),
    /** Răspunsul canonic, în forma normalizată de motorul de corectare. */
    canonicalAnswer: jsonb("canonical_answer").notNull(),
    /** Formulări alternative acceptate — profesorul le poate extinde oricând. */
    acceptedVariants: jsonb("accepted_variants").$type<string[]>().notNull().default([]),
    /** Barem pentru răspunsuri libere; folosit de agentul de corectare semantică. */
    rubric: jsonb("rubric").$type<ExerciseRubric | null>(),
    points: real("points").notNull().default(1),
    /** Explicație afișată cursantului după răspuns — obligatoriu în rusă. */
    explanationRu: text("explanation_ru"),
    /** Dificultatea tipică pentru rusofoni: articol, gen, prepoziții, ordine etc. */
    interferenceTags: jsonb("interference_tags").$type<string[]>().notNull().default([]),
  },
  (t) => [unique("exercises_section_order_uq").on(t.sectionId, t.orderIndex)],
);

/* ------------------------------------------------------------------ *
 * Media
 * ------------------------------------------------------------------ */

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: varchar("kind", { length: 32 }).notNull().default("audio"),
  storageKey: text("storage_key").notNull(),
  durationMs: integer("duration_ms"),
  /** Transcrierea e ascunsă implicit în UI, ca să nu compromită listening-ul. */
  transcript: text("transcript"),
  /**
   * Validare pedagogică și lingvistică obligatorie înainte de publicare
   * (brief §5). Un asset cu validatedAt NULL nu poate ajunge la cursant.
   */
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  validatedBy: uuid("validated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 * Parcurs individual
 * ------------------------------------------------------------------ */

/**
 * INVARIANT 2 — blocat implicit.
 * Cursantul nu are acces la `lessons`/`lesson_versions` decât prin această
 * tabelă. Orice interogare din spațiul cursantului pornește de aici.
 */
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** Se leagă de VERSIUNE, nu de lecție — vezi invariantul 1. */
    lessonVersionId: uuid("lesson_version_id")
      .notNull()
      .references(() => lessonVersions.id, { onDelete: "restrict" }),
    state: assignmentState("state").notNull().default("unlocked"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    unlockedBy: uuid("unlocked_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [
    unique("assignments_student_version_uq").on(t.studentId, t.lessonVersionId),
    index("assignments_student_idx").on(t.studentId),
  ],
);

export const homework = pgTable(
  "homework",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    state: homeworkState("state").notNull().default("not_started"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    /**
     * Restanță reportată: dacă tema nu e predată la termen devine `overdue` și
     * se reportează la lecția următoare, rămânând prioritară (brief §5).
     */
    carriedOverFrom: uuid("carried_over_from"),
    isOptional: boolean("is_optional").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("homework_state_due_idx").on(t.state, t.dueAt)],
);

/**
 * INVARIANT 3 — profesorul are ultimul cuvânt.
 * `autoScore` este o recomandare. Orice calcul de progres folosește
 * COALESCE(teacher_score, auto_score); vezi src/lib/grading/score.ts.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    answer: jsonb("answer").notNull(),
    autoScore: real("auto_score"),
    /** 0..1. Sub prag, atempt-ul intră în coada de revizuire a profesorului. */
    autoConfidence: real("auto_confidence"),
    teacherScore: real("teacher_score"),
    teacherFeedback: text("teacher_feedback"),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("attempts_student_idx").on(t.studentId),
    index("attempts_review_queue_idx").on(t.needsReview, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Progres și programare
 * ------------------------------------------------------------------ */

export const progressSnapshots = pgTable(
  "progress_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    metrics: jsonb("metrics").$type<ProgressMetrics>().notNull(),
    /** Rezumat generat de agentul de progres; sprijin, nu decizie. */
    aiSummaryRu: text("ai_summary_ru"),
  },
  (t) => [index("progress_student_time_idx").on(t.studentId, t.computedAt)],
);

export const scheduleEvents = pgTable(
  "schedule_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    meetUrl: text("meet_url"),
    rescheduleRequestedAt: timestamp("reschedule_requested_at", { withTimezone: true }),
    rescheduleRequestedFor: timestamp("reschedule_requested_for", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
  },
  (t) => [index("schedule_student_start_idx").on(t.studentId, t.startsAt)],
);

/* ------------------------------------------------------------------ *
 * Audit și telemetrie AI
 * ------------------------------------------------------------------ */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    entity: varchar("entity", { length: 64 }).notNull(),
    entityId: uuid("entity_id"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId, t.createdAt)],
);

export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent: varchar("agent", { length: 64 }).notNull(),
    model: varchar("model", { length: 64 }).notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),
    entity: varchar("entity", { length: 64 }),
    entityId: uuid("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_time_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ *
 * Tipuri pentru coloanele jsonb
 * ------------------------------------------------------------------ */

export type LessonObjective = {
  ro: string;
  ru: string;
  competence: "listening" | "speaking" | "reading" | "writing" | "grammar" | "vocabulary";
};

export type SectionBody = {
  /** Teoria se predă în română, cu explicații de sprijin în rusă. */
  ro?: string;
  ru?: string;
  vocabulary?: Array<{ ro: string; ru: string; active: boolean }>;
  examples?: Array<{ ro: string; ru: string; note?: string }>;
};

export type ExercisePrompt = {
  ru: string;
  ro?: string;
  options?: Array<{ id: string; text: string }>;
  pairs?: Array<{ left: string; right: string }>;
  items?: string[];
};

export type ExerciseRubric = {
  criteria: Array<{ id: string; description: string; weight: number }>;
  passThreshold: number;
};

export type ProgressMetrics = {
  lessonsCompleted: number;
  homeworkCompletionRate: number;
  averageScore: number;
  overdueCount: number;
  totalTimeMs: number;
  recurringErrorTags: string[];
};
