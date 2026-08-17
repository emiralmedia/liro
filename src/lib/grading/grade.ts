import { compareAnswers, normalizeAnswer } from "./normalize";

/**
 * Corectare automată deterministă pentru cele 6 tipuri de exerciții din MVP.
 *
 * Contract, direct din brief §5:
 *   - fiecare exercițiu primește întâi un verdict automat;
 *   - verdictul automat este o RECOMANDARE, nu o sentință;
 *   - răspunsurile libere sau ambigue sunt trimise spre revizuire, nu decise;
 *   - profesorul poate suprascrie orice, iar decizia lui e finală.
 *
 * Corectarea semantică asistată de AI (agentul din etapa 4) intervine DOAR pe
 * `short`, și doar ca a doua opinie peste rezultatul de aici.
 */

export type ExerciseType = "mcq" | "fill" | "match" | "order" | "short" | "audio_q";

export type GradableExercise = {
  type: ExerciseType;
  canonicalAnswer: unknown;
  acceptedVariants: string[];
  points: number;
};

export type GradeResult = {
  /** 0..points */
  score: number;
  /** 0..1 — cât de sigur e verdictul automat. */
  confidence: number;
  /** true ⇒ intră în coada de revizuire a profesorului. */
  needsReview: boolean;
  /** Etichetă scurtă pentru feedback și telemetrie. */
  verdict: "correct" | "correct_no_diacritics" | "partial" | "incorrect" | "undecided";
};

/**
 * Punctaj acordat când răspunsul e corect ca formă, dar scris fără diacritice.
 * Nu e zero (cursantul știe răspunsul) și nu e maxim (diacriticele contează).
 */
export const NO_DIACRITICS_CREDIT = 0.5;

/** Sub acest prag de încredere, verdictul automat merge la profesor. */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.75;

export function gradeAttempt(exercise: GradableExercise, answer: unknown): GradeResult {
  switch (exercise.type) {
    case "mcq":
    case "audio_q":
      return gradeChoice(exercise, answer);
    case "fill":
      return gradeText(exercise, answer);
    case "match":
      return gradeMatch(exercise, answer);
    case "order":
      return gradeOrder(exercise, answer);
    case "short":
      return gradeShort(exercise, answer);
  }
}

/* ------------------------------------------------------------------ */

/** Alegere multiplă și întrebări după audio: id-ul opțiunii, comparat exact. */
function gradeChoice(exercise: GradableExercise, answer: unknown): GradeResult {
  const expected = String(exercise.canonicalAnswer);
  const given = typeof answer === "string" ? answer : String(answer ?? "");
  const correct = given.trim() === expected.trim();
  return {
    score: correct ? exercise.points : 0,
    confidence: 1,
    needsReview: false,
    verdict: correct ? "correct" : "incorrect",
  };
}

/** Completare: text scurt, cu variante acceptate și toleranță la diacritice. */
function gradeText(exercise: GradableExercise, answer: unknown): GradeResult {
  const given = typeof answer === "string" ? answer : "";
  if (given.trim() === "") {
    return { score: 0, confidence: 1, needsReview: false, verdict: "incorrect" };
  }

  const candidates = [String(exercise.canonicalAnswer), ...exercise.acceptedVariants];

  let bestWithoutDiacritics = false;
  for (const candidate of candidates) {
    const cmp = compareAnswers(given, candidate);
    if (cmp.exact) {
      return { score: exercise.points, confidence: 1, needsReview: false, verdict: "correct" };
    }
    if (cmp.withoutDiacritics) bestWithoutDiacritics = true;
  }

  if (bestWithoutDiacritics) {
    return {
      score: exercise.points * NO_DIACRITICS_CREDIT,
      confidence: 1,
      needsReview: false,
      verdict: "correct_no_diacritics",
    };
  }

  return { score: 0, confidence: 1, needsReview: false, verdict: "incorrect" };
}

/** Asociere: pereche stânga→dreapta. Punctaj parțial proporțional. */
function gradeMatch(exercise: GradableExercise, answer: unknown): GradeResult {
  const expected = exercise.canonicalAnswer as Record<string, string>;
  const given = (answer ?? {}) as Record<string, string>;
  const keys = Object.keys(expected);
  if (keys.length === 0) {
    return { score: 0, confidence: 0, needsReview: true, verdict: "undecided" };
  }

  let matched = 0;
  for (const key of keys) {
    const want = expected[key];
    const got = given[key];
    if (want !== undefined && got !== undefined && normalizeAnswer(got) === normalizeAnswer(want)) {
      matched += 1;
    }
  }

  const ratio = matched / keys.length;
  return {
    score: exercise.points * ratio,
    confidence: 1,
    needsReview: false,
    verdict: ratio === 1 ? "correct" : ratio === 0 ? "incorrect" : "partial",
  };
}

/** Ordonare: secvență. Corect doar dacă ordinea e integral respectată. */
function gradeOrder(exercise: GradableExercise, answer: unknown): GradeResult {
  const expected = (exercise.canonicalAnswer ?? []) as string[];
  const given = (answer ?? []) as string[];
  if (!Array.isArray(given) || given.length !== expected.length) {
    return { score: 0, confidence: 1, needsReview: false, verdict: "incorrect" };
  }

  const correctPositions = expected.reduce((count, item, i) => {
    const g = given[i];
    return g !== undefined && normalizeAnswer(g) === normalizeAnswer(item) ? count + 1 : count;
  }, 0);

  if (correctPositions === expected.length) {
    return { score: exercise.points, confidence: 1, needsReview: false, verdict: "correct" };
  }
  return { score: 0, confidence: 1, needsReview: false, verdict: "incorrect" };
}

/**
 * Răspuns scurt liber. Aici corectarea deterministă își recunoaște limitele:
 * dacă răspunsul nu se potrivește exact cu o variantă acceptată, NU declarăm
 * greșit — marcăm ca nedecis și îl trimitem profesorului (sau, în etapa 4,
 * agentului de corectare semantică, al cărui scor rămâne tot o recomandare).
 */
function gradeShort(exercise: GradableExercise, answer: unknown): GradeResult {
  const given = typeof answer === "string" ? answer : "";
  if (given.trim() === "") {
    return { score: 0, confidence: 1, needsReview: false, verdict: "incorrect" };
  }

  const textResult = gradeText(exercise, given);
  if (textResult.verdict === "correct" || textResult.verdict === "correct_no_diacritics") {
    return textResult;
  }

  return {
    score: 0,
    confidence: 0.3,
    needsReview: true,
    verdict: "undecided",
  };
}

/**
 * Scorul care contează în progres. Decizia profesorului bate întotdeauna
 * verdictul automat — invariantul 3 din modelul de date.
 */
export function effectiveScore(attempt: {
  autoScore: number | null;
  teacherScore: number | null;
}): number | null {
  return attempt.teacherScore ?? attempt.autoScore;
}
